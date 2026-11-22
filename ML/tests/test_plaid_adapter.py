"""
Unit tests for PLAIDAdapter (Phase 1).
Follows the single-record-first development and verification sequence:
1. Record "1" (CFL)
2. Record "6" (Fridge)
3. Multiple appliance classes
4. Filtering & iteration
5. Error handling and dataset info
"""

import unittest
from pathlib import Path
import numpy as np

from datasets.plaid_adapter import PLAIDAdapter
from datasets.base import SignalRecord


class TestPLAIDAdapter(unittest.TestCase):
    """Verifies PLAIDAdapter adheres to the canonical contract and discovery rules."""

    @classmethod
    def setUpClass(cls) -> None:
        # Determine paths relative to this test file
        test_dir = Path(__file__).resolve().parent
        ml_dir = test_dir.parent
        cls.dataset_dir = ml_dir / "data" / "raw" / "plaid" / "Submetered" / "submetered_new"
        cls.metadata_path = ml_dir / "data" / "raw" / "plaid" / "Submetered" / "metadata_submetered.json"

        cls.adapter = PLAIDAdapter(
            dataset_dir=cls.dataset_dir,
            metadata_path=cls.metadata_path,
        )

    def test_01_load_record_1_cfl(self) -> None:
        """Step 1: Load record '1' -> validate -> PASS."""
        record = self.adapter.load_record("1")

        self.assertIsInstance(record, SignalRecord)
        self.assertEqual(record.signal_id, "PLAID_1")
        self.assertEqual(record.source_dataset, "PLAID")
        self.assertEqual(record.recording_id, "1")
        self.assertEqual(record.appliance_label, "Compact Fluorescent Lamp")
        self.assertEqual(record.sampling_rate_hz, 30000.0)

        # Invariant: 2.00s duration at 30kHz = 60,000 samples
        self.assertEqual(record.sample_count, 60000)
        self.assertAlmostEqual(record.duration_seconds, 2.00, places=2)

        # Verified discovery: Col 0 is Current (A), Col 1 is Voltage (V)
        self.assertIsNotNone(record.current)
        self.assertIsNotNone(record.voltage)
        self.assertEqual(len(record.current), 60000)
        self.assertEqual(len(record.voltage), 60000)

        # Physical sanity checks
        v_rms = float(np.sqrt(np.mean(record.voltage ** 2)))
        i_rms = float(np.sqrt(np.mean(record.current ** 2)))
        self.assertGreater(v_rms, 110.0)
        self.assertLess(v_rms, 130.0)  # ~120V RMS
        self.assertGreater(i_rms, 0.0)

        # Guidance adherence: mains_frequency_hz must NOT be hardcoded
        self.assertIsNone(record.metadata.get("mains_frequency_hz"))

        # Guidance adherence: extensible quality_flags
        q_flags = record.metadata.get("quality_flags", {})
        self.assertIn("calibration_warning", q_flags)
        self.assertIn("metadata_incomplete", q_flags)
        self.assertIn("missing_optional_metadata", q_flags)
        self.assertTrue(q_flags["length_valid"])
        self.assertTrue(q_flags["sampling_rate_valid"])
        self.assertFalse(q_flags["label_missing"])

        # Guidance adherence: missing metadata preserved as None, not fabricated
        app_details = record.metadata.get("appliance_details", {})
        self.assertIsNone(app_details.get("brand"))
        self.assertIsNone(app_details.get("wattage"))

    def test_02_load_record_6_fridge(self) -> None:
        """Step 2: Load record '6' (Fridge) -> validate -> PASS."""
        record = self.adapter.load_record("6")

        self.assertIsInstance(record, SignalRecord)
        self.assertEqual(record.signal_id, "PLAID_6")
        self.assertEqual(record.recording_id, "6")
        self.assertEqual(record.appliance_label, "Fridge")
        self.assertEqual(record.sampling_rate_hz, 30000.0)

        # Fridge recording 6 is 10.00s = 300,000 samples
        self.assertEqual(record.sample_count, 300000)
        self.assertAlmostEqual(record.duration_seconds, 10.00, places=2)

        v_rms = float(np.sqrt(np.mean(record.voltage ** 2)))
        i_rms = float(np.sqrt(np.mean(record.current ** 2)))
        self.assertAlmostEqual(v_rms, 120.0, delta=5.0)
        self.assertGreater(i_rms, 0.5)

    def test_03_load_multiple_appliance_types(self) -> None:
        """Step 3: Test representative recordings from multiple distinct classes."""
        test_samples = [
            ("7", "Hairdryer"),
            ("9", "Air Conditioner"),
            ("22", "Laptop"),
            ("27", "Microwave"),
            ("56", "Fan"),
            ("123", "Heater"),
        ]

        for rid, expected_label in test_samples:
            rec = self.adapter.load_record(rid)
            self.assertEqual(rec.appliance_label, expected_label)
            self.assertGreater(rec.sample_count, 0)
            self.assertEqual(rec.source_dataset, "PLAID")

    def test_04_filtering_and_iter_records(self) -> None:
        """Step 4: Verify streaming iteration with appliance and ID filters."""
        # Filter by specific IDs
        ids = ["1", "6"]
        records = list(self.adapter.iter_records(record_ids=ids))
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0].recording_id, "1")
        self.assertEqual(records[1].recording_id, "6")

        # Filter by appliance type (take first 3 records of type 'Fan')
        fan_records = []
        for rec in self.adapter.iter_records(appliance_types=["Fan"]):
            fan_records.append(rec)
            if len(fan_records) >= 3:
                break
        self.assertEqual(len(fan_records), 3)
        for r in fan_records:
            self.assertEqual(r.appliance_label, "Fan")

    def test_05_error_handling_unknown_id(self) -> None:
        """Step 5: Verify clean error handling for non-existent record."""
        with self.assertRaises(KeyError):
            self.adapter.load_record("999999")

    def test_06_get_dataset_info(self) -> None:
        """Step 6: Verify summary statistics from metadata index."""
        info = self.adapter.get_dataset_info()
        self.assertEqual(info["total_records"], 1876)
        self.assertEqual(info["total_locations"], 56)
        self.assertEqual(info["declared_sampling_frequency"], "30000Hz")
        self.assertEqual(len(info["appliance_distribution"]), 16)
        self.assertEqual(info["appliance_distribution"]["Hairdryer"], 246)


if __name__ == "__main__":
    unittest.main()
