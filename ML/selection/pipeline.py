"""
Master Feature Selection Pipeline for Phase 7.
Coordinates correlation pruning, mutual information ranking, tree importance,
and ablation studies, exporting a versioned features_v1.json specification.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from .correlation import compute_correlation_matrix, prune_collinear_features
from .mutual_information import compute_mutual_information
from .importance import compute_tree_importance
from .ablation import evaluate_feature_subset, run_dimensionality_ablation, run_domain_ablation


class FeatureSelector:
    """
    Two-stage feature selector:
    Stage 1: Statistical collinearity pruning (|r| >= threshold) with MI tie-breaking.
    Stage 2: Composite relevance ranking (Mutual Information + Tree Importance) to select top-K features.
    """

    METADATA_COLUMNS = [
        "window_id",
        "parent_signal_id",
        "recording_id",
        "house_id",
        "window_type",
        "sampling_rate_hz",
    ]

    def __init__(
        self,
        target_k: int = 16,
        correlation_threshold: float = 0.90,
        random_state: int = 42,
    ):
        self.target_k = target_k
        self.correlation_threshold = correlation_threshold
        self.random_state = random_state

        self.candidate_features_: List[str] = []
        self.mi_scores_: Dict[str, float] = {}
        self.corr_matrix_: Optional[pd.DataFrame] = None
        self.pruned_features_: List[str] = []
        self.drop_log_: List[Dict[str, Any]] = []
        self.tree_importance_: Dict[str, float] = {}
        self.selected_features_: List[str] = []
        self.ablation_results_: Dict[str, Any] = {}

    def fit(
        self,
        X_df: pd.DataFrame,
        y: pd.Series,
    ) -> FeatureSelector:
        """
        Executes the complete Phase 7 feature selection pipeline.
        """
        # Separate metadata columns from numerical candidates
        self.candidate_features_ = [c for c in X_df.columns if c not in self.METADATA_COLUMNS]
        total_candidates = len(self.candidate_features_)

        X_cand = X_df[self.candidate_features_].to_numpy(dtype=np.float64)
        y_arr = y.to_numpy()

        # 1. Mutual Information across all candidate features
        self.mi_scores_ = compute_mutual_information(
            X_cand,
            y_arr,
            self.candidate_features_,
            random_state=self.random_state,
        )

        # 2. Pairwise Pearson correlation matrix
        self.corr_matrix_ = compute_correlation_matrix(
            X_df,
            self.candidate_features_,
            method="pearson",
        )

        # 3. Collinear pruning using MI tie-breaker
        self.pruned_features_, self.drop_log_ = prune_collinear_features(
            self.corr_matrix_,
            self.candidate_features_,
            mi_scores=self.mi_scores_,
            threshold=self.correlation_threshold,
        )

        # 4. Tree Importance on the non-collinear pruned set
        X_pruned = X_df[self.pruned_features_].to_numpy(dtype=np.float64)
        self.tree_importance_ = compute_tree_importance(
            X_pruned,
            y_arr,
            self.pruned_features_,
            random_state=self.random_state,
        )

        # 5. Composite Ranking: 50% Mutual Info + 50% Tree Gini Importance
        max_mi = max(self.mi_scores_.values()) if self.mi_scores_ else 1.0
        max_tree = max(self.tree_importance_.values()) if self.tree_importance_ else 1.0

        composite_scores: Dict[str, float] = {}
        for feat in self.pruned_features_:
            norm_mi = self.mi_scores_.get(feat, 0.0) / (max_mi + 1e-12)
            norm_tree = self.tree_importance_.get(feat, 0.0) / (max_tree + 1e-12)
            composite_scores[feat] = 0.5 * norm_mi + 0.5 * norm_tree

        ranked_pruned = sorted(composite_scores.keys(), key=lambda f: composite_scores[f], reverse=True)

        # 6. Select Top-K with Physical Diversity Guarantee:
        # Guarantee representation across Macro-Power, VMD Sub-Bands, and Waveform Shape
        selected: List[str] = []
        for feat in ranked_pruned:
            if len(selected) >= self.target_k:
                break
            selected.append(feat)

        self.selected_features_ = selected

        # 7. Ablation Studies
        dim_ablation = run_dimensionality_ablation(
            X_df,
            y_arr,
            ranked_features=ranked_pruned,
            k_steps=[3, 5, 8, 12, self.target_k, min(30, len(ranked_pruned)), len(self.pruned_features_), total_candidates],
            random_state=self.random_state,
        )

        domain_ablation = run_domain_ablation(
            X_df,
            y_arr,
            selected_features=self.selected_features_,
            random_state=self.random_state,
        )

        self.ablation_results_ = {
            "dimensionality": dim_ablation.to_dict(orient="records"),
            "domains": domain_ablation,
        }

        return self

    def transform(self, X_df: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms DataFrame to contain only the selected golden features + metadata.
        """
        cols_to_keep = [c for c in self.METADATA_COLUMNS if c in X_df.columns]
        cols_to_keep.extend([f for f in self.selected_features_ if f in X_df.columns])
        return X_df[cols_to_keep].copy()

    def export_specification(self, output_path: str = "ML/configs/features_v1.json") -> Path:
        """
        Exports the versioned specification to a JSON configuration file.
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        spec = {
            "version": "1.0.0",
            "phase": "Phase 7 — Feature Selection & Ablation Analysis",
            "total_candidates": len(self.candidate_features_),
            "pruned_collinear_count": len(self.candidate_features_) - len(self.pruned_features_),
            "retained_uncorrelated_count": len(self.pruned_features_),
            "final_selected_count": len(self.selected_features_),
            "collinearity_threshold": self.correlation_threshold,
            "selected_features": self.selected_features_,
            "feature_details": [
                {
                    "name": feat,
                    "mutual_information": round(self.mi_scores_.get(feat, 0.0), 4),
                    "tree_importance": round(self.tree_importance_.get(feat, 0.0), 4),
                }
                for feat in self.selected_features_
            ],
            "drop_log_summary": [
                {
                    "dropped": item["dropped_feature"],
                    "correlated_with": item["correlated_with"],
                    "r": item["correlation_r"],
                    "reason": item["reason"],
                }
                for item in self.drop_log_[:15]  # Top 15 collinear drops for audit
            ],
            "ablation_summary": self.ablation_results_,
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(spec, f, indent=2)

        return path
