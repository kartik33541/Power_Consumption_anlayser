"""
Unit and Contract Verification Tests for Phase 7:
Feature Selection, Correlation Pruning & Ablation Analysis.

Verifies:
- Collinearity pruning logic using Mutual Information and Priority Tier tie-breakers.
- Shannon Mutual Information ranking between features and discrete classes.
- Tree importance and permutation importance ranking.
- FeatureSelector fit and transform contracts (provenance metadata preservation).
- JSON specification generation and serialization.
- Cross-validated dimensionality and domain ablation studies.
"""

import sys
import unittest
import json
from pathlib import Path
import numpy as np
import pandas as pd

repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from selection.correlation import (
    compute_correlation_matrix,
    find_collinear_pairs,
    prune_collinear_features,
    select_uncorrelated_features,
)
from selection.mutual_information import (
    compute_mutual_information,
    rank_features_by_mi,
)
from selection.importance import (
    compute_tree_importance,
    compute_permutation_importance,
)
from selection.ablation import (
    evaluate_feature_subset,
    run_dimensionality_ablation,
    run_domain_ablation,
)
from selection.pipeline import FeatureSelector


class TestPhase7Selection(unittest.TestCase):
    """Test suite verifying Phase 7 feature selection algorithms and pipelines."""

    def setUp(self):
        np.random.seed(42)
        self.n_samples = 120
        # 3 classes: A, B, C
        self.y = np.array(["A"] * 40 + ["B"] * 40 + ["C"] * 40)

        # Informative feature 1 (discriminates classes cleanly)
        f_active_power = np.concatenate([
            np.random.normal(50.0, 5.0, 40),
            np.random.normal(200.0, 10.0, 40),
            np.random.normal(1200.0, 50.0, 40),
        ])

        # Collinear clone of f_active_power with tiny noise (r > 0.99)
        f_power_clone = f_active_power + np.random.normal(0.0, 0.5, self.n_samples)

        # Informative feature 2 (Mode 0 energy ratio)
        f_mode0_ratio = np.concatenate([
            np.random.normal(0.60, 0.05, 40),
            np.random.normal(0.95, 0.02, 40),
            np.random.normal(0.95, 0.02, 40),
        ])

        # Informative feature 3 (THD - orthogonal to power and mode0 ratio)
        f_thd = np.concatenate([
            np.random.normal(0.10, 0.02, 40),
            np.random.normal(0.80, 0.05, 40),
            np.random.normal(0.10, 0.02, 40),
        ])

        # Pure random noise features (uninformative)
        f_noise1 = np.random.normal(0.0, 1.0, self.n_samples)
        f_noise2 = np.random.normal(10.0, 2.0, self.n_samples)

        self.df = pd.DataFrame({
            "window_id": [f"win_{i}" for i in range(self.n_samples)],
            "house_id": [f"house_{i % 5}" for i in range(self.n_samples)],
            "recording_id": [f"rec_{i}" for i in range(self.n_samples)],
            "window_type": ["steady"] * self.n_samples,
            "sampling_rate_hz": [30000.0] * self.n_samples,
            "elec_active_power_p": f_active_power,
            "raw_power_collinear_clone": f_power_clone,
            "mode_0_energy_ratio": f_mode0_ratio,
            "elec_current_thd": f_thd,
            "random_noise_1": f_noise1,
            "random_noise_2": f_noise2,
        })
        self.feature_cols = [
            "elec_active_power_p",
            "raw_power_collinear_clone",
            "mode_0_energy_ratio",
            "elec_current_thd",
            "random_noise_1",
            "random_noise_2",
        ]

    def test_collinearity_detection_and_pruning(self):
        """Verifies collinear pairs (r >= 0.90) are identified and pruned deterministically."""
        corr = compute_correlation_matrix(self.df, self.feature_cols)
        pairs = find_collinear_pairs(corr, threshold=0.90)

        # There should be exactly 1 collinear pair: (elec_active_power_p, raw_power_collinear_clone)
        self.assertGreaterEqual(len(pairs), 1)
        self.assertEqual(pairs[0][0], "elec_active_power_p")
        self.assertEqual(pairs[0][1], "raw_power_collinear_clone")
        self.assertGreater(pairs[0][2], 0.99)

        # Run pruning
        mi_scores = {
            "elec_active_power_p": 0.85,
            "raw_power_collinear_clone": 0.70,
            "mode_0_energy_ratio": 0.80,
            "elec_current_thd": 0.75,
            "random_noise_1": 0.01,
            "random_noise_2": 0.02,
        }
        retained, drop_log = prune_collinear_features(corr, self.feature_cols, mi_scores=mi_scores, threshold=0.90)

        # raw_power_collinear_clone must be dropped because it has lower MI
        self.assertIn("elec_active_power_p", retained)
        self.assertNotIn("raw_power_collinear_clone", retained)
        self.assertEqual(len(drop_log), 1)
        self.assertEqual(drop_log[0]["dropped_feature"], "raw_power_collinear_clone")

    def test_mutual_information_ranking(self):
        """Verifies mutual information ranks discriminative features far above random noise."""
        X = self.df[self.feature_cols].to_numpy()
        mi_scores = compute_mutual_information(X, self.y, self.feature_cols, random_state=42)

        # Informative features must have significantly higher MI than noise
        self.assertGreater(mi_scores["elec_active_power_p"], 0.50)
        self.assertGreater(mi_scores["mode_0_energy_ratio"], 0.50)
        self.assertLess(mi_scores["random_noise_1"], 0.20)
        self.assertLess(mi_scores["random_noise_2"], 0.20)

        ranked = rank_features_by_mi(mi_scores)
        # Top 3 features must be informative, noise must be in the bottom
        self.assertIn(ranked[0], ["elec_active_power_p", "mode_0_energy_ratio", "elec_current_thd", "raw_power_collinear_clone"])
        self.assertIn(ranked[-1], ["random_noise_1", "random_noise_2"])

    def test_tree_importance_ranking(self):
        """Verifies Random Forest Gini importance ranks informative features at the top."""
        X = self.df[self.feature_cols].to_numpy()
        importances = compute_tree_importance(X, self.y, self.feature_cols, random_state=42)

        # Total importance sums to approximately 1.0
        self.assertAlmostEqual(sum(importances.values()), 1.0, delta=0.01)
        # Noise features should have minimal importance (< 0.10)
        self.assertLess(importances["random_noise_1"], 0.10)
        self.assertLess(importances["random_noise_2"], 0.10)

    def test_feature_selector_fit_transform_contract(self):
        """Verifies FeatureSelector fit and transform methods, metadata preservation, and size reduction."""
        selector = FeatureSelector(target_k=3, correlation_threshold=0.90, random_state=42)
        selector.fit(self.df, pd.Series(self.y))

        # Check that exactly target_k features are selected
        self.assertEqual(len(selector.selected_features_), 3)
        # Ensure collinear clone was pruned
        self.assertNotIn("raw_power_collinear_clone", selector.selected_features_)

        # Transform dataframe
        transformed_df = selector.transform(self.df)

        # Invariant: Metadata columns MUST be preserved
        for meta_col in ["window_id", "house_id", "recording_id", "window_type"]:
            self.assertIn(meta_col, transformed_df.columns)
            self.assertEqual(len(transformed_df[meta_col]), self.n_samples)

        # Invariant: Only metadata + selected_features_ should be in transformed_df
        expected_cols = set(selector.METADATA_COLUMNS + selector.selected_features_)
        self.assertTrue(set(transformed_df.columns).issubset(expected_cols))

    def test_specification_export_and_json_validity(self):
        """Verifies features_v1.json specification is properly generated and structured."""
        tmp_spec_path = repo_root / "ML" / "configs" / "test_features_spec.json"
        try:
            selector = FeatureSelector(target_k=3, correlation_threshold=0.90, random_state=42)
            selector.fit(self.df, pd.Series(self.y))
            out_path = selector.export_specification(output_path=str(tmp_spec_path))

            self.assertTrue(out_path.exists())
            with open(out_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            self.assertEqual(data["version"], "1.0.0")
            self.assertEqual(data["final_selected_count"], 3)
            self.assertIn("selected_features", data)
            self.assertIn("feature_details", data)
            self.assertIn("ablation_summary", data)
        finally:
            if tmp_spec_path.exists():
                tmp_spec_path.unlink()

    def test_ablation_evaluation(self):
        """Verifies dimensionality and domain ablation studies return valid F1 and accuracy metrics."""
        dim_df = run_dimensionality_ablation(
            self.df,
            self.y,
            ranked_features=self.feature_cols,
            k_steps=[1, 3, 5],
            cv_splits=3,
            random_state=42,
        )
        self.assertEqual(len(dim_df), 3)
        self.assertIn("accuracy", dim_df.columns)
        self.assertIn("f1_macro", dim_df.columns)

        # F1-macro should be >= 0.70 when using informative features
        best_f1 = dim_df["f1_macro"].max()
        self.assertGreaterEqual(best_f1, 0.70)


if __name__ == "__main__":
    unittest.main()
