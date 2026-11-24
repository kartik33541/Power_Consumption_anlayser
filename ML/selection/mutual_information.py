"""
Mutual Information feature relevance ranking for Phase 7.
Estimates non-parametric information gain I(X; Y) between continuous features
and discrete appliance class labels.
"""

from typing import Dict, List, Optional
import numpy as np
from sklearn.feature_selection import mutual_info_classif


def compute_mutual_information(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: List[str],
    random_state: int = 42,
    n_neighbors: int = 5,
) -> Dict[str, float]:
    """
    Computes mutual information between feature columns and class labels.

    Args:
        X: (N, D) array of feature values.
        y: (N,) array of discrete class labels (or encoded integers).
        feature_names: List of feature names corresponding to columns of X.
        random_state: Seed for reproducibility.
        n_neighbors: Number of neighbors for KNN density estimation.

    Returns:
        Dict mapping each feature name to its Mutual Information score (in nats/bits),
        sorted descending by relevance.
    """
    if len(feature_names) != X.shape[1]:
        raise ValueError(f"feature_names length ({len(feature_names)}) != X columns ({X.shape[1]})")

    # Guard against NaN/Inf values
    X_clean = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    # Encode y to integer labels if strings
    classes, y_encoded = np.unique(y, return_inverse=True)

    mi_scores = mutual_info_classif(
        X_clean,
        y_encoded,
        discrete_features=False,
        n_neighbors=n_neighbors,
        random_state=random_state,
    )

    score_dict = {name: float(score) for name, score in zip(feature_names, mi_scores)}
    # Sort descending
    sorted_scores = dict(sorted(score_dict.items(), key=lambda item: item[1], reverse=True))
    return sorted_scores


def rank_features_by_mi(
    mi_scores: Dict[str, float],
    top_k: Optional[int] = None,
) -> List[str]:
    """Returns feature names ranked in descending order of mutual information."""
    ranked = list(mi_scores.keys())
    if top_k is not None:
        ranked = ranked[:top_k]
    return ranked
