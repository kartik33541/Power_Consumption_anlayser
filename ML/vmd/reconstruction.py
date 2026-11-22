"""
Reconstruction error analysis for VMD.
Computes SNR and reconstruction fidelity between original current and mode sum.
"""

from typing import Dict
import numpy as np


def verify_reconstruction(original: np.ndarray, modes: np.ndarray) -> Dict[str, float]:
    """
    Computes reconstruction error metrics.
    """
    reconstructed = np.sum(modes, axis=0)
    error = original - reconstructed
    orig_energy = float(np.sum(original ** 2))
    err_energy = float(np.sum(error ** 2))

    snr_db = 10.0 * np.log10(orig_energy / (err_energy + 1e-12)) if err_energy > 0 else 999.0
    relative_error = np.sqrt(err_energy / (orig_energy + 1e-12))

    return {
        "snr_db": float(snr_db),
        "relative_error": float(relative_error),
    }
