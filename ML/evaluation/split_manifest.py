"""
Split Manifest and Dataset Serialization (Phase 8).

Orchestrates:
1. Feature matrix assembly aligned with ML/configs/features_v1.json (16 golden features).
2. Leakage-safe group partitioning by house_id (Train ~65%, Val ~15%, Test ~20%).
3. Strict zero-leakage mathematical audit.
4. Leakage-safe scaling (fitted strictly on Train).
5. Serialization to ML/data/processed/split_manifest_v1.json, dataset_v1.npz, and scaler_v1.json.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from .splitting import LeakageSafeSplitter, SplitResult
from .audit_leakage import audit_leakage
from .scaling import LeakageSafeScaler


def create_split_manifest(
    df: pd.DataFrame,
    feature_cols: List[str],
    group_col: str = "house_id",
    id_col: str = "recording_id",
    label_col: str = "appliance_label",
    test_size: float = 0.20,
    val_size: float = 0.15,
    random_state: int = 42,
    output_dir: Union[str, Path] = "ML/data/processed",
    config_dir: Union[str, Path] = "ML/configs",
) -> Dict[str, Any]:
    """
    Creates leakage-safe splits, audits them, scales features, and saves artifacts to disk.

    Outputs:
    - {output_dir}/split_manifest_v1.json
    - {output_dir}/dataset_v1.npz
    - {config_dir}/scaler_v1.json

    Returns:
        Summary dict containing split metrics and artifact paths.
    """
    out_dir = Path(output_dir)
    cfg_dir = Path(config_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    cfg_dir.mkdir(parents=True, exist_ok=True)

    # 1. Validate columns
    missing_feats = [col for col in feature_cols if col not in df.columns]
    if missing_feats:
        raise KeyError(f"Missing {len(missing_feats)} features in dataframe: {missing_feats[:5]}")

    for col in [group_col, id_col, label_col]:
        if col not in df.columns:
            raise KeyError(f"Required column '{col}' not found in dataframe.")

    # 2. Execute Group-Aware 3-Way Split
    splitter = LeakageSafeSplitter(
        group_col=group_col,
        label_col=label_col,
        test_size=test_size,
        val_size=val_size,
        random_state=random_state,
    )
    split_res: SplitResult = splitter.split(df)

    train_df = df.iloc[split_res.train_indices].copy().reset_index(drop=True)
    val_df = df.iloc[split_res.val_indices].copy().reset_index(drop=True)
    test_df = df.iloc[split_res.test_indices].copy().reset_index(drop=True)

    # 3. Strict Leakage Audit
    audit_report = audit_leakage(
        train_df=train_df,
        val_df=val_df,
        test_df=test_df,
        group_col=group_col,
        id_col=id_col,
        label_col=label_col,
        strict=True,
    )

    # 4. Feature Matrices & Target Labels
    X_train_raw = train_df[feature_cols].values.astype(np.float64)
    X_val_raw = val_df[feature_cols].values.astype(np.float64)
    X_test_raw = test_df[feature_cols].values.astype(np.float64)

    y_train_raw = train_df[label_col].values.astype(str)
    y_val_raw = val_df[label_col].values.astype(str)
    y_test_raw = test_df[label_col].values.astype(str)

    # String-to-integer label encoding for models
    unique_labels = sorted(list(set(df[label_col].unique())))
    label_to_idx = {lbl: idx for idx, lbl in enumerate(unique_labels)}
    idx_to_label = {idx: lbl for idx, lbl in enumerate(unique_labels)}

    y_train_idx = np.array([label_to_idx[lbl] for lbl in y_train_raw], dtype=np.int64)
    y_val_idx = np.array([label_to_idx[lbl] for lbl in y_val_raw], dtype=np.int64)
    y_test_idx = np.array([label_to_idx[lbl] for lbl in y_test_raw], dtype=np.int64)

    # 5. Fit Scaler STRICTLY on Train
    scaler = LeakageSafeScaler()
    scaler.fit(X_train_raw, feature_names=feature_cols)

    X_train_scaled = scaler.transform(X_train_raw)
    X_val_scaled = scaler.transform(X_val_raw)
    X_test_scaled = scaler.transform(X_test_raw)

    scaler_path = cfg_dir / "scaler_v1.json"
    scaler.export_json(scaler_path)

    # 6. Save Processed Dataset (NPZ archive)
    dataset_npz_path = out_dir / "dataset_v1.npz"
    np.savez_compressed(
        dataset_npz_path,
        X_train=X_train_raw,
        X_val=X_val_raw,
        X_test=X_test_raw,
        X_train_scaled=X_train_scaled,
        X_val_scaled=X_val_scaled,
        X_test_scaled=X_test_scaled,
        y_train=y_train_idx,
        y_val=y_val_idx,
        y_test=y_test_idx,
        y_train_labels=y_train_raw,
        y_val_labels=y_val_raw,
        y_test_labels=y_test_raw,
        feature_names=np.array(feature_cols),
        label_classes=np.array(unique_labels),
    )

    # 7. Build and Export Manifest JSON
    manifest_records = []
    for split_name, sub_df in [("train", train_df), ("val", val_df), ("test", test_df)]:
        for _, row in sub_df.iterrows():
            manifest_records.append({
                "recording_id": str(row[id_col]),
                "house_id": str(row[group_col]),
                "appliance_label": str(row[label_col]),
                "split": split_name,
            })

    manifest_json_path = out_dir / "split_manifest_v1.json"
    manifest_payload = {
        "version": "1.0.0",
        "phase": "Phase 8 \u2014 Leakage-Safe Train / Validation / Test Group Split",
        "description": "Deterministic group-aware 3-way split grouped by house_id",
        "config": {
            "group_col": group_col,
            "id_col": id_col,
            "label_col": label_col,
            "test_size": test_size,
            "val_size": val_size,
            "random_state": random_state,
        },
        "statistics": {
            "total_samples": len(df),
            "train_samples": len(train_df),
            "val_samples": len(val_df),
            "test_samples": len(test_df),
            "total_houses": len(df[group_col].unique()),
            "train_houses": split_res.train_houses,
            "val_houses": split_res.val_houses,
            "test_houses": split_res.test_houses,
        },
        "audit_report": audit_report,
        "feature_specification": {
            "feature_count": len(feature_cols),
            "features": feature_cols,
        },
        "artifacts": {
            "dataset_npz": str(dataset_npz_path),
            "scaler_json": str(scaler_path),
        },
        "records": manifest_records,
    }

    with open(manifest_json_path, "w", encoding="utf-8") as f:
        json.dump(manifest_payload, f, indent=2)

    return {
        "status": "SUCCESS",
        "manifest_path": str(manifest_json_path),
        "dataset_path": str(dataset_npz_path),
        "scaler_path": str(scaler_path),
        "split_summary": split_res.summary(),
        "audit_report": audit_report,
    }


def load_processed_dataset(dataset_path: Union[str, Path] = "ML/data/processed/dataset_v1.npz") -> Dict[str, Any]:
    """
    Loads pre-processed numpy arrays ready for Phase 9 baseline modeling.
    """
    path = Path(dataset_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset archive not found: {path}")

    data = np.load(path, allow_pickle=True)
    return {
        "X_train": data["X_train"],
        "X_val": data["X_val"],
        "X_test": data["X_test"],
        "X_train_scaled": data["X_train_scaled"],
        "X_val_scaled": data["X_val_scaled"],
        "X_test_scaled": data["X_test_scaled"],
        "y_train": data["y_train"],
        "y_val": data["y_val"],
        "y_test": data["y_test"],
        "y_train_labels": data["y_train_labels"],
        "y_val_labels": data["y_val_labels"],
        "y_test_labels": data["y_test_labels"],
        "feature_names": list(data["feature_names"]),
        "label_classes": list(data["label_classes"]),
    }
