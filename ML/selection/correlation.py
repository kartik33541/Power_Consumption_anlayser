"""
Correlation analysis and collinearity pruning engine for Phase 7.
Identifies redundant feature clusters and eliminates collinear columns using
Mutual Information and computational complexity as deterministic tie-breakers.
"""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


# Physical and embedded computational priority tiers:
# Higher priority features are preferred when correlation is high (|r| >= threshold)
FEATURE_PRIORITY_TIERS: Dict[str, int] = {
    # Tier 4: Primary Macroscopic Physical Quantities (Rock-solid, essential)
    "elec_active_power_p": 4,
    "elec_apparent_power_s": 4,
    "elec_reactive_power_q": 4,
    "elec_distortion_power_d": 4,
    "elec_power_factor": 4,
    "elec_displacement_power_factor": 4,
    "elec_current_rms": 4,
    "elec_voltage_rms": 4,
    "elec_current_thd": 4,
    # Tier 3: VMD Sub-Band Physical Fingerprints (Normalized, highly discriminative)
    "mode_0_energy_ratio": 3,
    "mode_1_energy_ratio": 3,
    "mode_2_energy_ratio": 3,
    "mode_3_energy_ratio": 3,
    "mode_4_energy_ratio": 3,
    "vmd_fundamental_energy_ratio": 3,
    "vmd_harmonic_energy_ratio": 3,
    "mode_0_center_frequency_hz": 3,
    "mode_1_center_frequency_hz": 3,
    # Tier 2: Time-Domain Waveform Geometry
    "elec_current_crest_factor": 2,
    "elec_current_form_factor": 2,
    "transient_inrush_peak": 2,
    "transient_inrush_ratio": 2,
    "transient_ptp": 2,
    "mode_0_crest_factor": 2,
    "mode_1_crest_factor": 2,
    # Tier 1: Intermediate statistical moments
    "raw_current_skewness": 1,
    "raw_current_kurtosis": 1,
    "mode_0_skewness": 1,
    "mode_0_kurtosis": 1,
    # Default Tier for everything else is 0
}


def compute_correlation_matrix(
    df: pd.DataFrame,
    feature_names: List[str],
    method: str = "pearson",
) -> pd.DataFrame:
    """Computes pairwise correlation matrix for numerical feature columns."""
    valid_cols = [c for c in feature_names if c in df.columns]
    sub_df = df[valid_cols].astype(np.float64)
    # Replace any zero-variance column std with eps to avoid NaNs
    corr = sub_df.corr(method=method).fillna(0.0)
    return corr


def find_collinear_pairs(
    corr_matrix: pd.DataFrame,
    threshold: float = 0.90,
) -> List[Tuple[str, str, float]]:
    """
    Finds all unique pairs of features whose absolute correlation exceeds threshold.
    Returns list of (feature_1, feature_2, abs_correlation), sorted descending by correlation.
    """
    columns = list(corr_matrix.columns)
    pairs: List[Tuple[str, str, float]] = []

    for i in range(len(columns)):
        for j in range(i + 1, len(columns)):
            col1 = columns[i]
            col2 = columns[j]
            val = float(abs(corr_matrix.loc[col1, col2]))
            if val >= threshold:
                pairs.append((col1, col2, val))

    # Sort descending by correlation strength
    pairs.sort(key=lambda x: x[2], reverse=True)
    return pairs


def prune_collinear_features(
    corr_matrix: pd.DataFrame,
    feature_names: List[str],
    mi_scores: Optional[Dict[str, float]] = None,
    threshold: float = 0.90,
    mi_tiebreak_delta: float = 0.02,
) -> Tuple[List[str], List[Dict[str, Any]]]:
    """
    Prunes collinear features using a deterministic 4-step hierarchy:
      1. Mutual Information relevance difference (drop feature with lower MI if delta >= 0.02).
      2. Priority tier (prefer macroscopic power & VMD ratios over abstract moments).
      3. Lexicographical stability tie-breaker.

    Returns:
        (retained_features, drop_log)
    """
    mi = mi_scores or {}
    collinear_pairs = find_collinear_pairs(corr_matrix, threshold=threshold)

    dropped_set = set()
    drop_log: List[Dict[str, Any]] = []

    for f1, f2, r_val in collinear_pairs:
        if f1 in dropped_set or f2 in dropped_set:
            continue

        mi1 = mi.get(f1, 0.0)
        mi2 = mi.get(f2, 0.0)
        p1 = FEATURE_PRIORITY_TIERS.get(f1, 0)
        p2 = FEATURE_PRIORITY_TIERS.get(f2, 0)

        # Hierarchy Decision
        if abs(mi1 - mi2) >= mi_tiebreak_delta:
            # Significant MI difference: drop lower MI
            drop_f = f2 if mi1 > mi2 else f1
            keep_f = f1 if mi1 > mi2 else f2
            reason = f"Lower Mutual Information ({min(mi1, mi2):.4f} vs {max(mi1, mi2):.4f})"
        elif p1 != p2:
            # Priority tier difference
            drop_f = f2 if p1 > p2 else f1
            keep_f = f1 if p1 > p2 else f2
            reason = f"Lower Priority Tier ({min(p1, p2)} vs {max(p1, p2)})"
        else:
            # Equal relevance and priority: drop alphabetically second for strict determinism
            drop_f = max(f1, f2)
            keep_f = min(f1, f2)
            reason = "Deterministic alphabetical tie-breaker"

        dropped_set.add(drop_f)
        drop_log.append({
            "dropped_feature": drop_f,
            "correlated_with": keep_f,
            "correlation_r": round(r_val, 4),
            "reason": reason,
        })

    retained = [f for f in feature_names if f not in dropped_set]
    return retained, drop_log


def select_uncorrelated_features(
    X: np.ndarray,
    feature_names: List[str],
    threshold: float = 0.90,
) -> List[str]:
    """Phase 0 backward-compatible wrapper."""
    df = pd.DataFrame(X, columns=feature_names)
    corr = compute_correlation_matrix(df, feature_names)
    retained, _ = prune_collinear_features(corr, feature_names, threshold=threshold)
    return retained
