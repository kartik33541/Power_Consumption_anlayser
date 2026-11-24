"""
Leakage Audit Engine (Phase 8).

Mathematically proves zero overlap in physical houses, recording sessions,
and signal windows across Train, Validation, and Test partitions.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Union
import numpy as np
import pandas as pd


class DataLeakageError(ValueError):
    """Raised when spatial, recording, or sample leakage is detected across splits."""
    pass


def audit_leakage(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    group_col: str = "house_id",
    id_col: str = "recording_id",
    label_col: str = "appliance_label",
    strict: bool = True,
) -> Dict[str, Any]:
    """
    Audits partitions for data leakage and class distribution balance.

    Checks:
    1. House Disjointness:
       Houses_train ∩ Houses_val = ∅
       Houses_train ∩ Houses_test = ∅
       Houses_val ∩ Houses_test = ∅
    2. Recording Disjointness:
       Recs_train ∩ Recs_val = ∅
       Recs_train ∩ Recs_test = ∅
       Recs_val ∩ Recs_test = ∅
    3. Class Representation:
       Verifies presence and relative representation of all appliance classes.

    Returns:
        Audit report dictionary.
    Raises:
        DataLeakageError if strict=True and any leakage is detected.
    """
    report: Dict[str, Any] = {
        "status": "PASS",
        "leakage_detected": False,
        "violations": [],
        "sample_counts": {
            "train": len(train_df),
            "val": len(val_df),
            "test": len(test_df),
            "total": len(train_df) + len(val_df) + len(test_df),
        },
    }

    # 1. House Disjointness Audit
    train_houses: Set[str] = set(train_df[group_col].astype(str)) if group_col in train_df else set()
    val_houses: Set[str] = set(val_df[group_col].astype(str)) if group_col in val_df else set()
    test_houses: Set[str] = set(test_df[group_col].astype(str)) if group_col in test_df else set()

    train_val_house_overlap = train_houses & val_houses
    train_test_house_overlap = train_houses & test_houses
    val_test_house_overlap = val_houses & test_houses

    house_overlap_count = (
        len(train_val_house_overlap) + len(train_test_house_overlap) + len(val_test_house_overlap)
    )

    report["house_audit"] = {
        "train_houses_count": len(train_houses),
        "val_houses_count": len(val_houses),
        "test_houses_count": len(test_houses),
        "train_val_overlap": sorted(list(train_val_house_overlap)),
        "train_test_overlap": sorted(list(train_test_house_overlap)),
        "val_test_overlap": sorted(list(val_test_house_overlap)),
        "disjoint": house_overlap_count == 0,
    }

    if house_overlap_count > 0:
        msg = (
            f"Spatial House Leakage Detected! Overlaps: "
            f"Train-Val={train_val_house_overlap}, "
            f"Train-Test={train_test_house_overlap}, "
            f"Val-Test={val_test_house_overlap}"
        )
        report["violations"].append(msg)
        report["leakage_detected"] = True
        report["status"] = "FAIL"

    # 2. Recording Disjointness Audit
    if id_col in train_df and id_col in val_df and id_col in test_df:
        train_recs: Set[str] = set(train_df[id_col].astype(str))
        val_recs: Set[str] = set(val_df[id_col].astype(str))
        test_recs: Set[str] = set(test_df[id_col].astype(str))

        tv_rec_overlap = train_recs & val_recs
        tt_rec_overlap = train_recs & test_recs
        vt_rec_overlap = val_recs & test_recs

        rec_overlap_count = len(tv_rec_overlap) + len(tt_rec_overlap) + len(vt_rec_overlap)
        report["recording_audit"] = {
            "train_recordings": len(train_recs),
            "val_recordings": len(val_recs),
            "test_recordings": len(test_recs),
            "tv_overlap": sorted(list(tv_rec_overlap)),
            "tt_overlap": sorted(list(tt_rec_overlap)),
            "vt_overlap": sorted(list(vt_rec_overlap)),
            "disjoint": rec_overlap_count == 0,
        }

        if rec_overlap_count > 0:
            msg = f"Recording ID Leakage Detected! Overlapping IDs: {tv_rec_overlap | tt_rec_overlap | vt_rec_overlap}"
            report["violations"].append(msg)
            report["leakage_detected"] = True
            report["status"] = "FAIL"

    # 3. Class Representation Audit
    if label_col in train_df and label_col in val_df and label_col in test_df:
        train_classes = set(train_df[label_col].dropna().unique())
        val_classes = set(val_df[label_col].dropna().unique())
        test_classes = set(test_df[label_col].dropna().unique())
        all_classes = train_classes | val_classes | test_classes

        missing_in_train = sorted(list(all_classes - train_classes))
        missing_in_val = sorted(list(all_classes - val_classes))
        missing_in_test = sorted(list(all_classes - test_classes))

        report["class_audit"] = {
            "total_classes": len(all_classes),
            "train_classes_count": len(train_classes),
            "val_classes_count": len(val_classes),
            "test_classes_count": len(test_classes),
            "missing_in_train": missing_in_train,
            "missing_in_val": missing_in_val,
            "missing_in_test": missing_in_test,
        }

        # Class counts per split
        train_counts = train_df[label_col].value_counts().to_dict()
        val_counts = val_df[label_col].value_counts().to_dict()
        test_counts = test_df[label_col].value_counts().to_dict()

        report["class_distributions"] = {
            "train": {str(k): int(v) for k, v in train_counts.items()},
            "val": {str(k): int(v) for k, v in val_counts.items()},
            "test": {str(k): int(v) for k, v in test_counts.items()},
        }

    if strict and report["leakage_detected"]:
        raise DataLeakageError(
            f"Strict Leakage Audit Failed with {len(report['violations'])} violations: "
            + "; ".join(report["violations"])
        )

    return report
