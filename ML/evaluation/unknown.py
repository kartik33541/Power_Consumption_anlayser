"""
Unknown / rejection class evaluation module (Phase 9).
Rejects predictions when maximum class probability falls below threshold.
"""

from typing import List, Tuple
import numpy as np


def evaluate_unknown_rejection(
    probabilities: np.ndarray,
    classes: List[str],
    threshold: float = 0.60,
) -> Tuple[List[str], List[float]]:
    """
    Applies rejection thresholding.
    If max probability < threshold, label is assigned 'UNKNOWN'.
    """
    predictions: List[str] = []
    confidences: List[float] = []

    for prob_row in probabilities:
        max_idx = int(np.argmax(prob_row))
        max_prob = float(prob_row[max_idx])
        confidences.append(max_prob)
        if max_prob < threshold:
            predictions.append("UNKNOWN")
        else:
            predictions.append(classes[max_idx])

    return predictions, confidences
