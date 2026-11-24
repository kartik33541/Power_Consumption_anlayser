"""
Frequency-domain spectral feature extraction for electrical waveforms and VMD modes.
Computes spectral centroid, spectral spread, dominant frequency, spectral flatness,
and spectral entropy.
"""

from typing import Dict
import numpy as np


def extract_frequency_features(
    signal: np.ndarray,
    sampling_rate_hz: float,
    eps: float = 1e-12,
) -> Dict[str, float]:
    """
    Extracts frequency-domain spectral features from a 1D signal.

    Features:
      - spectral_centroid: Center of mass of the spectrum [Hz]
      - spectral_spread: Standard deviation of the spectrum around the centroid [Hz]
      - dominant_frequency: Frequency bin with maximum magnitude [Hz]
      - spectral_flatness: Wiener entropy (ratio of geometric to arithmetic mean of power)
      - spectral_entropy: Normalized Shannon entropy of spectral distribution [0, 1]

    Guarantees zero NaNs/Infs on flat or zero-amplitude signals.
    """
    n = len(signal)
    if n == 0 or sampling_rate_hz <= 0:
        return {
            "spectral_centroid": 0.0,
            "spectral_spread": 0.0,
            "dominant_frequency": 0.0,
            "spectral_flatness": 0.0,
            "spectral_entropy": 0.0,
        }

    x = np.asarray(signal, dtype=np.float64)
    # Remove DC bias for spectral feature extraction
    x = x - np.mean(x)

    fft_vals = np.abs(np.fft.rfft(x))
    freqs = np.fft.rfftfreq(n, d=1.0 / sampling_rate_hz)

    total_mag = float(np.sum(fft_vals))
    if total_mag < 1e-9:
        return {
            "spectral_centroid": 0.0,
            "spectral_spread": 0.0,
            "dominant_frequency": 0.0,
            "spectral_flatness": 0.0,
            "spectral_entropy": 0.0,
        }

    # Spectral Centroid
    spectral_centroid = float(np.sum(freqs * fft_vals) / (total_mag + eps))

    # Spectral Spread (Bandwidth)
    variance_spread = np.sum(((freqs - spectral_centroid) ** 2) * fft_vals) / (total_mag + eps)
    spectral_spread = float(np.sqrt(max(0.0, variance_spread)))

    # Dominant Frequency
    dom_idx = int(np.argmax(fft_vals))
    dominant_frequency = float(freqs[dom_idx])

    # Spectral Flatness (Wiener Entropy)
    power_spectrum = (fft_vals ** 2) / (n + eps)
    geom_mean = np.exp(np.mean(np.log(power_spectrum + eps)))
    arith_mean = np.mean(power_spectrum) + eps
    spectral_flatness = float(np.clip(geom_mean / arith_mean, 0.0, 1.0))

    # Normalized Spectral Entropy
    prob_dist = fft_vals / (total_mag + eps)
    prob_dist = prob_dist[prob_dist > 0.0]
    raw_entropy = -float(np.sum(prob_dist * np.log(prob_dist + eps)))
    max_entropy = np.log(len(fft_vals)) if len(fft_vals) > 1 else 1.0
    spectral_entropy = float(np.clip(raw_entropy / (max_entropy + eps), 0.0, 1.0))

    return {
        "spectral_centroid": spectral_centroid,
        "spectral_spread": spectral_spread,
        "dominant_frequency": dominant_frequency,
        "spectral_flatness": spectral_flatness,
        "spectral_entropy": spectral_entropy,
    }
