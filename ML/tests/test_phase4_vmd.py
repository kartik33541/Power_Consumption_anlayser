"""
Unit and Contract Verification Tests for Phase 4:
Variational Mode Decomposition (VMD) Implementation.

Ensures strict adherence to:
- VMDRecord canonical contract and invariants.
- Exact mathematical reconstruction fidelity (SNR >= 20 dB, rel error < 0.10).
- Center frequency identification on multi-harmonic loads.
- Mode orthogonality and spectral separation.
- Numerical stability with zero NaNs / Infs.
- Provenance and house_id preservation for Phase 8 group-split.
- End-to-end decomposition of real PLAID appliance windows.
"""

import sys
import unittest
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datasets.base import WindowRecord, VMDRecord
from datasets.plaid_adapter import PLAIDAdapter
from preprocessing.cleaning import clean_signal
from preprocessing.windowing import window_signal
from vmd.decomposition import (
    compute_mode_orthogonality,
    compute_reconstruction_metrics,
    decompose_waveform,
    decompose_window,
    run_vmd,
)


class TestPhase4VMD(unittest.TestCase):
    """Test suite verifying Phase 4 VMD engine and mathematical reconstruction."""

    def setUp(self):
        self.fs = 30000.0
        self.duration = 0.100  # 100 ms analysis window = 3,000 samples
        self.N = int(self.fs * self.duration)
        self.t = np.linspace(0, self.duration, self.N, endpoint=False)

    def _create_synthetic_multitone_window(self) -> WindowRecord:
        """
        Creates a WindowRecord with a 3-tone harmonic current:
        - 60 Hz fundamental (3.0 A)
        - 180 Hz 3rd harmonic (1.2 A)
        - 300 Hz 5th harmonic (0.6 A)
        """
        i = (
            3.0 * np.sin(2 * np.pi * 60.0 * self.t)
            + 1.2 * np.sin(2 * np.pi * 180.0 * self.t)
            + 0.6 * np.sin(2 * np.pi * 300.0 * self.t)
        )
        v = 169.7 * np.sin(2 * np.pi * 60.0 * self.t)

        return WindowRecord(
            window_id="WIN_SYNTH_001",
            parent_signal_id="SIG_SYNTH_001",
            recording_id="999",
            source_dataset="SYNTHETIC",
            house_id="House_55",
            sampling_rate_hz=self.fs,
            window_type="steady",
            window_start_sec=1.0,
            window_end_sec=1.1,
            start_sample_idx=30000,
            end_sample_idx=33000,
            appliance_label="HarmonicLoad",
            voltage=v,
            current=i,
            metadata={"location": "House_55"},
        )

    def test_vmd_record_contract_invariants(self):
        """VMDRecord must enforce 2D shape (K, N), K length center freqs, and valid types."""
        modes = np.ones((5, 3000), dtype=np.float64)
        center_freqs = np.array([60.0, 180.0, 300.0, 1200.0, 3500.0], dtype=np.float64)

        rec = VMDRecord(
            record_id="VMD_001",
            parent_window_id="WIN_001",
            parent_signal_id="SIG_001",
            recording_id="101",
            source_dataset="PLAID",
            house_id="House_12",
            sampling_rate_hz=30000.0,
            window_type="steady",
            K=5,
            modes=modes,
            center_frequencies_hz=center_freqs,
            reconstruction_snr_db=25.4,
            reconstruction_error_norm=0.03,
            appliance_label="Fridge",
        )

        self.assertEqual(rec.sample_count, 3000)
        self.assertEqual(rec.K, 5)
        self.assertEqual(len(rec.reconstructed_signal), 3000)
        self.assertIn("VMDRecord", rec.summary())

        # Test invariant: modes row count mismatch with K must raise ValueError
        with self.assertRaises(ValueError):
            VMDRecord(
                record_id="VMD_BAD",
                parent_window_id="WIN_001",
                parent_signal_id="SIG_001",
                recording_id="101",
                source_dataset="PLAID",
                house_id="House_12",
                sampling_rate_hz=30000.0,
                window_type="steady",
                K=5,
                modes=modes[:3, :],  # Only 3 rows instead of K=5
                center_frequencies_hz=center_freqs,
                reconstruction_snr_db=25.0,
                reconstruction_error_norm=0.03,
            )

    def test_reconstruction_fidelity_synthetic(self):
        """Reconstruction SNR must be >= 20 dB and relative L2 error < 0.10."""
        window = self._create_synthetic_multitone_window()
        vmd_rec = decompose_window(window, {"K": 5, "alpha": 2000.0})

        self.assertGreaterEqual(vmd_rec.reconstruction_snr_db, 20.0)
        self.assertLess(vmd_rec.reconstruction_error_norm, 0.10)

        # Direct mathematical verification: original - sum(modes)
        diff = window.current - vmd_rec.reconstructed_signal
        orig_norm = np.linalg.norm(window.current)
        err_norm = np.linalg.norm(diff)
        rel_err = err_norm / orig_norm

        self.assertAlmostEqual(rel_err, vmd_rec.reconstruction_error_norm, places=4)

    def test_center_frequency_identification(self):
        """VMD must identify center frequencies corresponding to synthesized 60, 180, and 300 Hz."""
        window = self._create_synthetic_multitone_window()
        vmd_rec = decompose_window(window, {"K": 5, "alpha": 2000.0})

        freqs = vmd_rec.center_frequencies_hz
        # Verify that 60Hz fundamental is captured by at least one mode
        self.assertTrue(np.any(np.isclose(freqs, 60.0, atol=8.0)), f"No mode near 60Hz: {freqs}")
        # Verify that 180Hz 3rd harmonic is captured
        self.assertTrue(np.any(np.isclose(freqs, 180.0, atol=18.0)), f"No mode near 180Hz: {freqs}")
        # Verify that 300Hz 5th harmonic is captured
        self.assertTrue(np.any(np.isclose(freqs, 300.0, atol=30.0)), f"No mode near 300Hz: {freqs}")

    def test_mode_orthogonality(self):
        """Modes must be band-separated with low mutual cross-correlation on real physical loads."""
        adapter = PLAIDAdapter()
        raw1 = adapter.load_record("1")
        clean1 = clean_signal(raw1)
        wins1 = window_signal(clean1, {"mode": "event", "cycles_per_window": 6})
        vmd_rec = decompose_window(wins1[0], {"K": 5, "alpha": 2000.0})

        ortho_mat = compute_mode_orthogonality(vmd_rec.modes)
        self.assertEqual(ortho_mat.shape, (5, 5))

        # Diagonal must be identically 1.0
        np.testing.assert_allclose(np.diag(ortho_mat), 1.0, atol=1e-5)

        # Off-diagonal elements should show clean band separation (< 0.25 on real CFL)
        off_diag = ortho_mat[~np.eye(5, dtype=bool)]
        self.assertLess(np.max(off_diag), 0.25, f"Excessive mode overlap: {np.max(off_diag)}")

    def test_numerical_stability_edge_cases(self):
        """VMD must handle near-zero waveforms without raising NaNs or diverging."""
        silent = np.zeros(3000, dtype=np.float64)
        modes, freqs, snr, err = decompose_waveform(silent, self.fs, K=5)

        self.assertEqual(modes.shape, (5, 3000))
        self.assertFalse(np.isnan(modes).any())
        self.assertFalse(np.isnan(freqs).any())
        self.assertEqual(snr, 100.0)
        self.assertEqual(err, 0.0)

    def test_provenance_and_house_id_preservation(self):
        """CRITICAL: house_id and recording_id must flow without loss into VMDRecord."""
        window = self._create_synthetic_multitone_window()
        vmd_rec = decompose_window(window)

        self.assertEqual(vmd_rec.house_id, "House_55")
        self.assertEqual(vmd_rec.recording_id, "999")
        self.assertEqual(vmd_rec.appliance_label, "HarmonicLoad")
        self.assertEqual(vmd_rec.parent_window_id, "WIN_SYNTH_001")
        self.assertEqual(vmd_rec.source_dataset, "SYNTHETIC")
        self.assertIn("vmd_params", vmd_rec.metadata)

    def test_real_plaid_windows_decomposition(self):
        """Verifies decomposition on real PLAID appliance windows (CFL #1 and Fridge #6)."""
        adapter = PLAIDAdapter()

        # 1. CFL #1
        raw1 = adapter.load_record("1")
        clean1 = clean_signal(raw1)
        wins1 = window_signal(clean1, {"mode": "event", "cycles_per_window": 6})
        self.assertGreater(len(wins1), 0)
        
        vmd1 = decompose_window(wins1[0], {"K": 5, "alpha": 2000.0})
        self.assertEqual(vmd1.modes.shape, (5, 3000))
        self.assertGreater(vmd1.reconstruction_snr_db, 15.0)
        self.assertEqual(vmd1.house_id, str(raw1.metadata["location"]))

        # 2. Fridge #6
        raw6 = adapter.load_record("6")
        clean6 = clean_signal(raw6)
        wins6 = window_signal(clean6, {"mode": "event", "cycles_per_window": 6})
        self.assertGreater(len(wins6), 0)
        
        vmd6 = decompose_window(wins6[0], {"K": 5, "alpha": 2000.0})
        self.assertEqual(vmd6.modes.shape, (5, 3000))
        self.assertGreater(vmd6.reconstruction_snr_db, 15.0)


if __name__ == "__main__":
    unittest.main()
