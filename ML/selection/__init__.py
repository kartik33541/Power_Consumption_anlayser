"""
Feature selection and ablation package for NILM power consumption analysis.
Provides correlation pruning, mutual information ranking, tree importance, and ablation studies.
"""

from .correlation import (
    compute_correlation_matrix,
    find_collinear_pairs,
    prune_collinear_features,
    select_uncorrelated_features,
)
from .mutual_information import (
    compute_mutual_information,
    rank_features_by_mi,
)
from .importance import (
    compute_tree_importance,
    compute_permutation_importance,
    rank_feature_importance,
)
from .ablation import (
    evaluate_feature_subset,
    run_dimensionality_ablation,
    run_domain_ablation,
    run_ablation_study,
)
from .pipeline import FeatureSelector

__all__ = [
    "compute_correlation_matrix",
    "find_collinear_pairs",
    "prune_collinear_features",
    "select_uncorrelated_features",
    "compute_mutual_information",
    "rank_features_by_mi",
    "compute_tree_importance",
    "compute_permutation_importance",
    "rank_feature_importance",
    "evaluate_feature_subset",
    "run_dimensionality_ablation",
    "run_domain_ablation",
    "run_ablation_study",
    "FeatureSelector",
]
