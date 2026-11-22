"""
Random Forest baseline model stub (Phase 8).
"""

from typing import Any, Dict, List, Optional
import numpy as np


class NILMRandomForest:
    """Random Forest classifier for NILM appliance fingerprinting."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.model = None
        self.classes_: List[str] = []

    def fit(self, X: np.ndarray, y: List[str]) -> "NILMRandomForest":
        self.classes_ = sorted(list(set(y)))
        return self

    def predict(self, X: np.ndarray) -> List[str]:
        if not self.classes_:
            return ["UNKNOWN"] * len(X)
        return [self.classes_[0]] * len(X)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if not self.classes_:
            return np.ones((len(X), 1))
        return np.ones((len(X), len(self.classes_))) / len(self.classes_)
