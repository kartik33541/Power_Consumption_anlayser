"""
Time-domain statistical feature extraction for electrical waveforms and VMD modes.
Computes RMS, variance, crest factor, form factor, energy, skewness, and kurtosis.
"""

from typing import Dict
import numpy as np


def extract_time_features(signal: np.ndarray, eps: float = 1e-12) -> Dict[str, float]:
    """
    Extracts time-domain geometric and higher-order statistical features from a 1D signal.

    Features:
      - rms: Root Mean Square
      - variance: Sample variance sigma^2
      - peak_to_peak: Max - Min
      - peak: Maximum absolute amplitude
      - mean_abs: Mean absolute value
      - crest_factor: Peak / RMS
      - form_factor: RMS / Mean Absolute
      - energy: Sum of squared values
      - skewness: Fisher-Pearson skewness (measure of asymmetry)
      - kurtosis: Fisher excess kurtosis (measure of peakedness/outliers, 0 for Gaussian)

    Guarantees zero NaNs/Infs on flat or zero-amplitude signals.
    """
    if len(signal) == 0:
        return {}

    x = np.asarray(signal, dtype=np.float64)
    n = len(x)

    mean_val = float(np.mean(x))
    centered = x - mean_val
    variance = float(np.mean(centered ** 2))
    std_val = float(np.sqrt(max(0.0, variance)))

    mean_sq = float(np.mean(x ** 2))
    rms = float(np.sqrt(max(0.0, mean_sq)))
    x_abs = np.abs(x)
    peak = float(np.max(x_abs))
    peak_to_peak = float(np.ptp(x))
    mean_abs = float(np.mean(x_abs))
    energy = float(np.sum(x ** 2))

    if rms < 1e-6:
        crest_factor = 0.0
        form_factor = 0.0
    else:
        crest_factor = float(peak / (rms + eps))
        form_factor = float(rms / (mean_abs + eps))

    # Higher-order statistics (Skewness and Kurtosis)
    if std_val < 1e-6:
        skewness = 0.0
        kurtosis = 0.0
    else:
        skewness = float(np.mean(centered ** 3) / ((variance ** 1.5) + eps))
        kurtosis = float((np.mean(centered ** 4) / ((variance ** 2.0) + eps)) - 3.0)

    return {
        "rms": rms,
        "variance": variance,
        "peak_to_peak": peak_to_peak,
        "peak": peak,
        "mean_abs": mean_abs,
        "crest_factor": crest_factor,
        "form_factor": form_factor,
        "energy": energy,
        "skewness": skewness,
        "kurtosis": kurtosis,
    }
