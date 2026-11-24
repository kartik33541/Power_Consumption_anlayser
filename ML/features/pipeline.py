"""
Master Feature Extraction Pipeline for Non-Intrusive Load Monitoring.
Transforms canonical WindowRecords and sorted VMDRecords into flat tabular features X
while strictly isolating ground truth Y and preserving provenance metadata.
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from datasets.base import SignalRecord, WindowRecord, VMDRecord
from .electrical import extract_electrical_features
from .time_domain import extract_time_features
from .frequency_domain import extract_frequency_features
from .vmd_features import extract_vmd_features


class FeaturePipeline:
    """
    End-to-end multi-domain feature extraction pipeline.

    Operates on single windows or batch datasets to produce leak-proof tabular
    representations with complete provenance tracking.
    """

    METADATA_COLUMNS = [
        "window_id",
        "parent_signal_id",
        "recording_id",
        "house_id",
        "window_type",
        "sampling_rate_hz",
    ]

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.include_vmd = self.config.get("include_vmd", True)

    def extract_features(
        self,
        record: Union[SignalRecord, WindowRecord],
        vmd_record: Optional[VMDRecord] = None,
        return_dict: bool = False,
    ) -> Union[Tuple[np.ndarray, List[str]], Tuple[np.ndarray, List[str], Dict[str, float]]]:
        """
        Extracts multi-domain feature vector from a single record and its VMD modes.

        Args:
            record: SignalRecord or WindowRecord to extract features from.
            vmd_record: Optional sorted VMDRecord for sub-band multi-scale features.
            return_dict: If True, returns (feature_vector, feature_names, feature_dict).
                         If False, returns (feature_vector, feature_names) for Phase 0 contract compatibility.

        Returns:
            feature_vector (1D np.ndarray): Numerical feature values
            feature_names (List[str]): Alphabetically sorted feature names
            feature_dict (Optional[Dict[str, float]]): Only if return_dict=True
        """
        feature_dict: Dict[str, float] = {}
        sampling_rate = float(record.sampling_rate_hz)

        # 1. Fundamental extraction for IEEE 1459 cross-channel power
        fundamental_current = None
        if vmd_record is not None and vmd_record.modes is not None and len(vmd_record.modes) > 0:
            # Mode 0 in Phase 5 sorted VMD is guaranteed to be fundamental grid frequency
            fundamental_current = vmd_record.modes[0]

        # 2. Electrical domain macroscopic power quantities
        elec_feats = extract_electrical_features(
            record=record,
            fundamental_current=fundamental_current,
        )
        for k, v in elec_feats.items():
            feature_dict[f"elec_{k}"] = float(v)

        # 3. Raw waveform time-domain geometry (current and voltage)
        if record.current is not None and len(record.current) > 0:
            i_time = extract_time_features(record.current)
            for k, v in i_time.items():
                feature_dict[f"raw_current_{k}"] = float(v)

            i_freq = extract_frequency_features(record.current, sampling_rate_hz=sampling_rate)
            for k, v in i_freq.items():
                feature_dict[f"raw_current_{k}"] = float(v)

        if record.voltage is not None and len(record.voltage) > 0:
            v_time = extract_time_features(record.voltage)
            for k, v in v_time.items():
                feature_dict[f"raw_voltage_{k}"] = float(v)

        # 4. Transient-specific inrush dynamics (if window is transient)
        w_type = getattr(record, "window_type", "steady")
        if w_type == "transient" and record.current is not None and len(record.current) > 0:
            i_abs = np.abs(record.current)
            inrush_peak = float(np.max(i_abs))
            i_rms = float(np.sqrt(np.mean(record.current ** 2)))
            feature_dict["transient_inrush_peak"] = inrush_peak
            feature_dict["transient_inrush_ratio"] = float(inrush_peak / (i_rms + 1e-12))
            feature_dict["transient_ptp"] = float(np.ptp(record.current))
        else:
            feature_dict["transient_inrush_peak"] = 0.0
            feature_dict["transient_inrush_ratio"] = 1.0 if w_type == "steady" else 0.0
            feature_dict["transient_ptp"] = 0.0

        # 5. VMD sub-band multi-scale features (if available)
        if self.include_vmd and vmd_record is not None and vmd_record.modes is not None:
            vmd_feats = extract_vmd_features(
                vmd_record=vmd_record,
                sampling_rate_hz=sampling_rate,
            )
            for k, v in vmd_feats.items():
                feature_dict[k] = float(v)

        # Ensure deterministic ordering
        feature_names = sorted(feature_dict.keys())
        feature_vector = np.array([feature_dict[k] for k in feature_names], dtype=np.float64)

        if return_dict:
            return feature_vector, feature_names, feature_dict
        return feature_vector, feature_names

    def extract_feature_dict(
        self,
        record: Union[SignalRecord, WindowRecord],
        vmd_record: Optional[VMDRecord] = None,
    ) -> Dict[str, float]:
        """Convenience method returning pure feature dictionary."""
        _, _, f_dict = self.extract_features(record, vmd_record=vmd_record, return_dict=True)
        return f_dict

    def build_feature_dataframe(
        self,
        windows: List[WindowRecord],
        vmd_records: Optional[List[Optional[VMDRecord]]] = None,
    ) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Builds a tabular pandas DataFrame from a batch of windows and VMD records.

        Returns:
            X_df: DataFrame containing all numerical features PLUS metadata columns
                  ('window_id', 'parent_signal_id', 'recording_id', 'house_id', etc.)
            y_series: Series containing ground-truth appliance labels, indexed identically to X_df
        """
        if vmd_records is None:
            vmd_records = [None] * len(windows)

        if len(windows) != len(vmd_records):
            raise ValueError(
                f"Mismatch between window count ({len(windows)}) and VMD record count ({len(vmd_records)})"
            )

        rows: List[Dict[str, Any]] = []
        labels: List[Optional[str]] = []

        for win, vmd in zip(windows, vmd_records):
            f_dict = self.extract_feature_dict(win, vmd_record=vmd)

            # Attach metadata for strict Phase 8 group-splitting
            row = dict(f_dict)
            row["window_id"] = win.window_id
            row["parent_signal_id"] = win.parent_signal_id
            row["recording_id"] = win.recording_id
            row["house_id"] = win.house_id
            row["window_type"] = win.window_type
            row["sampling_rate_hz"] = win.sampling_rate_hz

            rows.append(row)
            labels.append(win.appliance_label)

        df = pd.DataFrame(rows)
        y = pd.Series(labels, name="appliance_label")

        # Sanity check: replace any possible infinite or NaN values with 0.0
        feature_cols = [col for col in df.columns if col not in self.METADATA_COLUMNS]
        df[feature_cols] = df[feature_cols].fillna(0.0)
        df[feature_cols] = df[feature_cols].replace([np.inf, -np.inf], 0.0)

        return df, y
