"""
Evaluation package - Metrics, confusion matrix, unknown rejection, and cross-dataset testing.
"""

from .metrics import calculate_classification_metrics
from .unknown import evaluate_unknown_rejection

__all__ = ["calculate_classification_metrics", "evaluate_unknown_rejection"]
