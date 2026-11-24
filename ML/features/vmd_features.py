"""
VMD sub-band feature extraction for consistently sorted VMDRecord objects.
Extracts per-mode energy distributions, mode energy ratios, cross-mode ratios,
and reconstruction fidelity features.
"""

from typing import Any, Dict, List, Optional
import numpy as np
from datasets.base import VMDRecord
from .time_domain import extract_time_features
from .frequency_domain import extract_frequency_features


def extract_vmd_features(
    vmd_record: VMDRecord,
    sampling_rate_hz: float,
    eps: float = 1e-12,
) -> Dict[str, float]:
    """
    Extracts multi-scale physical features from a sorted VMDRecord.

    Features computed per mode (k = 0 .. K-1):
      - mode_{k}_energy: Absolute energy sum(u_k^2)
      - mode_{k}_energy_ratio: Relative energy E_k / sum(E_j) (sum is 1.0)
      - mode_{k}_rms: Root Mean Square of mode
      - mode_{k}_peak_to_peak: Peak-to-peak amplitude
      - mode_{k}_crest_factor: Crest factor of mode
      - mode_{k}_form_factor: Form factor of mode
      - mode_{k}_skewness: Mode shape asymmetry
      - mode_{k}_kurtosis: Mode spikiness
      - mode_{k}_center_frequency_hz: Converged center frequency
      - mode_{k}_spectral_centroid: Spectral centroid of mode
      - mode_{k}_spectral_spread: Bandwidth/spread of mode

    Cross-mode summary features:
      - vmd_fundamental_energy_ratio: Ratio in Mode 0 (grid frequency component)
      - vmd_harmonic_energy_ratio: Ratio in Modes 1..K-1 (harmonic/non-linear component)
      - vmd_reconstruction_snr_db: Mathematical reconstruction SNR [dB]
      - vmd_reconstruction_rel_error: Relative reconstruction error
      - vmd_mode_clash_detected: Flag 1.0 if frequency collision was detected, else 0.0
    """
    if vmd_record.modes is None or len(vmd_record.modes) == 0:
        return {}

    modes = np.asarray(vmd_record.modes, dtype=np.float64)
    k_modes, n_samples = modes.shape

    # 1. Compute energies for all modes
    mode_energies = np.array([float(np.sum(modes[k] ** 2)) for k in range(k_modes)], dtype=np.float64)
    total_energy = float(np.sum(mode_energies))

    if total_energy < 1e-9:
        energy_ratios = np.zeros(k_modes, dtype=np.float64)
    else:
        energy_ratios = mode_energies / (total_energy + eps)

    features: Dict[str, float] = {}

    # 2. Per-mode feature extraction
    center_freqs = vmd_record.center_frequencies_hz if vmd_record.center_frequencies_hz is not None else []
    for k in range(k_modes):
        prefix = f"mode_{k}_"
        mode_sig = modes[k]

        # Time-domain metrics for this mode
        t_feats = extract_time_features(mode_sig, eps=eps)
        for name in ("rms", "variance", "peak_to_peak", "crest_factor", "form_factor", "skewness", "kurtosis"):
            features[f"{prefix}{name}"] = t_feats.get(name, 0.0)

        # Mode energy and normalized ratio
        features[f"{prefix}energy"] = float(mode_energies[k])
        features[f"{prefix}energy_ratio"] = float(energy_ratios[k])

        # Frequency-domain spectral metrics
        f_feats = extract_frequency_features(mode_sig, sampling_rate_hz=sampling_rate_hz, eps=eps)
        features[f"{prefix}spectral_centroid"] = f_feats.get("spectral_centroid", 0.0)
        features[f"{prefix}spectral_spread"] = f_feats.get("spectral_spread", 0.0)

        # Converged center frequency from VMD
        cf = float(center_freqs[k]) if k < len(center_freqs) else f_feats.get("dominant_frequency", 0.0)
        features[f"{prefix}center_frequency_hz"] = cf

    # 3. Cross-mode physical summary ratios
    fund_ratio = float(energy_ratios[0]) if k_modes > 0 else 0.0
    harm_ratio = float(np.sum(energy_ratios[1:])) if k_modes > 1 else 0.0

    features["vmd_fundamental_energy_ratio"] = fund_ratio
    features["vmd_harmonic_energy_ratio"] = harm_ratio

    # 4. Reconstruction metrics from Phase 4/5
    snr_db = float(vmd_record.reconstruction_snr_db) if vmd_record.reconstruction_snr_db is not None else 0.0
    rel_err = float(getattr(vmd_record, "reconstruction_error_norm", getattr(vmd_record, "reconstruction_error", 0.0)))
    clash_detected = 1.0 if vmd_record.metadata.get("mode_ordering", {}).get("mode_clash_detected", False) else 0.0

    features["vmd_reconstruction_snr_db"] = snr_db
    features["vmd_reconstruction_rel_error"] = rel_err
    features["vmd_mode_clash_detected"] = clash_detected

    return features
