"""
Dataset Quality Audit Module for Phase 2.
Performs an exhaustive streaming audit of all records from an adapter,
computing DC offsets, clipping, duration distributions, grid frequencies,
and logging all detected defects to a structured JSON artifact.
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Dict, List, Optional
import numpy as np

# Ensure ML package is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
ml_dir = os.path.abspath(os.path.join(current_dir, ".."))
if ml_dir not in sys.path:
    sys.path.insert(0, ml_dir)

from datasets.base import BaseDatasetAdapter, SignalRecord
from preprocessing.cleaning import clean_signal


class DatasetQualityAuditor:
    """
    Exhaustive streaming auditor for dataset signal quality.
    
    Streams records one by one without accumulating large arrays into RAM,
    validating every record through the Phase 2 preprocessing contract.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {
            "dc_offset_tolerance_v": 0.5,
            "dc_offset_tolerance_i": 0.005,
            "clipping_consecutive_samples": 15,
            "clipping_relative_threshold": 0.99,
            "nominal_grid_freq_hz": 60.0,
        }

    def audit_dataset(
        self,
        adapter: BaseDatasetAdapter,
        max_records: Optional[int] = None,
        verbose_interval: int = 250,
    ) -> Dict[str, Any]:
        """
        Audits all records produced by the adapter.

        Returns:
            Dictionary containing dataset-level summary statistics, defect registry,
            and appliance-specific breakdowns.
        """
        t0 = time.time()
        dataset_name = getattr(adapter, "dataset_name", adapter.__class__.__name__)
        print(f"Starting Quality Audit on dataset: {dataset_name} ...")

        total_records = 0
        nan_records = []
        inf_records = []
        clipped_records = []
        high_v_dc_records = []
        high_i_dc_records = []
        short_records = []  # < 0.5s
        long_records = []   # > 15s
        freq_outlier_records = []

        v_offsets = []
        i_offsets = []
        durations = []
        grid_freqs = []
        peak_currents = []
        rms_currents = []
        appliance_counts = {}
        appliance_clipped = {}

        for record in adapter.iter_records():
            total_records += 1
            rec_id = record.recording_id
            label = record.appliance_label or "UNKNOWN"

            appliance_counts[label] = appliance_counts.get(label, 0) + 1

            # Process through Phase 2 cleaning pipeline
            cleaned = clean_signal(record, self.config)
            meta = cleaned.metadata
            qflags = meta.get("quality_flags", {})
            dc_meta = meta.get("removed_dc_offset", {})
            grid_hz = meta.get("grid_frequency_estimated_hz", 60.0)

            dur = cleaned.duration_seconds
            durations.append(dur)
            grid_freqs.append(grid_hz)

            v_dc = dc_meta.get("voltage_v", 0.0)
            i_dc = dc_meta.get("current_a", 0.0)
            v_offsets.append(v_dc)
            i_offsets.append(i_dc)

            # Check peak and RMS current
            if cleaned.current is not None and len(cleaned.current) > 0:
                pk_i = float(np.max(np.abs(cleaned.current)))
                rms_i = float(np.sqrt(np.mean(cleaned.current ** 2)))
                peak_currents.append(pk_i)
                rms_currents.append(rms_i)

            # Defect & Warning Tracking
            if qflags.get("has_nan"):
                nan_records.append(rec_id)
            if qflags.get("has_inf"):
                inf_records.append(rec_id)

            if qflags.get("is_clipped"):
                clipped_records.append({
                    "recording_id": rec_id,
                    "appliance_label": label,
                    "clipped_samples_current": qflags.get("clipped_samples_current", 0),
                    "clipped_samples_voltage": qflags.get("clipped_samples_voltage", 0),
                })
                appliance_clipped[label] = appliance_clipped.get(label, 0) + 1

            if qflags.get("high_voltage_dc_bias"):
                high_v_dc_records.append({
                    "recording_id": rec_id,
                    "appliance_label": label,
                    "v_dc_offset": v_dc,
                })

            if qflags.get("high_current_dc_bias"):
                high_i_dc_records.append({
                    "recording_id": rec_id,
                    "appliance_label": label,
                    "i_dc_offset": i_dc,
                })

            if dur < 0.5:
                short_records.append({"recording_id": rec_id, "duration": dur})
            elif dur > 15.0:
                long_records.append({"recording_id": rec_id, "duration": dur})

            if abs(grid_hz - 60.0) > 1.5:
                freq_outlier_records.append({
                    "recording_id": rec_id,
                    "estimated_grid_hz": grid_hz,
                })

            if total_records % verbose_interval == 0:
                print(f"  Audited {total_records} records ... (elapsed: {time.time() - t0:.1f}s)")

            if max_records and total_records >= max_records:
                break

        elapsed = time.time() - t0
        print(f"Quality Audit complete. Audited {total_records} records in {elapsed:.2f}s.")

        # Aggregate summary calculations
        dur_arr = np.array(durations)
        v_dc_arr = np.array(v_offsets)
        i_dc_arr = np.array(i_offsets)
        gf_arr = np.array(grid_freqs)
        pk_i_arr = np.array(peak_currents) if peak_currents else np.array([0.0])

        summary = {
            "dataset_name": dataset_name,
            "total_records_audited": total_records,
            "audit_duration_seconds": round(elapsed, 2),
            "defect_counts": {
                "nan_records": len(nan_records),
                "inf_records": len(inf_records),
                "clipped_records": len(clipped_records),
                "high_voltage_dc_bias_records": len(high_v_dc_records),
                "high_current_dc_bias_records": len(high_i_dc_records),
                "short_duration_records (<0.5s)": len(short_records),
                "long_duration_records (>15s)": len(long_records),
                "grid_frequency_outliers (>1.5Hz drift)": len(freq_outlier_records),
            },
            "duration_distribution_seconds": {
                "min": round(float(np.min(dur_arr)), 3),
                "q25": round(float(np.percentile(dur_arr, 25)), 3),
                "median": round(float(np.median(dur_arr)), 3),
                "q75": round(float(np.percentile(dur_arr, 75)), 3),
                "max": round(float(np.max(dur_arr)), 3),
                "mean": round(float(np.mean(dur_arr)), 3),
            },
            "dc_offset_voltage_v": {
                "min": round(float(np.min(v_dc_arr)), 4),
                "mean": round(float(np.mean(v_dc_arr)), 4),
                "median": round(float(np.median(v_dc_arr)), 4),
                "max": round(float(np.max(v_dc_arr)), 4),
                "std": round(float(np.std(v_dc_arr)), 4),
            },
            "dc_offset_current_a": {
                "min": round(float(np.min(i_dc_arr)), 5),
                "mean": round(float(np.mean(i_dc_arr)), 5),
                "median": round(float(np.median(i_dc_arr)), 5),
                "max": round(float(np.max(i_dc_arr)), 5),
                "std": round(float(np.std(i_dc_arr)), 5),
            },
            "grid_frequency_hz": {
                "min": round(float(np.min(gf_arr)), 3),
                "mean": round(float(np.mean(gf_arr)), 3),
                "median": round(float(np.median(gf_arr)), 3),
                "max": round(float(np.max(gf_arr)), 3),
                "std": round(float(np.std(gf_arr)), 4),
            },
            "peak_current_a": {
                "min": round(float(np.min(pk_i_arr)), 3),
                "median": round(float(np.median(pk_i_arr)), 3),
                "max": round(float(np.max(pk_i_arr)), 3),
            },
            "appliance_distribution": appliance_counts,
            "appliance_clipped_breakdown": appliance_clipped,
            "defects_detail": {
                "nan_records": nan_records,
                "inf_records": inf_records,
                "clipped_records_sample": clipped_records[:20],
                "high_v_dc_records_sample": high_v_dc_records[:20],
                "high_i_dc_records_sample": high_i_dc_records[:20],
                "short_records": short_records,
                "long_records_sample": long_records[:10],
                "grid_frequency_outliers": freq_outlier_records,
            },
        }

        return summary

    def save_summary_artifact(self, summary: Dict[str, Any], output_path: str) -> None:
        """Saves audit summary to a JSON file."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2)
        print(f"Saved quality audit summary artifact to: {output_path}")


if __name__ == "__main__":
    from datasets.plaid_adapter import PLAIDAdapter

    adapter = PLAIDAdapter()
    auditor = DatasetQualityAuditor()
    summary = auditor.audit_dataset(adapter)
    out_file = os.path.join(ml_dir, "data", "interim", "quality_audit_summary.json")
    auditor.save_summary_artifact(summary, out_file)
