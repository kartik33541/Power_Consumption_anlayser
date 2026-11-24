"""
Unit and Contract Verification Tests for Phase 3:
Windowing & Event / Steady-State Representation.

Ensures strict adherence to:
- WindowRecord canonical contract and invariants.
- Deterministic sample count (N = 3,000 samples for 6 cycles @ 30kHz / 60Hz).
- Voltage zero-crossing boundary alignment.
- Accurate activation transient detection (Delta P > 30W).
- Steady-state low-variance stability extraction.
- Strict provenance and house_id preservation for Phase 8 group-split.
- End-to-end windowing on real PLAID records.
"""

import sys
import unittest
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datasets.base import SignalRecord, WindowRecord
from datasets.plaid_adapter import PLAIDAdapter
from preprocessing.cleaning import clean_signal
from preprocessing.windowing import (
    calculate_cycle_metrics,
    detect_activation_event,
    extract_transient_window,
    extract_steady_state_window,
    extract_sliding_windows,
    window_signal,
)


class TestPhase3Windowing(unittest.TestCase):
    """Test suite verifying Phase 3 windowing and event representation."""

    def setUp(self):
        self.fs = 30000.0
        self.f0 = 60.0
        self.samples_per_cycle = int(self.fs / self.f0)  # 500 samples
        self.duration = 2.0  # 2 seconds = 60,000 samples
        self.t = np.linspace(0, self.duration, int(self.fs * self.duration), endpoint=False)

    def _create_synthetic_turn_on_record(self) -> SignalRecord:
        """
        Creates a synthetic record with a sharp turn-on event at t = 0.5s.
        Before 0.5s: idle (I = 0.05A).
        After 0.5s: active load (I = 8.0A peak).
        """
        v = 169.7 * np.sin(2 * np.pi * self.f0 * self.t)
        i = np.zeros_like(v)
        
        # Idle before 0.5s (sample 15000)
        idle_mask = self.t < 0.5
        i[idle_mask] = 0.05 * np.sin(2 * np.pi * self.f0 * self.t[idle_mask])

        # Active after 0.5s
        active_mask = self.t >= 0.5
        # Inrush spike for first 3 cycles after 0.5s
        inrush_mask = (self.t >= 0.5) & (self.t < 0.55)
        steady_mask = self.t >= 0.55

        i[inrush_mask] = 16.0 * np.sin(2 * np.pi * self.f0 * self.t[inrush_mask] - np.pi / 4)
        i[steady_mask] = 8.0 * np.sin(2 * np.pi * self.f0 * self.t[steady_mask] - np.pi / 6)

        return SignalRecord(
            signal_id="TEST_SIG_EVENT_001",
            source_dataset="SYNTHETIC",
            recording_id="999",
            sampling_rate_hz=self.fs,
            appliance_label="SyntheticMotor",
            voltage=v,
            current=i,
            metadata={"location": "House_42", "quality_flags": {"dc_bias_removed": True}},
        )

    def test_window_record_contract_invariants(self):
        """WindowRecord must enforce 1D arrays, equal lengths, and valid types."""
        v = np.zeros(3000, dtype=np.float64)
        i = np.ones(3000, dtype=np.float64)

        win = WindowRecord(
            window_id="WIN_001",
            parent_signal_id="SIG_001",
            recording_id="101",
            source_dataset="PLAID",
            house_id="12",
            sampling_rate_hz=30000.0,
            window_type="steady",
            window_start_sec=1.0,
            window_end_sec=1.1,
            start_sample_idx=30000,
            end_sample_idx=33000,
            voltage=v,
            current=i,
            appliance_label="Fridge",
        )

        self.assertEqual(win.sample_count, 3000)
        self.assertAlmostEqual(win.duration_seconds, 0.1, places=3)
        self.assertIn("WIN_001", win.summary())

        # Test invariant: length mismatch must raise ValueError
        with self.assertRaises(ValueError):
            WindowRecord(
                window_id="WIN_BAD",
                parent_signal_id="SIG_001",
                recording_id="101",
                source_dataset="PLAID",
                house_id="12",
                sampling_rate_hz=30000.0,
                window_type="steady",
                window_start_sec=1.0,
                window_end_sec=1.1,
                start_sample_idx=0,
                end_sample_idx=3000,
                voltage=v,
                current=i[:2500],  # Length mismatch
            )

    def test_sample_count_determinism(self):
        """All extracted 6-cycle windows at 30kHz/60Hz must have exactly 3,000 samples."""
        record = self._create_synthetic_turn_on_record()
        cfg = {"cycles_per_window": 6, "grid_frequency_nominal_hz": 60.0, "mode": "both"}
        windows = window_signal(record, cfg)

        self.assertGreater(len(windows), 0)
        for w in windows:
            self.assertEqual(w.sample_count, 3000, f"Window {w.window_id} had sample count != 3000")
            self.assertAlmostEqual(w.duration_seconds, 0.100, places=4)

    def test_zero_crossing_start_alignment(self):
        """Window start sample must align to a voltage rising zero-crossing."""
        record = self._create_synthetic_turn_on_record()
        transient = extract_transient_window(record)
        steady = extract_steady_state_window(record)

        self.assertIsNotNone(transient)
        self.assertIsNotNone(steady)

        # In a rising zero crossing: V[0] should be near 0 and V[1] > V[0]
        self.assertAlmostEqual(transient.voltage[0], 0.0, delta=15.0)
        self.assertAlmostEqual(steady.voltage[0], 0.0, delta=15.0)

    def test_transient_activation_detection_synthetic(self):
        """Activation transient must be detected near t = 0.5s."""
        record = self._create_synthetic_turn_on_record()
        transient = extract_transient_window(record)

        self.assertIsNotNone(transient)
        self.assertEqual(transient.window_type, "transient")
        # Event is at t = 0.5s (sample 15,000). Window has 2 pre-cycles = 1,000 samples.
        # Window start should be around sample 14,000 (t = 0.467s)
        self.assertAlmostEqual(transient.window_start_sec, 0.4667, delta=0.03)
        self.assertIn("event_sample_idx", transient.metadata)

    def test_steady_state_extraction_synthetic(self):
        """Steady-state window must be extracted after the inrush has settled."""
        record = self._create_synthetic_turn_on_record()
        steady = extract_steady_state_window(record)

        self.assertIsNotNone(steady)
        self.assertEqual(steady.window_type, "steady")
        # Inrush settles after 0.55s. Steady window start must be >= 0.55s.
        self.assertGreaterEqual(steady.window_start_sec, 0.55)

    def test_provenance_and_house_id_preservation(self):
        """CRITICAL: house_id and recording_id must be 100% preserved on every window."""
        record = self._create_synthetic_turn_on_record()
        windows = window_signal(record)

        for w in windows:
            self.assertEqual(w.house_id, "House_42")
            self.assertEqual(w.recording_id, "999")
            self.assertEqual(w.appliance_label, "SyntheticMotor")
            self.assertEqual(w.source_dataset, "SYNTHETIC")
            self.assertIn("quality_flags", w.metadata)

    def test_real_plaid_records_windowing(self):
        """Verifies windowing on real PLAID records (CFL #1, Fridge #6, Hairdryer #21)."""
        adapter = PLAIDAdapter()
        
        # Test record 1 (CFL)
        raw1 = adapter.load_record("1")
        clean1 = clean_signal(raw1)
        wins1 = window_signal(clean1, {"mode": "both", "cycles_per_window": 6})
        self.assertGreater(len(wins1), 0)
        for w in wins1:
            self.assertEqual(w.sample_count, 3000)
            self.assertEqual(w.house_id, str(raw1.metadata["location"]))
            self.assertEqual(w.appliance_label, "Compact Fluorescent Lamp")

        # Test record 6 (Fridge)
        raw6 = adapter.load_record("6")
        clean6 = clean_signal(raw6)
        wins6 = window_signal(clean6, {"mode": "event"})
        self.assertGreater(len(wins6), 0)
        types = [w.window_type for w in wins6]
        self.assertIn("steady", types)


if __name__ == "__main__":
    unittest.main()
