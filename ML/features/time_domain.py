"""
Time-domain statistical feature extraction for signal modes.
"""

from typing import Dict
import numpy as np


def extract_time_features(mode: np.ndarray) -> Dict[str, float]:
    """
    Extracts time-domain features from a 1D mode signal.
    Features: rms, variance, peak_to_peak, crest_factor, form_factor, mode_energy.
    """
    if len(mode) == 0:
        return {}

    rms = float(np.sqrt(np.mean(mode ** 2)))
    variance = float(np.var(mode))
    peak_to_peak = float(np.ptp(mode))
    peak = float(np.max(np.abs(mode)))
    mean_abs = float(np.mean(np.abs(mode)))

    crest_factor = float(peak / (rms + 1e-12))
    form_factor = float(rms / (mean_abs + 1e-12))
    energy = float(np.sum(mode ** 2))

    return {
        "rms": rms,
        "variance": variance,
        "peak_to_peak": peak_to_peak,
        "crest_factor": crest_factor,
        "form_factor": form_factor,
        "mode_energy": energy,
    }
