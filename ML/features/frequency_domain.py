"""
Frequency-domain spectral feature extraction for signal modes.
"""

from typing import Dict
import numpy as np


def extract_frequency_features(mode: np.ndarray, sampling_rate_hz: float) -> Dict[str, float]:
    """
    Extracts frequency-domain features from a 1D mode signal.
    Features: spectral_centroid, spectral_spread, dominant_frequency.
    """
    N = len(mode)
    if N == 0 or sampling_rate_hz <= 0:
        return {"spectral_centroid": 0.0, "dominant_frequency": 0.0}

    fft_vals = np.abs(np.fft.rfft(mode))
    freqs = np.fft.rfftfreq(N, d=1.0 / sampling_rate_hz)

    total_mag = np.sum(fft_vals)
    if total_mag < 1e-12:
        return {"spectral_centroid": 0.0, "dominant_frequency": 0.0}

    spectral_centroid = float(np.sum(freqs * fft_vals) / total_mag)
    dominant_frequency = float(freqs[np.argmax(fft_vals)])

    return {
        "spectral_centroid": spectral_centroid,
        "dominant_frequency": dominant_frequency,
    }
