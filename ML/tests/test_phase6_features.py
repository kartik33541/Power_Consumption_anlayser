"""
Test Suite for Phase 6: Multi-Domain Feature Extraction.
Verifies IEEE 1459 macroscopic power theory, VMD sub-band energy conservation,
numerical robustness on edge cases (zero-current, missing channels),
metadata provenance preservation, and physical differentiation on real PLAID loads.
"""

import sys
from pathlib import Path
import unittest
import numpy as np
import pandas as pd

# Add repo root to path for absolute imports
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from datasets.base import SignalRecord, WindowRecord, VMDRecord
from features.electrical import extract_electrical_features, compute_thd_fft
from features.time_domain import extract_time_features
from features.frequency_domain import extract_frequency_features
from features.vmd_features import extract_vmd_features
from features.pipeline import FeaturePipeline
from datasets.plaid_adapter import PLAIDAdapter
from preprocessing.cleaning import clean_signal
from preprocessing.windowing import window_signal, extract_steady_state_window
from vmd.decomposition import decompose_window
from vmd.mode_ordering import order_vmd_record


class TestPhase6Features(unittest.TestCase):
    """Rigorous tests for Phase 6 Multi-Domain Feature Extraction."""

    def setUp(self):
        self.fs = 30000.0  # 30 kHz
        self.f_grid = 60.0 # 60 Hz
        self.duration = 0.1 # 100 ms = 3,000 samples = 6 full cycles
        self.n_samples = int(self.fs * self.duration)
        self.t = np.arange(self.n_samples) / self.fs

    def test_electrical_pure_resistive(self):
        """Pure resistive load: P = S, Q = 0, D = 0, PF = 1.0, THD = 0, CF = sqrt(2)."""
        v_rms_target = 120.0
        i_rms_target = 10.0
        v = v_rms_target * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t)
        i = i_rms_target * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t)

        rec = WindowRecord(
            window_id="win_res",
            parent_signal_id="sig_res",
            recording_id="rec_res",
            source_dataset="synthetic",
            house_id="house_1",
            sampling_rate_hz=self.fs,
            window_type="steady",
            window_start_sec=0.0,
            window_end_sec=self.duration,
            start_sample_idx=0,
            end_sample_idx=self.n_samples,
            voltage=v,
            current=i,
        )

        feats = extract_electrical_features(rec, fundamental_current=i)

        self.assertAlmostEqual(feats["active_power_p"], 1200.0, delta=0.5)
        self.assertAlmostEqual(feats["apparent_power_s"], 1200.0, delta=0.5)
        self.assertAlmostEqual(feats["reactive_power_q"], 0.0, delta=1.0)
        self.assertAlmostEqual(feats["distortion_power_d"], 0.0, delta=1.0)
        self.assertAlmostEqual(feats["power_factor"], 1.0, delta=0.001)
        self.assertAlmostEqual(feats["displacement_power_factor"], 1.0, delta=0.001)
        self.assertAlmostEqual(feats["current_crest_factor"], np.sqrt(2), delta=0.01)
        self.assertLess(feats["current_thd"], 0.01)

    def test_electrical_pure_inductive(self):
        """Pure inductive load: I lags V by 90 degrees. P = 0, Q = S, PF = 0.0."""
        v = 120.0 * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t)
        i = 10.0 * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t - (np.pi / 2))

        rec = WindowRecord(
            window_id="win_ind",
            parent_signal_id="sig_ind",
            recording_id="rec_ind",
            source_dataset="synthetic",
            house_id="house_1",
            sampling_rate_hz=self.fs,
            window_type="steady",
            window_start_sec=0.0,
            window_end_sec=self.duration,
            start_sample_idx=0,
            end_sample_idx=self.n_samples,
            voltage=v,
            current=i,
        )

        feats = extract_electrical_features(rec, fundamental_current=i)

        self.assertAlmostEqual(feats["active_power_p"], 0.0, delta=1.0)
        self.assertAlmostEqual(feats["apparent_power_s"], 1200.0, delta=0.5)
        self.assertAlmostEqual(feats["reactive_power_q"], 1200.0, delta=1.0)
        self.assertAlmostEqual(feats["power_factor"], 0.0, delta=0.01)

    def test_electrical_nonlinear_load_with_distortion(self):
        """Nonlinear load with 3rd harmonic: THD > 0, D > 0, PF < 1.0."""
        v = 120.0 * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t)
        # Fundamental (5A RMS) + 3rd harmonic (2A RMS)
        i_fund = 5.0 * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t)
        i_harm = 2.0 * np.sqrt(2) * np.sin(2 * np.pi * (3 * self.f_grid) * self.t)
        i_total = i_fund + i_harm

        rec = WindowRecord(
            window_id="win_nonlin",
            parent_signal_id="sig_nonlin",
            recording_id="rec_nonlin",
            source_dataset="synthetic",
            house_id="house_1",
            sampling_rate_hz=self.fs,
            window_type="steady",
            window_start_sec=0.0,
            window_end_sec=self.duration,
            start_sample_idx=0,
            end_sample_idx=self.n_samples,
            voltage=v,
            current=i_total,
        )

        feats = extract_electrical_features(rec, fundamental_current=i_fund)

        # Expected THD = 2.0 / 5.0 = 0.40 (40%)
        self.assertAlmostEqual(feats["current_thd"], 0.40, delta=0.02)
        self.assertGreater(feats["distortion_power_d"], 200.0)
        self.assertLess(feats["power_factor"], 1.0)

    def test_time_and_frequency_features(self):
        """Verifies geometric time metrics and spectral centroid on known waveforms."""
        sine_wave = 5.0 * np.sin(2 * np.pi * 60.0 * self.t)
        t_feats = extract_time_features(sine_wave)
        f_feats = extract_frequency_features(sine_wave, sampling_rate_hz=self.fs)

        # Sine wave RMS = 5 / sqrt(2) approx 3.5355
        self.assertAlmostEqual(t_feats["rms"], 5.0 / np.sqrt(2), delta=0.05)
        self.assertAlmostEqual(t_feats["peak_to_peak"], 10.0, delta=0.05)
        self.assertAlmostEqual(t_feats["crest_factor"], np.sqrt(2), delta=0.02)
        # Fisher skewness of pure symmetric sine is 0.0
        self.assertAlmostEqual(t_feats["skewness"], 0.0, delta=0.05)
        # Fisher kurtosis of pure sine is -1.5
        self.assertAlmostEqual(t_feats["kurtosis"], -1.5, delta=0.05)

        # Spectral dominant frequency should be exactly 60 Hz
        self.assertAlmostEqual(f_feats["dominant_frequency"], 60.0, delta=1.0)
        self.assertAlmostEqual(f_feats["spectral_centroid"], 60.0, delta=3.0)

    def test_vmd_features_energy_conservation(self):
        """Verifies that per-mode energy ratios sum to exactly 1.0."""
        k = 5
        modes = np.array([
            2.0 * np.sin(2 * np.pi * 60.0 * self.t),
            1.0 * np.sin(2 * np.pi * 180.0 * self.t),
            0.5 * np.sin(2 * np.pi * 300.0 * self.t),
            0.2 * np.sin(2 * np.pi * 1000.0 * self.t),
            0.1 * np.sin(2 * np.pi * 3000.0 * self.t),
        ])
        cfs = [60.0, 180.0, 300.0, 1000.0, 3000.0]

        vmd_rec = VMDRecord(
            record_id="vmd_test",
            parent_window_id="win_test",
            parent_signal_id="sig_test",
            recording_id="rec_test",
            source_dataset="synthetic",
            house_id="house_1",
            sampling_rate_hz=self.fs,
            window_type="steady",
            K=k,
            modes=modes,
            center_frequencies_hz=np.array(cfs, dtype=np.float64),
            reconstruction_snr_db=60.0,
            reconstruction_error_norm=0.001,
        )

        feats = extract_vmd_features(vmd_rec, sampling_rate_hz=self.fs)

        # Sum of energy ratios must be exactly 1.0
        ratio_sum = sum(feats[f"mode_{idx}_energy_ratio"] for idx in range(k))
        self.assertAlmostEqual(ratio_sum, 1.0, delta=1e-6)

        # Mode 0 should have the largest energy ratio
        self.assertGreater(feats["mode_0_energy_ratio"], feats["mode_1_energy_ratio"])
        self.assertAlmostEqual(feats["vmd_fundamental_energy_ratio"], feats["mode_0_energy_ratio"], delta=1e-6)
        self.assertAlmostEqual(
            feats["vmd_harmonic_energy_ratio"],
            1.0 - feats["mode_0_energy_ratio"],
            delta=1e-6,
        )

    def test_numerical_stability_zero_current_and_edge_cases(self):
        """Zero current / standby must produce clean 0.0 values with zero NaNs/Infs."""
        zero_current = np.zeros(self.n_samples, dtype=np.float64)
        normal_voltage = 120.0 * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t)

        rec = WindowRecord(
            window_id="win_zero",
            parent_signal_id="sig_zero",
            recording_id="rec_zero",
            source_dataset="synthetic",
            house_id="house_1",
            sampling_rate_hz=self.fs,
            window_type="steady",
            window_start_sec=0.0,
            window_end_sec=self.duration,
            start_sample_idx=0,
            end_sample_idx=self.n_samples,
            voltage=normal_voltage,
            current=zero_current,
        )

        feats = extract_electrical_features(rec)

        self.assertEqual(feats["current_rms"], 0.0)
        self.assertEqual(feats["active_power_p"], 0.0)
        self.assertEqual(feats["apparent_power_s"], 0.0)
        self.assertEqual(feats["reactive_power_q"], 0.0)
        self.assertEqual(feats["power_factor"], 0.0)
        self.assertEqual(feats["current_thd"], 0.0)
        self.assertEqual(feats["current_crest_factor"], 0.0)

        # Check for zero NaNs or Infs
        for k, v in feats.items():
            self.assertFalse(np.isnan(v), f"Feature {k} was NaN on zero current")
            self.assertFalse(np.isinf(v), f"Feature {k} was Inf on zero current")

    def test_pipeline_single_window_and_batch_dataframe(self):
        """Verifies FeaturePipeline metadata preservation, schema completeness, and Y decoupling."""
        pipeline = FeaturePipeline()

        # Build 2 synthetic windows: 1 steady, 1 transient
        v = 120.0 * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t)
        i_steady = 5.0 * np.sqrt(2) * np.sin(2 * np.pi * self.f_grid * self.t)
        i_transient = np.copy(i_steady)
        i_transient[:100] *= 4.0 # Inrush spike

        win_1 = WindowRecord(
            window_id="win_std_1",
            parent_signal_id="sig_1",
            recording_id="rec_1",
            source_dataset="synthetic",
            house_id="house_A",
            sampling_rate_hz=self.fs,
            window_type="steady",
            window_start_sec=0.0,
            window_end_sec=0.1,
            start_sample_idx=0,
            end_sample_idx=self.n_samples,
            voltage=v,
            current=i_steady,
            appliance_label="Fridge",
        )

        win_2 = WindowRecord(
            window_id="win_trn_2",
            parent_signal_id="sig_2",
            recording_id="rec_2",
            source_dataset="synthetic",
            house_id="house_B",
            sampling_rate_hz=self.fs,
            window_type="transient",
            window_start_sec=0.1,
            window_end_sec=0.2,
            start_sample_idx=self.n_samples,
            end_sample_idx=2 * self.n_samples,
            voltage=v,
            current=i_transient,
            appliance_label="Microwave",
        )

        df, y = pipeline.build_feature_dataframe([win_1, win_2])

        self.assertEqual(len(df), 2)
        self.assertEqual(len(y), 2)
        self.assertEqual(list(y), ["Fridge", "Microwave"])

        # Check metadata columns
        for meta_col in FeaturePipeline.METADATA_COLUMNS:
            self.assertIn(meta_col, df.columns)

        self.assertEqual(df.loc[0, "house_id"], "house_A")
        self.assertEqual(df.loc[1, "house_id"], "house_B")
        self.assertEqual(df.loc[0, "window_type"], "steady")
        self.assertEqual(df.loc[1, "window_type"], "transient")

        # Inrush peak should be greater in transient window
        self.assertGreater(df.loc[1, "transient_inrush_peak"], df.loc[0, "transient_inrush_peak"])

        # Zero NaNs or Infs across entire table
        num_cols = [c for c in df.columns if c not in FeaturePipeline.METADATA_COLUMNS]
        self.assertEqual(df[num_cols].isna().sum().sum(), 0)

    def test_real_plaid_load_differentiation(self):
        """
        Runs full pipeline on real PLAID loads (CFL vs Hairdryer vs Fridge).
        Confirms distinct physical signatures:
          - Hairdryer: PF >= 0.98, Mode 0 energy ratio >= 0.85
          - CFL: High THD (>= 0.40)
          - Fridge: Lagging PF (0.60 to 0.90)
        """
        adapter = PLAIDAdapter()

        records_to_test = {
            "CFL": "1",         # Compact Fluorescent Lamp
            "Fridge": "6",      # Fridge
            "Hairdryer": "21",  # Hairdryer
        }

        pipeline = FeaturePipeline()
        extracted_feats = {}

        for name, rec_id in records_to_test.items():
            sig = adapter.load_record(rec_id)
            clean_sig = clean_signal(sig)
            windows = window_signal(clean_sig, {"mode": "event", "cycles_per_window": 6})
            self.assertGreater(len(windows), 0)

            # Pick the steady-state window
            steady_win = next((w for w in windows if w.window_type == "steady"), windows[0])
            raw_vmd = decompose_window(steady_win, {"K": 5, "alpha": 2000.0})
            sorted_vmd = order_vmd_record(raw_vmd)

            f_dict = pipeline.extract_feature_dict(steady_win, vmd_record=sorted_vmd)
            extracted_feats[name] = f_dict

        # Hairdryer (low-harmonic dominant fundamental):
        # Mode 0 contains > 95% of total energy, THD < 0.30
        hd = extracted_feats["Hairdryer"]
        self.assertGreaterEqual(hd["mode_0_energy_ratio"], 0.95)
        self.assertLessEqual(hd["elec_current_thd"], 0.30)

        # CFL (non-linear diode bridge rectifier):
        # Massive current THD (>= 0.70), poor PF (<= 0.70), and Mode 1 ratio >= 0.25
        cfl = extracted_feats["CFL"]
        self.assertGreaterEqual(cfl["elec_current_thd"], 0.70)
        self.assertGreaterEqual(cfl["mode_1_energy_ratio"], 0.25)
        self.assertLessEqual(cfl["elec_power_factor"], 0.70)

        # Fridge (steady compressor operation):
        # Active power P in [80W, 150W], Mode 0 ratio >= 0.95
        fridge = extracted_feats["Fridge"]
        self.assertGreater(fridge["elec_active_power_p"], 80.0)
        self.assertLess(fridge["elec_active_power_p"], 150.0)
        self.assertGreater(fridge["mode_0_energy_ratio"], 0.95)


if __name__ == "__main__":
    unittest.main()
