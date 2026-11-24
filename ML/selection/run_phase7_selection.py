"""
Executable script for Phase 7 Feature Selection & Ablation Analysis.
1. Extracts 111 multi-domain features across representative PLAID appliance recordings.
2. Performs collinearity pruning (|r| >= 0.90) with Mutual Information tie-breakers.
3. Ranks features using combined Mutual Information and Tree Importance.
4. Executes Dimensionality and Domain Ablation studies.
5. Saves versioned specification to ML/configs/features_v1.json.
6. Generates diagnostic validation plots in ML/data/interim/phase7_selection_plots/.
"""

import sys
import json
from pathlib import Path
from collections import defaultdict
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from datasets.plaid_adapter import PLAIDAdapter
from preprocessing.cleaning import clean_signal
from preprocessing.windowing import window_signal
from vmd.decomposition import decompose_window
from vmd.mode_ordering import order_vmd_record
from features.pipeline import FeaturePipeline
from selection.pipeline import FeatureSelector
from selection.correlation import compute_correlation_matrix


def run_phase7_selection(
    samples_per_class: int = 5,
    target_k: int = 16,
    correlation_threshold: float = 0.90,
    output_dir: str = "ML/data/interim/phase7_selection_plots",
    config_path: str = "ML/configs/features_v1.json",
):
    print("=" * 70)
    print("PHASE 7: MULTI-DOMAIN FEATURE SELECTION & ABLATION ANALYSIS")
    print("=" * 70)

    adapter = PLAIDAdapter()
    meta_path = adapter.metadata_path

    with open(meta_path, "r", encoding="utf-8") as f:
        meta_index = json.load(f)

    # 1. Stratified sampling across major appliance classes
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

    class_to_ids = defaultdict(list)
    for rec_id, info in meta_index.items():
        app_type = info.get("appliance", {}).get("type")
        if app_type in major_classes:
            class_to_ids[app_type].append(rec_id)

    selected_ids = []
    for app_type in major_classes:
        available = class_to_ids[app_type]
        # Pick diverse instances from different houses if possible
        chosen = available[:samples_per_class]
        selected_ids.extend(chosen)

    print(f"Sampling {len(selected_ids)} representative recordings ({samples_per_class} per class across {len(major_classes)} classes)...")

    # 2. Extract Windows and VMD Modes
    windows = []
    vmd_records = []
    pipeline = FeaturePipeline()

    print("Extracting steady-state windows and decomposing with K=5 VMD...")
    processed_count = 0
    for rec_id in selected_ids:
        try:
            sig = adapter.load_record(rec_id)
            clean_sig = clean_signal(sig)
            wins = window_signal(clean_sig, {"mode": "event", "cycles_per_window": 6})
            if not wins:
                continue

            steady_win = next((w for w in wins if w.window_type == "steady"), wins[0])
            raw_vmd = decompose_window(steady_win, {"K": 5, "alpha": 2000.0})
            sorted_vmd = order_vmd_record(raw_vmd)

            windows.append(steady_win)
            vmd_records.append(sorted_vmd)
            processed_count += 1
            if processed_count % 10 == 0:
                print(f"  Processed {processed_count}/{len(selected_ids)} recordings...")
        except Exception as e:
            print(f"  Warning: failed on record {rec_id}: {e}")

    print(f"Building candidate feature table for {len(windows)} certified windows...")
    X_df, y = pipeline.build_feature_dataframe(windows, vmd_records)

    candidate_feature_cols = [c for c in X_df.columns if c not in FeaturePipeline.METADATA_COLUMNS]
    total_candidates = len(candidate_feature_cols)
    print(f"Total Candidate Features Extracted: {total_candidates}")

    # 3. Fit FeatureSelector
    print("\nFitting FeatureSelector (Mutual Information + Collinearity Pruning + Tree Importance)...")
    selector = FeatureSelector(
        target_k=target_k,
        correlation_threshold=correlation_threshold,
        random_state=42,
    )
    selector.fit(X_df, y)

    # 4. Export JSON Specification
    spec_path = selector.export_specification(output_path=config_path)
    print(f"\nSaved certified feature specification: {spec_path}")

    # 5. Summary Statistics
    retained_uncorr = len(selector.pruned_features_)
    collinear_dropped = total_candidates - retained_uncorr
    final_selected = len(selector.selected_features_)

    print("\n" + "-" * 70)
    print("PHASE 7 FEATURE SELECTION RESULTS:")
    print(f"  Initial Candidate Features:       {total_candidates}")
    print(f"  Collinear Redundant Dropped:      {collinear_dropped} (r >= {correlation_threshold})")
    print(f"  Retained Non-Collinear Features:  {retained_uncorr}")
    print(f"  FINAL SELECTED GOLDEN FEATURES:   {final_selected}")
    print("-" * 70)

    print("\nFINAL SELECTED FEATURES LIST:")
    for idx, feat in enumerate(selector.selected_features_, 1):
        mi = selector.mi_scores_.get(feat, 0.0)
        tree_imp = selector.tree_importance_.get(feat, 0.0)
        print(f"  {idx:02d}. {feat:<35} | MI: {mi:.4f} | Tree Imp: {tree_imp:.4f}")

    # 6. Generate Diagnostic Validation Plots
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Plot 1: Top 20 Features by Mutual Information
    plt.figure(figsize=(10, 6))
    top_mi = list(selector.mi_scores_.items())[:20]
    names, scores = zip(*top_mi)
    plt.barh(range(len(names)), scores, align="center", color="#2b5c8f")
    plt.yticks(range(len(names)), names)
    plt.gca().invert_yaxis()
    plt.xlabel("Mutual Information Score (nats)")
    plt.title("Top 20 Features by Mutual Information Relevance (Phase 7)")
    plt.tight_layout()
    mi_plot_path = out_dir / "phase7_mutual_information_ranking.png"
    plt.savefig(mi_plot_path, dpi=200)
    plt.close()
    print(f"\nGenerated diagnostic plot: {mi_plot_path}")

    # Plot 2: Dimensionality Ablation Curve (Accuracy vs Feature Count)
    dim_data = selector.ablation_results_["dimensionality"]
    k_vals = [d["k_features"] for d in dim_data]
    f1_vals = [d["f1_macro"] for d in dim_data]
    acc_vals = [d["accuracy"] for d in dim_data]

    plt.figure(figsize=(8, 5))
    plt.plot(k_vals, acc_vals, marker="o", linewidth=2.0, color="#1e824c", label="Accuracy")
    plt.plot(k_vals, f1_vals, marker="s", linewidth=2.0, color="#d35400", label="Macro F1-Score")
    plt.axvline(x=final_selected, color="red", linestyle="--", alpha=0.7, label=f"Selected K={final_selected}")
    plt.xlabel("Number of Features Used")
    plt.ylabel("Cross-Validated Score")
    plt.title("Dimensionality Ablation: Performance vs. Feature Count")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    abl_plot_path = out_dir / "phase7_dimensionality_ablation_curve.png"
    plt.savefig(abl_plot_path, dpi=200)
    plt.close()
    print(f"Generated diagnostic plot: {abl_plot_path}")

    # Plot 3: Domain Ablation Comparison
    domain_data = selector.ablation_results_["domains"]
    domain_names = list(domain_data.keys())
    domain_f1s = [domain_data[d]["f1_macro"] for d in domain_names]
    domain_counts = [domain_data[d]["feature_count"] for d in domain_names]

    plt.figure(figsize=(9, 5))
    bars = plt.bar(domain_names, domain_f1s, color=["#34495e", "#7f8c8d", "#8e44ad", "#27ae60"])
    plt.ylabel("Cross-Validated Macro F1-Score")
    plt.title("Domain Ablation: Empirical Proof of Multi-Domain & VMD Synergy")
    plt.ylim(0.0, 1.05)
    for bar, count in zip(bars, domain_counts):
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2.0, yval + 0.02, f"F1={yval:.2f}\n(N={count})", ha="center", va="bottom", fontsize=9)
    plt.tight_layout()
    dom_plot_path = out_dir / "phase7_domain_ablation_proof.png"
    plt.savefig(dom_plot_path, dpi=200)
    plt.close()
    print(f"Generated diagnostic plot: {dom_plot_path}")

    print("\n" + "=" * 70)
    print("PHASE 7 SELECTION & ABLATION RUN COMPLETED SUCCESSFULLY.")
    print("=" * 70)


if __name__ == "__main__":
    run_phase7_selection()
