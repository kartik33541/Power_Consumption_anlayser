"""Correlation-based feature selection stub (Phase 7)."""
from typing import List
import numpy as np

def select_uncorrelated_features(X: np.ndarray, feature_names: List[str], threshold: float = 0.90) -> List[str]:
    return list(feature_names)
