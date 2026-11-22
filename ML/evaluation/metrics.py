"""
Metrics calculation module (Phase 8).
"""

from typing import Dict, List


def calculate_classification_metrics(y_true: List[str], y_pred: List[str]) -> Dict[str, float]:
    """Computes basic classification metrics."""
    correct = sum(1 for yt, yp in zip(y_true, y_pred) if yt == yp)
    total = max(1, len(y_true))
    return {
        "accuracy": correct / total,
        "sample_count": float(len(y_true)),
    }
