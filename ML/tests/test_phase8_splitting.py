"""
Unit tests for Phase 8: Leakage-Safe Train / Validation / Test Group Split.
Tests house disjointness, zero-leakage mathematical audit, scaler fit-on-train purity,
JSON serialization, and dataset manifest reproducibility.
"""

import sys
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
import pandas as pd

repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from evaluation.splitting import LeakageSafeSplitter, train_val_test_group_split
from evaluation.audit_leakage import audit_leakage, DataLeakageError
from evaluation.scaling import LeakageSafeScaler
from evaluation.split_manifest import create_split_manifest, load_processed_dataset


class TestPhase8Splitting(unittest.TestCase):
    """Unit test suite for Phase 8 leakage-safe splitting and scaling."""

    def setUp(self):
        """Builds a realistic synthetic multi-house NILM dataset."""
        np.random.seed(42)
        records = []
        appliance_classes = ["Fridge", "CFL", "Microwave", "Hairdryer", "AC", "Heater"]
        
        # 20 distinct houses, each having 3 to 8 appliance recordings
        rec_counter = 1
        for house_idx in range(1, 21):
            house_id = f"House_{house_idx:02d}"
            # Choose a subset of appliances for this house
            n_apps = np.random.randint(3, 7)
            chosen_apps = np.random.choice(appliance_classes, size=n_apps, replace=True)
            for app in chosen_apps:
                rec_id = f"rec_{rec_counter:04d}"
                records.append({
                    "recording_id": rec_id,
                    "house_id": house_id,
                    "appliance_label": app,
                    "feat_power": np.random.uniform(50, 2000),
                    "feat_pf": np.random.uniform(0.6, 1.0),
                    "feat_mode0_hz": np.random.normal(60.0, 0.05),
                    "feat_constant": 5.0,  # Zero variance feature to test scaler stability
                })
                rec_counter += 1

        self.df = pd.DataFrame(records)
        self.feature_cols = ["feat_power", "feat_pf", "feat_mode0_hz", "feat_constant"]

    def test_house_disjointness(self):
        """GATE-8.1: Houses in Train, Val, and Test must be strictly disjoint sets."""
        splitter = LeakageSafeSplitter(
            group_col="house_id",
            label_col="appliance_label",
            test_size=0.20,
            val_size=0.15,
            random_state=42,
        )
        res = splitter.split(self.df)

        train_houses = set(res.train_houses)
        val_houses = set(res.val_houses)
        test_houses = set(res.test_houses)

        # Zero house overlap
        self.assertEqual(len(train_houses & val_houses), 0, "Train and Val houses overlap!")
        self.assertEqual(len(train_houses & test_houses), 0, "Train and Test houses overlap!")
        self.assertEqual(len(val_houses & test_houses), 0, "Val and Test houses overlap!")

        # Union must equal all houses in df
        all_houses = set(self.df["house_id"])
        self.assertEqual(train_houses | val_houses | test_houses, all_houses)

    def test_recording_disjointness(self):
        """GATE-8.2: No individual recording ID may appear in multiple splits."""
        train_df, val_df, test_df = train_val_test_group_split(
            self.df,
            group_col="house_id",
            label_col="appliance_label",
            test_size=0.20,
            val_size=0.15,
            random_state=42,
        )

        train_recs = set(train_df["recording_id"])
        val_recs = set(val_df["recording_id"])
        test_recs = set(test_df["recording_id"])

        self.assertEqual(len(train_recs & val_recs), 0)
        self.assertEqual(len(train_recs & test_recs), 0)
        self.assertEqual(len(val_recs & test_recs), 0)
        self.assertEqual(len(train_df) + len(val_df) + len(test_df), len(self.df))

    def test_leakage_audit_detects_leakage(self):
        """GATE-8.1: Audit engine must detect simulated spatial leakage and raise DataLeakageError."""
        train_df, val_df, test_df = train_val_test_group_split(self.df, random_state=42)

        # Valid split must pass audit
        audit_clean = audit_leakage(train_df, val_df, test_df, strict=True)
        self.assertFalse(audit_clean["leakage_detected"])
        self.assertEqual(audit_clean["status"], "PASS")

        # Inject deliberate house leakage: add one row from val into test
        corrupted_test = pd.concat([test_df, val_df.iloc[[0]]], ignore_index=True)
        with self.assertRaises(DataLeakageError):
            audit_leakage(train_df, val_df, corrupted_test, strict=True)

    def test_scaler_fit_strictly_on_train(self):
        """GATE-8.4: Scaler must fit strictly on Train and remain immutable when transforming Test."""
        train_df, val_df, test_df = train_val_test_group_split(self.df, random_state=42)

        X_train = train_df[self.feature_cols].values
        X_test = test_df[self.feature_cols].values

        scaler = LeakageSafeScaler()
        scaler.fit(X_train, feature_names=self.feature_cols)

        # Check mean and scale computed strictly on train
        expected_mean = np.mean(X_train, axis=0)
        np.testing.assert_allclose(scaler.mean_, expected_mean, rtol=1e-5)

        # Check zero-variance feature handled safely without NaN or Inf
        self.assertTrue(np.all(np.isfinite(scaler.scale_)))
        self.assertEqual(scaler.scale_[-1], 1.0)  # Constant feature scale defaults to 1.0

        # Snapshot parameters before transforming test
        mean_before = scaler.mean_.copy()
        scale_before = scaler.scale_.copy()

        X_test_scaled = scaler.transform(X_test)

        # Parameters must not change after transforming test
        np.testing.assert_array_equal(scaler.mean_, mean_before)
        np.testing.assert_array_equal(scaler.scale_, scale_before)
        self.assertTrue(np.all(np.isfinite(X_test_scaled)))

        # Train scaled should have mean ~ 0 and std ~ 1 (except constant feature)
        X_train_scaled = scaler.transform(X_train)
        np.testing.assert_allclose(np.mean(X_train_scaled[:, :3], axis=0), 0.0, atol=1e-7)
        np.testing.assert_allclose(np.std(X_train_scaled[:, :3], axis=0), 1.0, atol=1e-5)

    def test_scaler_json_serialization(self):
        """GATE-8.4: Scaler must serialize to JSON and reconstruct bit-for-bit identical results."""
        X = self.df[self.feature_cols].values
        scaler = LeakageSafeScaler().fit(X, feature_names=self.feature_cols)

        with tempfile.TemporaryDirectory() as tmp_dir:
            json_path = Path(tmp_dir) / "test_scaler.json"
            scaler.export_json(json_path)
            self.assertTrue(json_path.exists())

            loaded_scaler = LeakageSafeScaler.load_json(json_path)
            self.assertEqual(loaded_scaler.feature_names_, self.feature_cols)
            np.testing.assert_array_equal(loaded_scaler.mean_, scaler.mean_)
            np.testing.assert_array_equal(loaded_scaler.scale_, scaler.scale_)

            # Test identical transform
            orig_scaled = scaler.transform(X)
            loaded_scaled = loaded_scaler.transform(X)
            np.testing.assert_array_equal(orig_scaled, loaded_scaled)

    def test_group_kfold_generator(self):
        """GATE-8.3: get_group_kfold must yield folds with zero group overlap in each split."""
        splitter = LeakageSafeSplitter(group_col="house_id", label_col="appliance_label")
        n_splits = 4
        folds = list(splitter.get_group_kfold(self.df, n_splits=n_splits))

        self.assertEqual(len(folds), n_splits)
        for fold_idx, (tr_idx, val_idx) in enumerate(folds):
            tr_houses = set(self.df.iloc[tr_idx]["house_id"])
            v_houses = set(self.df.iloc[val_idx]["house_id"])
            overlap = tr_houses & v_houses
            self.assertEqual(len(overlap), 0, f"Fold {fold_idx} has house overlap: {overlap}")

    def test_split_manifest_creation_and_load(self):
        """GATE-8.5: Full manifest creation, NPZ dataset export, and reload verification."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_dir = Path(tmp_dir) / "processed"
            cfg_dir = Path(tmp_dir) / "configs"

            manifest_res = create_split_manifest(
                df=self.df,
                feature_cols=self.feature_cols,
                group_col="house_id",
                id_col="recording_id",
                label_col="appliance_label",
                test_size=0.20,
                val_size=0.15,
                random_state=42,
                output_dir=out_dir,
                config_dir=cfg_dir,
            )

            self.assertEqual(manifest_res["status"], "SUCCESS")
            manifest_json = out_dir / "split_manifest_v1.json"
            dataset_npz = out_dir / "dataset_v1.npz"
            scaler_json = cfg_dir / "scaler_v1.json"

            self.assertTrue(manifest_json.exists())
            self.assertTrue(dataset_npz.exists())
            self.assertTrue(scaler_json.exists())

            # Load and verify NPZ dataset
            loaded = load_processed_dataset(dataset_npz)
            self.assertIn("X_train", loaded)
            self.assertIn("X_train_scaled", loaded)
            self.assertIn("y_train", loaded)
            self.assertIn("feature_names", loaded)
            self.assertEqual(loaded["feature_names"], self.feature_cols)

            total_loaded = len(loaded["X_train"]) + len(loaded["X_val"]) + len(loaded["X_test"])
            self.assertEqual(total_loaded, len(self.df))


if __name__ == "__main__":
    unittest.main()
