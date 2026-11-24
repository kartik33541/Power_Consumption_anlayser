"""
Tree-based feature importance and permutation importance ranking for Phase 7.
"""

from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance


def compute_tree_importance(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: List[str],
    n_estimators: int = 100,
    max_depth: int = 15,
    random_state: int = 42,
) -> Dict[str, float]:
    """
    Computes Gini feature importance (Mean Decrease in Impurity) using Random Forest.

    Returns:
        Dict mapping feature name to normalized importance score [0, 1], sorted descending.
    """
    if len(feature_names) != X.shape[1]:
        raise ValueError(f"feature_names length ({len(feature_names)}) != X columns ({X.shape[1]})")

    X_clean = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    rf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
        n_jobs=-1,
    )
    rf.fit(X_clean, y)

    importances = rf.feature_importances_
    score_dict = {name: float(score) for name, score in zip(feature_names, importances)}
    sorted_scores = dict(sorted(score_dict.items(), key=lambda item: item[1], reverse=True))
    return sorted_scores


def compute_permutation_importance(
    model: Any,
    X_val: np.ndarray,
    y_val: np.ndarray,
    feature_names: List[str],
    n_repeats: int = 5,
    random_state: int = 42,
) -> Dict[str, float]:
    """
    Computes permutation feature importance on validation data.
    Measures true drop in accuracy when a feature column is randomly shuffled.
    """
    X_clean = np.nan_to_num(X_val, nan=0.0, posinf=0.0, neginf=0.0)
    res = permutation_importance(
        model,
        X_clean,
        y_val,
        n_repeats=n_repeats,
        random_state=random_state,
        n_jobs=-1,
    )

    score_dict = {name: float(score) for name, score in zip(feature_names, res.importances_mean)}
    sorted_scores = dict(sorted(score_dict.items(), key=lambda item: item[1], reverse=True))
    return sorted_scores


def rank_feature_importance(model: Any, feature_names: List[str]) -> Dict[str, float]:
    """Phase 0 backward-compatible wrapper."""
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        return {name: float(imp) for name, imp in zip(feature_names, importances)}
    return {name: 1.0 for name in feature_names}
