"""
Unit and Contract Verification Tests for Phase 2:
Raw Signal Validation & Preprocessing Policy.

Ensures strict adherence to:
- SignalRecord canonical contract preservation.
- Zero-distortion DC offset removal.
- Absolute amplitude preservation (No min-max scaling to [0, 1]).
- Sensor clipping detection and flagging.
- Grid frequency and V-I phase synchronization.
- Non-fabrication of data and transparent defect surfacing.
"""

import sys
import unittest
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datasets.base import SignalRecord
from preprocessing.cleaning import clean_signal, detect_clipping, remove_dc_bias
from preprocessing.synchronization import (
    detect_zero_crossings,
    estimate_grid_frequency,
    compute_vi_phase_metrics,
    synchronize_vi,
)
from datasets.plaid_adapter import PLAIDAdapter


class TestPhase2Preprocessing(unittest.TestCase):
    """Test suite verifying all Phase 2 preprocessing contracts and policies."""

    def setUp(self):
        self.fs = 30000.0
        self.duration = 1.0  # 1 second = 30,000 samples
        self.t = np.linspace(0, self.duration, int(self.fs * self.duration), endpoint=False)
        self.f0 = 60.0  # 60 Hz fundamental

    def _create_synthetic_record(
        self,
        v_dc: float = 0.0,
        i_dc: float = 0.0,
        i_amp: float = 10.0,
        v_amp: float = 170.0,
        phase_shift_rad: float = 0.0,
        clip_level: float = None,
    ) -> SignalRecord:
        """Helper to synthesize known electrical waveforms."""
        v = v_amp * np.sin(2 * np.pi * self.f0 * self.t) + v_dc
        i = i_amp * np.sin(2 * np.pi * self.f0 * self.t - phase_shift_rad) + i_dc

        if clip_level is not None:
            i = np.clip(i, -clip_level, clip_level)

        return SignalRecord(
            signal_id="TEST_SYNTH_001",
            source_dataset="SYNTHETIC",
            recording_id="9999",
            sampling_rate_hz=self.fs,
            appliance_label="TestLoad",
            voltage=v,
            current=i,
            metadata={"location": "TestBench"},
        )

    def test_canonical_contract_preservation(self):
        """Cleaned record must remain a valid SignalRecord satisfying all invariants."""
        raw = self._create_synthetic_record(v_dc=-1.5, i_dc=0.02)
        cleaned = clean_signal(raw)

        self.assertIsInstance(cleaned, SignalRecord)
        self.assertEqual(cleaned.signal_id, "TEST_SYNTH_001_clean")
        self.assertEqual(cleaned.source_dataset, "SYNTHETIC")
        self.assertEqual(cleaned.recording_id, "9999")
        self.assertEqual(cleaned.sampling_rate_hz, 30000.0)
        self.assertEqual(cleaned.appliance_label, "TestLoad")
        self.assertEqual(len(cleaned.voltage), len(raw.voltage))
        self.assertEqual(len(cleaned.current), len(raw.current))

        # Check metadata & history
        self.assertTrue(cleaned.metadata["quality_flags"]["phase2_certified"])
        self.assertIn("phase2_validation_and_cleaning", cleaned.metadata["preprocessing_history"])
        self.assertIn("dc_bias_removal", cleaned.metadata["preprocessing_history"])

    def test_dc_bias_removal_accuracy(self):
        """DC bias must be precisely subtracted without altering sinusoidal dynamics."""
        raw = self._create_synthetic_record(v_dc=3.75, i_dc=-0.25)
        cleaned = clean_signal(raw)

        # Post-cleaning mean must be essentially 0.0
        self.assertAlmostEqual(float(np.mean(cleaned.voltage)), 0.0, places=7)
        self.assertAlmostEqual(float(np.mean(cleaned.current)), 0.0, places=7)

        # Removed offset accurately logged
        dc_meta = cleaned.metadata["removed_dc_offset"]
        self.assertAlmostEqual(dc_meta["voltage_v"], 3.75, places=3)
        self.assertAlmostEqual(dc_meta["current_a"], -0.25, places=3)

        # High DC flags triggered
        qflags = cleaned.metadata["quality_flags"]
        self.assertTrue(qflags["high_voltage_dc_bias"])
        self.assertTrue(qflags["high_current_dc_bias"])

    def test_strict_amplitude_preservation(self):
        """
        MANDATE: Amplitudes must remain in true Amperes and Volts.
        Strictly forbids arbitrary min-max scaling to [0, 1] or [-1, 1].
        """
        i_peak_expected = 12.5  # Amperes
        v_peak_expected = 169.7  # Volts (~120V RMS)
        raw = self._create_synthetic_record(
            v_dc=-2.0, i_dc=0.01, i_amp=i_peak_expected, v_amp=v_peak_expected
        )
        cleaned = clean_signal(raw)

        # Physical amplitude must NOT be compressed into [0, 1]
        i_peak_cleaned = np.max(np.abs(cleaned.current))
        v_peak_cleaned = np.max(np.abs(cleaned.voltage))

        self.assertAlmostEqual(i_peak_cleaned, i_peak_expected, places=2)
        self.assertAlmostEqual(v_peak_cleaned, v_peak_expected, places=1)

        # RMS must reflect true physical values (Irms ~ 8.84A, Vrms ~ 120.0V)
        i_rms = np.sqrt(np.mean(cleaned.current ** 2))
        v_rms = np.sqrt(np.mean(cleaned.voltage ** 2))
        self.assertAlmostEqual(i_rms, i_peak_expected / np.sqrt(2), places=2)
        self.assertAlmostEqual(v_rms, v_peak_expected / np.sqrt(2), places=1)

    def test_clipping_detection_and_flagging(self):
        """Clipped waveforms must be detected and flagged in quality_flags."""
        # Non-clipped signal: should NOT flag clipping
        unclipped = self._create_synthetic_record(i_amp=10.0, clip_level=None)
        cleaned_unclipped = clean_signal(unclipped)
        self.assertFalse(cleaned_unclipped.metadata["quality_flags"]["is_clipped"])

        # Clipped signal: artificially clipped at 7.0A (when peak is 10.0A)
        clipped = self._create_synthetic_record(i_amp=10.0, clip_level=7.0)
        cleaned_clipped = clean_signal(clipped)

        qflags = cleaned_clipped.metadata["quality_flags"]
        self.assertTrue(qflags["is_clipped"])
        self.assertGreater(qflags["clipped_samples_current"], 10)
        self.assertIn("clipping_analysis", cleaned_clipped.metadata)

    def test_grid_frequency_estimation(self):
        """Fundamental frequency estimation must accurately extract nominal 60.0 Hz."""
        raw = self._create_synthetic_record()
        mean_freq, std_freq, n_cycles = estimate_grid_frequency(raw, nominal_freq_hz=60.0)

        self.assertAlmostEqual(mean_freq, 60.0, places=1)
        self.assertLess(std_freq, 0.05)
        self.assertEqual(n_cycles, 59)  # In 1 second at 60Hz, 59 or 60 full cycle intervals

    def test_vi_phase_lag_and_load_character(self):
        """Inductive loads (current lagging) and resistive loads must be classified properly."""
        # Pure Resistive: phase shift = 0 rad
        resistive = self._create_synthetic_record(phase_shift_rad=0.0)
        cleaned_r = clean_signal(resistive)
        self.assertEqual(cleaned_r.metadata["load_character"], "resistive")
        self.assertAlmostEqual(cleaned_r.metadata["vi_phase_lag_deg"], 0.0, places=1)
        self.assertAlmostEqual(cleaned_r.metadata["displacement_power_factor"], 1.0, places=2)

        # Inductive Load: current lags voltage by 45 degrees (pi/4 rad)
        inductive = self._create_synthetic_record(phase_shift_rad=np.pi / 4)
        cleaned_ind = clean_signal(inductive)
        self.assertEqual(cleaned_ind.metadata["load_character"], "inductive")
        self.assertAlmostEqual(cleaned_ind.metadata["vi_phase_lag_deg"], 45.0, places=0)
        self.assertAlmostEqual(cleaned_ind.metadata["displacement_power_factor"], float(np.cos(np.pi / 4)), places=2)

    def test_real_plaid_records_cleaning(self):
        """Tests end-to-end cleaning on actual PLAID records (CFL #1 and Fridge #6)."""
        adapter = PLAIDAdapter()
        
        # Test record 1 (CFL)
        rec1 = adapter.load_record("1")
        clean1 = clean_signal(rec1)
        self.assertAlmostEqual(float(np.mean(clean1.voltage)), 0.0, places=5)
        self.assertAlmostEqual(float(np.mean(clean1.current)), 0.0, places=5)
        self.assertTrue(clean1.metadata["quality_flags"]["phase2_certified"])
        self.assertGreater(clean1.metadata["grid_frequency_estimated_hz"], 59.0)
        self.assertLess(clean1.metadata["grid_frequency_estimated_hz"], 61.0)

        # Test record 6 (Fridge)
        rec6 = adapter.load_record("6")
        clean6 = clean_signal(rec6)
        self.assertAlmostEqual(float(np.mean(clean6.voltage)), 0.0, places=5)
        self.assertAlmostEqual(float(np.mean(clean6.current)), 0.0, places=5)
        self.assertTrue(clean6.metadata["quality_flags"]["phase2_certified"])


if __name__ == "__main__":
    unittest.main()
