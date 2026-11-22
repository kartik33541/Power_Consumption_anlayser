"""
Unit tests for Phase 0 - Canonical Contract & Pipeline Skeleton.
Verifies all Phase 0 invariants and PASS GATE criteria.

Cleanup Guarantee:
Uses in-memory synthesis and temporary directories with automated teardown.
No persistent scratch files or test artifacts are left in the repository.
"""

import os
import shutil
import tempfile
import unittest
import numpy as np
import yaml

from datasets.base import SignalRecord, BaseDatasetAdapter
from preprocessing.cleaning import clean_signal, remove_dc_bias
from preprocessing.calibration import calibrate_signal
from preprocessing.windowing import extract_event_windows
from features.pipeline import FeaturePipeline
from models.random_forest import NILMRandomForest
from inference.pipeline import InferencePipeline


class TestPhase0Contract(unittest.TestCase):
    """Verifies the Phase 0 canonical contract without any external dataset dependencies."""

    def setUp(self) -> None:
        self.temp_dir = tempfile.mkdtemp(prefix="phase0_test_")
        self.fs = 10000.0  # 10 kHz test sampling rate
        self.duration = 0.1  # 100 ms duration
        self.t = np.arange(int(self.fs * self.duration)) / self.fs

        # Synthesize known sinusoidal signals
        # V(t): 230V RMS 50Hz sinusoid
        self.v_t = 230.0 * np.sqrt(2) * np.sin(2 * np.pi * 50.0 * self.t)
        # I(t): 5A 50Hz fundamental + 1.2A 150Hz 3rd harmonic
        self.i_t = 5.0 * np.sin(2 * np.pi * 50.0 * self.t) + 1.2 * np.sin(2 * np.pi * 150.0 * self.t)

    def tearDown(self) -> None:
        # Guarantee no test files or temp folders remain
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_synthetic_signal_record_creation(self) -> None:
        """Test creating a valid canonical SignalRecord."""
        record = SignalRecord(
            signal_id="synth_001",
            source_dataset="SYNTHETIC",
            recording_id="rec_01",
            sampling_rate_hz=self.fs,
            voltage=self.v_t,
            current=self.i_t,
            appliance_label="Kettle",
            metadata={"test_run": True},
        )

        self.assertEqual(record.signal_id, "synth_001")
        self.assertEqual(record.source_dataset, "SYNTHETIC")
        self.assertEqual(record.sample_count, len(self.t))
        self.assertAlmostEqual(record.duration_seconds, self.duration, places=4)
        self.assertIsNone(record.session_id)  # Unprovided field remains None, not fabricated
        self.assertEqual(record.appliance_label, "Kettle")

    def test_invariant_sampling_rate_positive(self) -> None:
        """Rule 3: Sampling rate must be strictly positive and explicit."""
        with self.assertRaises(ValueError):
            SignalRecord(
                signal_id="bad_fs",
                source_dataset="SYNTHETIC",
                recording_id="rec_01",
                sampling_rate_hz=0.0,
                current=self.i_t,
            )

        with self.assertRaises(ValueError):
            SignalRecord(
                signal_id="bad_fs_neg",
                source_dataset="SYNTHETIC",
                recording_id="rec_01",
                sampling_rate_hz=-100.0,
                current=self.i_t,
            )

    def test_invariant_1d_waveforms(self) -> None:
        """Rule 1 & 2: Voltage and Current must be 1D arrays."""
        bad_2d_current = np.zeros((10, 10))
        with self.assertRaises(ValueError):
            SignalRecord(
                signal_id="bad_dim",
                source_dataset="SYNTHETIC",
                recording_id="rec_01",
                sampling_rate_hz=self.fs,
                current=bad_2d_current,
            )

    def test_invariant_length_match(self) -> None:
        """If both V and I exist, lengths must match."""
        mismatched_i = self.i_t[:100]
        with self.assertRaises(ValueError):
            SignalRecord(
                signal_id="mismatch",
                source_dataset="SYNTHETIC",
                recording_id="rec_01",
                sampling_rate_hz=self.fs,
                voltage=self.v_t,
                current=mismatched_i,
            )

    def test_downstream_preprocessing_and_features(self) -> None:
        """Downstream modules must consume SignalRecord cleanly without raw file access."""
        # Add artificial DC offset
        record = SignalRecord(
            signal_id="dc_test",
            source_dataset="SYNTHETIC",
            recording_id="rec_02",
            sampling_rate_hz=self.fs,
            voltage=self.v_t + 5.0,
            current=self.i_t + 1.0,
            appliance_label="Fridge",
        )

        # Cleaning
        cleaned = remove_dc_bias(record)
        self.assertAlmostEqual(float(np.mean(cleaned.voltage)), 0.0, places=3)
        self.assertAlmostEqual(float(np.mean(cleaned.current)), 0.0, places=3)

        # Calibration
        calibrated = calibrate_signal(cleaned, v_scale=1.0, i_scale=1.0)
        self.assertTrue(calibrated.metadata.get("calibrated", False))

        # Windowing
        windows = extract_event_windows(calibrated, window_samples=500)
        self.assertGreater(len(windows), 0)
        for w in windows:
            self.assertEqual(w.sample_count, 500)

        # Feature Extraction
        pipeline = FeaturePipeline()
        feats, feat_names = pipeline.extract_features(calibrated)
        self.assertGreater(len(feats), 0)
        self.assertIn("elec_active_power_p", feat_names)
        self.assertIn("elec_reactive_power_q", feat_names)

        # End-to-end Inference Stub
        model = NILMRandomForest()
        model.fit(np.zeros((2, len(feats))), ["Fridge", "Kettle"])
        infer = InferencePipeline(model)
        result = infer.predict_record(calibrated)
        self.assertIn("prediction", result)

    def test_pipeline_config_yaml_loading(self) -> None:
        """Configuration mechanism must load and validate pipeline settings."""
        config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "pipeline.yaml")
        self.assertTrue(os.path.exists(config_path), "configs/pipeline.yaml must exist.")

        with open(config_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)

        self.assertIn("vmd", cfg)
        self.assertIn("features", cfg)
        self.assertIn("sampling", cfg)
        self.assertEqual(cfg["vmd"]["K"], 5)


if __name__ == "__main__":
    unittest.main()
