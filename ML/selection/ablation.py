"""
Feature ablation study engine for Phase 7.
Evaluates cross-validated classification performance across varying feature subset sizes
and isolated physical domains (Power vs. Waveform Shape vs. VMD).
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import StratifiedKFold


def evaluate_feature_subset(
    X_df: pd.DataFrame,
    y: np.ndarray,
    feature_subset: List[str],
    cv_splits: int = 5,
    random_state: int = 42,
) -> Dict[str, float]:
    """
    Evaluates cross-validated Macro-F1 and Accuracy for a specific feature subset.
    """
    valid_cols = [c for c in feature_subset if c in X_df.columns]
    if len(valid_cols) == 0:
        return {
            "accuracy_mean": 0.0,
            "accuracy_std": 0.0,
            "f1_macro_mean": 0.0,
            "f1_macro_std": 0.0,
        }

    X = X_df[valid_cols].to_numpy(dtype=np.float64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    # Encode y if strings
    classes, y_encoded = np.unique(y, return_inverse=True)

    # Check minimum class frequency for stratified k-fold
    counts = np.bincount(y_encoded)
    min_count = int(np.min(counts)) if len(counts) > 0 else 0
    actual_splits = max(2, min(cv_splits, min_count)) if min_count >= 2 else 2

    skf = StratifiedKFold(n_splits=actual_splits, shuffle=True, random_state=random_state)
    accs: List[float] = []
    f1s: List[float] = []

    for train_idx, val_idx in skf.split(X, y_encoded):
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y_encoded[train_idx], y_encoded[val_idx]

        clf = RandomForestClassifier(
            n_estimators=60,
            max_depth=12,
            random_state=random_state,
            n_jobs=-1,
        )
        clf.fit(X_train, y_train)
        y_pred = clf.predict(X_val)

        accs.append(float(accuracy_score(y_val, y_pred)))
        f1s.append(float(f1_score(y_val, y_pred, average="macro", zero_division=0)))

    return {
        "accuracy_mean": float(np.mean(accs)),
        "accuracy_std": float(np.std(accs)),
        "f1_macro_mean": float(np.mean(f1s)),
        "f1_macro_std": float(np.std(f1s)),
    }


def run_dimensionality_ablation(
    X_df: pd.DataFrame,
    y: np.ndarray,
    ranked_features: List[str],
    k_steps: Optional[List[int]] = None,
    cv_splits: int = 5,
    random_state: int = 42,
) -> pd.DataFrame:
    """
    Evaluates performance across progressively larger feature subsets K.
    Demonstrates the accuracy saturation and overfitting curve.
    """
    total_feats = len(ranked_features)
    if k_steps is None:
        default_steps = [3, 5, 10, 15, 20, 30, 45, 60, total_feats]
        k_steps = sorted(list(set([k for k in default_steps if k <= total_feats])))

    records: List[Dict[str, Any]] = []
    for k in k_steps:
        sub = ranked_features[:k]
        metrics = evaluate_feature_subset(
            X_df=X_df,
            y=y,
            feature_subset=sub,
            cv_splits=cv_splits,
            random_state=random_state,
        )
        records.append({
            "k_features": k,
            "accuracy": round(metrics["accuracy_mean"], 4),
            "f1_macro": round(metrics["f1_macro_mean"], 4),
            "accuracy_std": round(metrics["accuracy_std"], 4),
            "features_used": sub,
        })

    return pd.DataFrame(records)


def run_domain_ablation(
    X_df: pd.DataFrame,
    y: np.ndarray,
    selected_features: List[str],
    cv_splits: int = 5,
    random_state: int = 42,
) -> Dict[str, Dict[str, float]]:
    """
    Domain ablation study: proves the empirical value of VMD sub-bands
    compared to traditional power-only and shape-only feature groups.
    """
    # 1. Macro Power Domain
    power_cols = [c for c in X_df.columns if c.startswith("elec_active") or c.startswith("elec_reactive") or c.startswith("elec_apparent") or c.startswith("elec_power_factor")]
    # 2. Waveform Shape Domain
    shape_cols = [c for c in X_df.columns if "crest" in c or "form" in c or "skewness" in c or "kurtosis" in c]
    # 3. VMD Sub-Band Domain
    vmd_cols = [c for c in X_df.columns if c.startswith("mode_") or c.startswith("vmd_")]
    # 4. Multi-Domain Elite (Selected in Phase 7)
    elite_cols = selected_features

    domains = {
        "1_Power_Only": power_cols,
        "2_Shape_Only": shape_cols,
        "3_VMD_Only": vmd_cols,
        "4_MultiDomain_Elite": elite_cols,
    }

    results: Dict[str, Dict[str, float]] = {}
    for name, cols in domains.items():
        res = evaluate_feature_subset(X_df, y, cols, cv_splits=cv_splits, random_state=random_state)
        results[name] = {
            "feature_count": len(cols),
            "accuracy": round(res["accuracy_mean"], 4),
            "f1_macro": round(res["f1_macro_mean"], 4),
        }

    return results


def run_ablation_study(feature_sets: Dict[str, List[str]], X: Any, y: Any) -> Dict[str, float]:
    """Phase 0 backward-compatible wrapper."""
    if not isinstance(X, pd.DataFrame):
        X = pd.DataFrame(X)
    results = {}
    for name, cols in feature_sets.items():
        eval_res = evaluate_feature_subset(X, y, cols)
        results[name] = eval_res.get("f1_macro_mean", 1.0)
    return results
