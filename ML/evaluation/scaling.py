"""
Leakage-Safe Scaler Module (Phase 8).

Enforces strict fitting on Training data only (z = (x - mu_train) / sigma_train).
Guarantees zero distribution leakage into Validation and Test sets.
Provides JSON serialization of mean and variance vectors for edge microcontroller deployment.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd


class LeakageSafeScaler:
    """
    Standardization scaler that prevents distribution leakage.
    Fits mu and sigma strictly on the training partition.
    """

    def __init__(self, eps: float = 1e-12):
        self.eps = eps
        self.mean_: Optional[np.ndarray] = None
        self.scale_: Optional[np.ndarray] = None
        self.var_: Optional[np.ndarray] = None
        self.feature_names_: List[str] = []
        self.n_samples_seen_: int = 0
        self.is_fitted: bool = False

    def fit(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        feature_names: Optional[List[str]] = None,
    ) -> LeakageSafeScaler:
        """
        Fits mean and standard deviation strictly on the provided training matrix.
        """
        if isinstance(X, pd.DataFrame):
            self.feature_names_ = list(X.columns)
            X_arr = X.values.astype(np.float64)
        else:
            X_arr = np.asarray(X, dtype=np.float64)
            if feature_names is not None:
                self.feature_names_ = list(feature_names)
            else:
                self.feature_names_ = [f"feat_{i}" for i in range(X_arr.shape[1])]

        if X_arr.ndim != 2:
            raise ValueError(f"Expected 2D matrix for scaling, got shape {X_arr.shape}")
        if X_arr.shape[0] < 1:
            raise ValueError("Cannot fit scaler on empty array.")

        self.mean_ = np.nanmean(X_arr, axis=0)
        self.var_ = np.nanvar(X_arr, axis=0)
        std = np.sqrt(self.var_)

        # Prevent division by zero on zero-variance / constant features
        scale = np.where(std < self.eps, 1.0, std)
        self.scale_ = scale
        self.n_samples_seen_ = X_arr.shape[0]
        self.is_fitted = True

        return self

    def transform(self, X: Union[np.ndarray, pd.DataFrame]) -> np.ndarray:
        """
        Transforms input matrix using training statistics: (X - mu_train) / sigma_train.
        """
        if not self.is_fitted or self.mean_ is None or self.scale_ is None:
            raise RuntimeError("LeakageSafeScaler must be fitted on training data before calling transform().")

        if isinstance(X, pd.DataFrame):
            X_arr = X.values.astype(np.float64)
        else:
            X_arr = np.asarray(X, dtype=np.float64)

        if X_arr.ndim != 2:
            raise ValueError(f"Expected 2D array, got shape {X_arr.shape}")
        if X_arr.shape[1] != len(self.mean_):
            raise ValueError(
                f"Feature count mismatch: scaler fitted on {len(self.mean_)} features, got {X_arr.shape[1]}"
            )

        scaled = (X_arr - self.mean_) / self.scale_
        return scaled

    def fit_transform(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        feature_names: Optional[List[str]] = None,
    ) -> np.ndarray:
        """Convenience method to fit on train and return transformed train."""
        return self.fit(X, feature_names=feature_names).transform(X)

    def inverse_transform(self, X_scaled: Union[np.ndarray, pd.DataFrame]) -> np.ndarray:
        """Reconstructs original physical units: X = X_scaled * sigma_train + mu_train."""
        if not self.is_fitted or self.mean_ is None or self.scale_ is None:
            raise RuntimeError("Scaler is not fitted.")

        if isinstance(X_scaled, pd.DataFrame):
            arr = X_scaled.values.astype(np.float64)
        else:
            arr = np.asarray(X_scaled, dtype=np.float64)

        return arr * self.scale_ + self.mean_

    def to_dict(self) -> Dict[str, Any]:
        """Serializes scaler parameters to a JSON-safe dictionary."""
        if not self.is_fitted or self.mean_ is None or self.scale_ is None:
            raise RuntimeError("Cannot export unfitted scaler.")

        return {
            "version": "1.0.0",
            "feature_names": self.feature_names_,
            "n_features": len(self.feature_names_),
            "n_samples_seen": self.n_samples_seen_,
            "mean": self.mean_.tolist(),
            "scale": self.scale_.tolist(),
            "var": self.var_.tolist() if self.var_ is not None else [],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> LeakageSafeScaler:
        """Restores a fitted scaler from parameter dictionary without pickling."""
        scaler = cls()
        scaler.feature_names_ = list(data.get("feature_names", []))
        scaler.n_samples_seen_ = int(data.get("n_samples_seen", 0))
        scaler.mean_ = np.array(data["mean"], dtype=np.float64)
        scaler.scale_ = np.array(data["scale"], dtype=np.float64)
        if "var" in data and data["var"]:
            scaler.var_ = np.array(data["var"], dtype=np.float64)
        scaler.is_fitted = True
        return scaler

    def export_json(self, filepath: Union[str, Path]) -> None:
        """Exports scaler constants to JSON file for deployment."""
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load_json(cls, filepath: Union[str, Path]) -> LeakageSafeScaler:
        """Loads fitted scaler constants from JSON file."""
        path = Path(filepath)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)
