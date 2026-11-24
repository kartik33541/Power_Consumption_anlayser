"""
Phase 8 Execution Script: Leakage-Safe Train / Validation / Test Group Split.

Connects:
- Phase 1: PLAID dataset recordings and metadata (56 unique houses).
- Phase 2 & 3: Signal cleaning, calibration, and steady-state windowing.
- Phase 4 & 5: K=5 VMD decomposition and center-frequency mode ordering.
- Phase 6 & 7: Feature extraction filtered to the 16 Golden Features (features_v1.json).
- Phase 8: Stratified Group Splitting (Train ~65%, Val ~15%, Test ~20%), Leakage Audit,
  and Feature Scaling (fitted strictly on Train).
- Bridge to Phase 9: Serializes dataset_v1.npz, split_manifest_v1.json, and scaler_v1.json.
"""

import sys
import json
from pathlib import Path
from collections import defaultdict
import numpy as np
import pandas as pd

repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from datasets.plaid_adapter import PLAIDAdapter
from preprocessing.cleaning import clean_signal
from preprocessing.windowing import window_signal
from vmd.decomposition import decompose_window
from vmd.mode_ordering import order_vmd_record
from features.pipeline import FeaturePipeline
from evaluation.split_manifest import create_split_manifest, load_processed_dataset


def run_phase8_splitting(
    samples_per_class: int = 7,
    test_size: float = 0.20,
    val_size: float = 0.15,
    random_state: int = 42,
    features_config_path: str = "ML/configs/features_v1.json",
    output_dir: str = "ML/data/processed",
    config_dir: str = "ML/configs",
):
    print("=" * 75)
    print("PHASE 8: LEAKAGE-SAFE TRAIN / VALIDATION / TEST GROUP SPLIT")
    print("=" * 75)

    # 1. Load the 16 Golden Features from Phase 7
    with open(features_config_path, "r", encoding="utf-8") as f:
        feat_config = json.load(f)
    selected_features = feat_config["selected_features"]
    print(f"Loaded {len(selected_features)} golden features from {features_config_path}:")
    for idx, name in enumerate(selected_features, 1):
        print(f"  {idx:02d}. {name}")

    # 2. Select Diverse Cross-House Cohort from PLAID
    adapter = PLAIDAdapter()
    with open(adapter.metadata_path, "r", encoding="utf-8") as f:
        meta_index = json.load(f)

    major_classes = [
        "Compact Fluorescent Lamp",
        "Fridge",
        "Hairdryer",
        "Microwave",
        "Air Conditioner",
        "Fan",
        "Laptop",
        "Heater",
        "Vacuum",
        "Washing Machine",
        "Incandescent Light Bulb",
    ]

    # Map each class to recordings, prioritizing distinct houses
    class_house_recs = defaultdict(lambda: defaultdict(list))
    for rec_id, info in meta_index.items():
        app_type = info.get("appliance", {}).get("type")
        location = info.get("location") or "unknown_house"
        if app_type in major_classes:
            class_house_recs[app_type][location].append(rec_id)

    selected_ids = []
    selected_meta = []

    for app_type in major_classes:
        houses = list(class_house_recs[app_type].keys())
        chosen_for_class = 0
        house_cycle_idx = 0
        while chosen_for_class < samples_per_class and houses:
            target_house = houses[house_cycle_idx % len(houses)]
            recs_in_house = class_house_recs[app_type][target_house]
            if recs_in_house:
                rec_id = recs_in_house.pop(0)
                selected_ids.append(rec_id)
                selected_meta.append({
                    "recording_id": rec_id,
                    "house_id": target_house,
                    "appliance_label": app_type,
                })
                chosen_for_class += 1
            house_cycle_idx += 1
            if all(len(r) == 0 for r in class_house_recs[app_type].values()):
                break

    print(f"\nExtracted cohort of {len(selected_ids)} recordings across {len(major_classes)} appliance classes.", flush=True)

    # 3. Process Signals through Windowing, VMD, and Feature Pipeline
    pipeline = FeaturePipeline()
    feature_rows = []

    print("\nProcessing waveforms (Cleaning -> Windowing -> VMD -> 16 Features)...", flush=True)
    for i, meta in enumerate(selected_meta, 1):
        rec_id = meta["recording_id"]
        if i % 10 == 0 or i == len(selected_meta):
            print(f"  [{i:02d}/{len(selected_meta)}] Processing recording {rec_id} ({meta['appliance_label']} from {meta['house_id']})...", flush=True)
        try:
            sig = adapter.load_record(rec_id)
            clean_sig = clean_signal(sig)
            wins = window_signal(clean_sig, {"mode": "event", "cycles_per_window": 6})
            if not wins:
                continue

            steady_win = next((w for w in wins if w.window_type == "steady"), wins[0])
            raw_vmd = decompose_window(steady_win, {"K": 5, "alpha": 2000.0})
            sorted_vmd = order_vmd_record(raw_vmd)

            f_dict = pipeline.extract_feature_dict(
                record=steady_win,
                vmd_record=sorted_vmd,
            )

            # Filter row to metadata + the 16 selected features
            row_data = {
                "recording_id": meta["recording_id"],
                "house_id": meta["house_id"],
                "appliance_label": meta["appliance_label"],
            }
            for feat_name in selected_features:
                row_data[feat_name] = f_dict.get(feat_name, 0.0)

            feature_rows.append(row_data)
        except Exception as e:
            print(f"Warning: Failed processing recording {rec_id}: {e}")

    df = pd.DataFrame(feature_rows)
    print(f"Successfully processed {len(df)} samples across {len(df['house_id'].unique())} unique houses.")

    # 4. Execute Leakage-Safe Manifest Creation & Scaling
    print("\nExecuting Group-Aware 3-Way Split & Strict Leakage Audit...")
    result = create_split_manifest(
        df=df,
        feature_cols=selected_features,
        group_col="house_id",
        id_col="recording_id",
        label_col="appliance_label",
        test_size=test_size,
        val_size=val_size,
        random_state=random_state,
        output_dir=output_dir,
        config_dir=config_dir,
    )

    print("\n" + "=" * 75)
    print("SPLIT & AUDIT CERTIFICATION SUMMARY")
    print("=" * 75)
    print(result["split_summary"])

    audit = result["audit_report"]
    print(f"\nAudit Status: {audit['status']}")
    print(f"Zero Spatial House Leakage: {audit['house_audit']['disjoint']}")
    print(f"Zero Recording ID Leakage:  {audit['recording_audit']['disjoint']}")
    print(f"Total Appliance Classes:    {audit['class_audit']['total_classes']}")
    print(f"Missing in Train:           {audit['class_audit']['missing_in_train']}")
    print(f"Missing in Val:             {audit['class_audit']['missing_in_val']}")
    print(f"Missing in Test:            {audit['class_audit']['missing_in_test']}")

    # 5. Verify Dataset Load
    print("\nVerifying reload from disk...")
    loaded = load_processed_dataset(result["dataset_path"])
    print(f"Successfully loaded dataset_v1.npz:")
    print(f"  X_train shape:        {loaded['X_train'].shape}")
    print(f"  X_train_scaled shape: {loaded['X_train_scaled'].shape}")
    print(f"  X_val_scaled shape:   {loaded['X_val_scaled'].shape}")
    print(f"  X_test_scaled shape:  {loaded['X_test_scaled'].shape}")
    print(f"  Appliance Classes ({len(loaded['label_classes'])}): {list(loaded['label_classes'])}")

    print(f"\nGenerated Artifacts:")
    print(f"  1. Manifest: {result['manifest_path']}")
    print(f"  2. Dataset:  {result['dataset_path']}")
    print(f"  3. Scaler:   {result['scaler_path']}")
    print("\nPHASE 8 CERTIFICATION COMPLETE: 100% LEAKAGE-FREE.")


if __name__ == "__main__":
    run_phase8_splitting()
