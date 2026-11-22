"""
Mode ordering module.
Ensures consistent physical ordering of VMD modes across different appliances.
"""

from typing import Tuple
import numpy as np


def order_modes(
    modes: np.ndarray,
    center_frequencies: np.ndarray,
    rule: str = "center_frequency",
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Sorts modes either by ascending center frequency or descending energy.
    """
    if rule == "center_frequency":
        idx = np.argsort(center_frequencies)
    elif rule == "energy":
        energies = np.sum(modes ** 2, axis=1)
        idx = np.argsort(-energies)
    else:
        raise ValueError(f"Unknown mode ordering rule: {rule}")

    return modes[idx], center_frequencies[idx]
