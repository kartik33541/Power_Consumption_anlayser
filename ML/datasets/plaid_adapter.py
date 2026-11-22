"""
PLAID Dataset Adapter (Phase 1 Implementation).

Converts raw PLAID CSV/JSON files into canonical SignalRecord objects on demand.

Design Principles:
1. Pure translation & preservation: Never fabricates missing values or fixes defects in the adapter.
2. Extensible quality flags: Source warnings and missing fields are explicitly captured.
3. Stream on demand: Loads requested recordings individually without holding the entire dataset in RAM.
4. Frequency fidelity: Does not hardcode mains frequency; sampling_rate_hz is parsed directly from metadata.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Union
import numpy as np

from .base import BaseDatasetAdapter, SignalRecord


class PLAIDAdapter(BaseDatasetAdapter):
    """
    Adapter for the PLAID (Plug Load Appliance Identification Dataset) submetered dataset.
    """

    def __init__(
        self,
        dataset_dir: Union[str, Path] = "ML/data/raw/plaid/Submetered/submetered_new",
        metadata_path: Union[str, Path] = "ML/data/raw/plaid/Submetered/metadata_submetered.json",
        config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(str(dataset_dir), config)
        self.dataset_dir = Path(dataset_dir)
        self.metadata_path = Path(metadata_path)

        if not self.metadata_path.exists():
            raise FileNotFoundError(f"PLAID metadata file not found at: {self.metadata_path}")
        if not self.dataset_dir.exists():
            raise FileNotFoundError(f"PLAID dataset directory not found at: {self.dataset_dir}")

        with open(self.metadata_path, "r", encoding="utf-8") as f:
            self.metadata: Dict[str, Any] = json.load(f)

    def load_record(self, record_id: str, **kwargs: Any) -> SignalRecord:
        """
        Loads a single PLAID recording by its string or integer ID and returns a canonical SignalRecord.
        
        Steps:
        1. Look up record_id in metadata index.
        2. Locate and load raw CSV file ({record_id}.csv).
        3. Parse Column 0 as Current (A) and Column 1 as Voltage (V).
        4. Extract and preserve metadata without fabrication.
        5. Build extensible quality_flags capturing source warnings and missing fields.
        """
        rec_id_str = str(record_id).strip()
        if rec_id_str not in self.metadata:
            raise KeyError(f"Record ID '{rec_id_str}' not found in PLAID metadata index.")

        meta_entry = self.metadata[rec_id_str]
        csv_path = self.dataset_dir / f"{rec_id_str}.csv"
        if not csv_path.exists():
            raise FileNotFoundError(f"PLAID raw data file not found: {csv_path}")

        # Read raw CSV: PLAID has no text header, exactly 2 columns: Col 0 = Current, Col 1 = Voltage
        raw_data = np.loadtxt(csv_path, delimiter=",", dtype=np.float64)
        if raw_data.ndim != 2 or raw_data.shape[1] != 2:
            raise ValueError(
                f"Expected 2-column waveform data in {csv_path}, got shape {raw_data.shape}"
            )

        current_arr = np.ascontiguousarray(raw_data[:, 0], dtype=np.float64)
        voltage_arr = np.ascontiguousarray(raw_data[:, 1], dtype=np.float64)

        # Extract metadata structures
        app_info: Dict[str, Any] = meta_entry.get("appliance", {})
        header_info: Dict[str, Any] = meta_entry.get("header", {})
        instance_info: Dict[str, Any] = meta_entry.get("instances", {})
        location: Optional[str] = meta_entry.get("location")

        # Ground truth appliance label
        raw_label = app_info.get("type")
        appliance_label = raw_label.strip() if (isinstance(raw_label, str) and raw_label.strip()) else None

        # Sampling rate parsing from metadata
        sampling_freq_str = header_info.get("sampling_frequency", "30000Hz")
        try:
            sampling_rate_hz = float(str(sampling_freq_str).lower().replace("hz", "").strip())
        except ValueError:
            sampling_rate_hz = 30000.0

        # Duration parsing
        duration_str = instance_info.get("length", "")
        expected_duration = None
        if duration_str and "s" in str(duration_str):
            try:
                expected_duration = float(str(duration_str).replace("s", "").strip())
            except ValueError:
                expected_duration = None

        # Build missing optional metadata tracking
        missing_optional: List[str] = []
        cleaned_app_info: Dict[str, Any] = {}
        for k, v in app_info.items():
            if v == "" or v is None:
                missing_optional.append(k)
                cleaned_app_info[k] = None
            else:
                cleaned_app_info[k] = v

        # Build extensible quality_flags
        header_notes = header_info.get("notes", "")
        calibration_warning = "not well calibrated" in header_notes.lower()
        metadata_incomplete = "not complete" in header_notes.lower()

        actual_rows = len(current_arr)
        expected_rows = int(round(expected_duration * sampling_rate_hz)) if expected_duration else None
        length_valid = (expected_rows is None) or (abs(actual_rows - expected_rows) <= 300)

        quality_flags = {
            "metadata_incomplete": metadata_incomplete,
            "calibration_warning": calibration_warning,
            "missing_optional_metadata": missing_optional,
            "label_missing": appliance_label is None,
            "current_missing": False,
            "voltage_missing": False,
            "length_valid": length_valid,
            "sampling_rate_valid": sampling_rate_hz > 0,
            "source_notes": header_notes,
        }

        record_metadata = {
            "location": location,
            "appliance_details": cleaned_app_info,
            "collection_time": header_info.get("collection_time"),
            "expected_duration_seconds": expected_duration,
            "quality_flags": quality_flags,
            "mains_frequency_hz": None,  # Explicitly None: not assumed or hardcoded from source
        }

        return SignalRecord(
            signal_id=f"PLAID_{rec_id_str}",
            source_dataset="PLAID",
            recording_id=rec_id_str,
            sampling_rate_hz=sampling_rate_hz,
            appliance_label=appliance_label,
            appliance_instance_id=cleaned_app_info.get("model_number"),
            voltage=voltage_arr,
            current=current_arr,
            metadata=record_metadata,
        )

    def iter_records(
        self,
        appliance_types: Optional[List[str]] = None,
        record_ids: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> Iterator[SignalRecord]:
        """
        Iterates over PLAID records on demand, optionally filtered by appliance_types or record_ids.
        Does not retain all records in memory.
        """
        # Determine candidate IDs
        if record_ids is not None:
            candidate_ids = [str(r).strip() for r in record_ids]
        else:
            candidate_ids = sorted(list(self.metadata.keys()), key=lambda x: int(x) if x.isdigit() else x)

        target_types = set(appliance_types) if appliance_types is not None else None

        for rid in candidate_ids:
            if rid not in self.metadata:
                continue

            if target_types is not None:
                rec_type = self.metadata[rid].get("appliance", {}).get("type")
                if rec_type not in target_types:
                    continue

            yield self.load_record(rid)

    def get_dataset_info(self) -> Dict[str, Any]:
        """Returns verified summary statistics from the metadata index."""
        from collections import Counter

        app_counts = Counter(
            v.get("appliance", {}).get("type", "Unknown") for v in self.metadata.values()
        )
        locations = set(v.get("location") for v in self.metadata.values() if v.get("location"))

        durations = []
        for v in self.metadata.values():
            l_str = v.get("instances", {}).get("length", "")
            if l_str and "s" in str(l_str):
                try:
                    durations.append(float(str(l_str).replace("s", "").strip()))
                except ValueError:
                    pass

        return {
            "name": "PLAID",
            "type": "High-Frequency Submetered Voltage & Current Waveforms",
            "total_records": len(self.metadata),
            "appliance_distribution": dict(app_counts.most_common()),
            "total_locations": len(locations),
            "duration_stats": {
                "min_seconds": min(durations) if durations else None,
                "max_seconds": max(durations) if durations else None,
                "mean_seconds": (sum(durations) / len(durations)) if durations else None,
            },
            "declared_sampling_frequency": "30000Hz",
        }
