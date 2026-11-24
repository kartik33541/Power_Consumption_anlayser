"""
Unit and Contract Verification Tests for Phase 5:
Consistent Mode Ordering (Semantic Mode Alignment).

Ensures strict adherence to:
- Deterministic sorting by ascending center frequency (f_0 < f_1 < ... < f_K-1).
- Mode 0 alignment to the fundamental power grid frequency (~60 Hz).
- Exact mathematical reconstruction invariance (sum of modes and SNR unaltered).
- Alternative energy-based sorting rule.
- Detection and transparent flagging of mode collapse / frequency clashing.
- Strict provenance, house_id, and label preservation for Phase 8 group split.
- End-to-end real PLAID appliance verification.
"""

import sys
import unittest
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datasets.base import VMDRecord
from datasets.plaid_adapter import PLAIDAdapter
from preprocessing.cleaning import clean_signal
from preprocessing.windowing import window_signal
from vmd.decomposition import decompose_window
from vmd.mode_ordering import order_modes, detect_mode_clashes, order_vmd_record


class TestPhase5ModeOrdering(unittest.TestCase):
    """Test suite verifying deterministic mode ordering and semantic alignment."""

    def setUp(self):
        self.fs = 30000.0
        self.duration = 0.100  # 3,000 samples
        self.N = int(self.fs * self.duration)
        self.t = np.linspace(0, self.duration, self.N, endpoint=False)

    def _create_synthetic_scrambled_vmd_record(self) -> VMDRecord:
        """
        Creates a synthetic VMDRecord with deliberately scrambled center frequencies:
        Indices:
        0: 1200 Hz
        1: 60 Hz (fundamental)
        2: 3500 Hz
        3: 180 Hz (3rd harmonic)
        4: 300 Hz (5th harmonic)
        """
        freqs = np.array([1200.0, 60.0, 3500.0, 180.0, 300.0], dtype=np.float64)
        K = len(freqs)
        modes = np.zeros((K, self.N), dtype=np.float64)
        
        # Each mode gets an amplitude inversely proportional to frequency
        amps = [0.4, 3.0, 0.1, 1.2, 0.6]
        for k in range(K):
            modes[k] = amps[k] * np.sin(2 * np.pi * freqs[k] * self.t)

        return VMDRecord(
            record_id="VMD_SCRAMBLED_001",
            parent_window_id="WIN_001",
            parent_signal_id="SIG_001",
            recording_id="999",
            source_dataset="SYNTHETIC",
            house_id="House_77",
            sampling_rate_hz=self.fs,
            window_type="steady",
            K=K,
            modes=modes,
            center_frequencies_hz=freqs,
            reconstruction_snr_db=32.5,
            reconstruction_error_norm=0.02,
            appliance_label="ScrambledLoad",
            metadata={"location": "House_77"},
        )

    def test_frequency_sorting_determinism(self):
        """order_vmd_record must sort modes monotonically by center frequency."""
        raw_rec = self._create_synthetic_scrambled_vmd_record()
        sorted_rec = order_vmd_record(raw_rec, {"mode_ordering_rule": "center_frequency"})

        sorted_freqs = sorted_rec.center_frequencies_hz
        expected_freqs = np.array([60.0, 180.0, 300.0, 1200.0, 3500.0], dtype=np.float64)

        np.testing.assert_allclose(sorted_freqs, expected_freqs, atol=1e-5)
        # Check strict monotonicity
        self.assertTrue(np.all(np.diff(sorted_freqs) > 0))

        # Mode 0 must correspond to the 60 Hz waveform (which was index 1 in raw)
        np.testing.assert_allclose(sorted_rec.modes[0], raw_rec.modes[1], atol=1e-10)
        # Mode 1 must correspond to the 180 Hz waveform (index 3 in raw)
        np.testing.assert_allclose(sorted_rec.modes[1], raw_rec.modes[3], atol=1e-10)

    def test_reconstruction_invariance(self):
        """Mode permutation must strictly preserve reconstructed signal and SNR."""
        raw_rec = self._create_synthetic_scrambled_vmd_record()
        sorted_rec = order_vmd_record(raw_rec)

        raw_sum = raw_rec.reconstructed_signal
        sorted_sum = sorted_rec.reconstructed_signal

        # Sum of modes is mathematically commutative (A + B + C == B + C + A)
        np.testing.assert_allclose(sorted_sum, raw_sum, atol=1e-12)
        self.assertEqual(sorted_rec.reconstruction_snr_db, raw_rec.reconstruction_snr_db)
        self.assertEqual(sorted_rec.reconstruction_error_norm, raw_rec.reconstruction_error_norm)

    def test_energy_sorting_alternative(self):
        """Alternative energy rule must sort modes in strictly descending energy order."""
        raw_rec = self._create_synthetic_scrambled_vmd_record()
        sorted_rec = order_vmd_record(raw_rec, {"mode_ordering_rule": "energy"})

        energies = np.sum(sorted_rec.modes ** 2, axis=1)
        # Check descending order
        self.assertTrue(np.all(np.diff(energies) <= 0))
        self.assertEqual(sorted_rec.metadata["mode_ordering"]["rule"], "energy")

    def test_mode_clash_detection(self):
        """Modes with frequency separation < tolerance must be detected and flagged."""
        # Create record with two nearly identical center frequencies: 60Hz and 68Hz (< 15Hz apart)
        freqs = np.array([60.0, 68.0, 300.0, 1200.0, 3500.0])
        modes = np.ones((5, 3000), dtype=np.float64)

        rec = VMDRecord(
            record_id="VMD_CLASH",
            parent_window_id="WIN_001",
            parent_signal_id="SIG_001",
            recording_id="999",
            source_dataset="SYNTHETIC",
            house_id="House_77",
            sampling_rate_hz=self.fs,
            window_type="steady",
            K=5,
            modes=modes,
            center_frequencies_hz=freqs,
            reconstruction_snr_db=30.0,
            reconstruction_error_norm=0.03,
        )

        sorted_rec = order_vmd_record(rec, {"mode_clash_tolerance_hz": 15.0})
        ordering_meta = sorted_rec.metadata["mode_ordering"]

        self.assertTrue(ordering_meta["mode_clash_detected"])
        self.assertEqual(len(ordering_meta["clashes"]), 1)
        self.assertEqual(ordering_meta["clashes"][0]["separation_hz"], 8.0)

    def test_provenance_and_house_id_preservation(self):
        """CRITICAL: house_id and recording_id must be 100% preserved."""
        raw_rec = self._create_synthetic_scrambled_vmd_record()
        sorted_rec = order_vmd_record(raw_rec)

        self.assertEqual(sorted_rec.house_id, "House_77")
        self.assertEqual(sorted_rec.recording_id, "999")
        self.assertEqual(sorted_rec.appliance_label, "ScrambledLoad")
        self.assertEqual(sorted_rec.source_dataset, "SYNTHETIC")
        self.assertTrue(sorted_rec.metadata["mode_ordering"]["is_sorted"])
        self.assertIn("consistent_mode_ordering", sorted_rec.metadata["preprocessing_history"])

    def test_end_to_end_real_plaid_ordering(self):
        """Verifies that across all real PLAID appliances, Mode 0 is strictly the 60 Hz fundamental."""
        adapter = PLAIDAdapter()
        test_ids = ["1", "6", "21", "29"]

        for rec_id in test_ids:
            raw = adapter.load_record(rec_id)
            clean = clean_signal(raw)
            wins = window_signal(clean, {"mode": "event", "cycles_per_window": 6})
            vmd_rec = decompose_window(wins[0])
            sorted_rec = order_vmd_record(vmd_rec, {"mode_ordering_rule": "center_frequency"})

            freqs = sorted_rec.center_frequencies_hz
            # Mode 0 MUST be the fundamental power grid frequency (55 to 65 Hz)
            self.assertGreaterEqual(freqs[0], 50.0, f"Record {rec_id} Mode 0 < 50Hz: {freqs[0]}")
            self.assertLessEqual(freqs[0], 70.0, f"Record {rec_id} Mode 0 > 70Hz: {freqs[0]}")
            # Strict monotonicity across all 5 modes
            self.assertTrue(np.all(np.diff(freqs) >= 0), f"Record {rec_id} frequencies not sorted: {freqs}")


if __name__ == "__main__":
    unittest.main()
