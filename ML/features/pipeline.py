"""
Feature extraction pipeline.
Transforms a canonical SignalRecord and decomposed modes into a flat feature vector X.
Keeps ground-truth label Y strictly separated (Rule 4).
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from datasets.base import SignalRecord
from .time_domain import extract_time_features
from .frequency_domain import extract_frequency_features
from .electrical import extract_electrical_features


class FeaturePipeline:
    """End-to-end feature extraction pipeline for NILM classification."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    def extract_features(
        self,
        record: SignalRecord,
        modes: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, List[str]]:
        """
        Extracts all features from a SignalRecord and its decomposed modes.
        
        Returns:
            feature_vector (X): 1D array of numerical features
            feature_names: List of column names corresponding to each feature
        """
        feature_dict: Dict[str, float] = {}

        # 1. Electrical domain features from V and I
        elec_feats = extract_electrical_features(record)
        for k, v in elec_feats.items():
            feature_dict[f"elec_{k}"] = v

        # 2. Per-mode features (if modes provided)
        if modes is not None:
            for m_idx, mode in enumerate(modes):
                prefix = f"mode_{m_idx}_"
                t_feats = extract_time_features(mode)
                for k, v in t_feats.items():
                    feature_dict[f"{prefix}{k}"] = v

                f_feats = extract_frequency_features(mode, record.sampling_rate_hz)
                for k, v in f_feats.items():
                    feature_dict[f"{prefix}{k}"] = v

        feature_names = sorted(feature_dict.keys())
        feature_vector = np.array([feature_dict[k] for k in feature_names], dtype=np.float64)
        return feature_vector, feature_names
