"""
Variational Mode Decomposition (VMD) Engine for Phase 4.
Decomposes high-frequency current waveforms into K band-limited intrinsic oscillatory modes.
Ensures mathematical reconstruction fidelity, numerical stability, and strict provenance preservation.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple, Union
import numpy as np
from vmdpy import VMD

from datasets.base import SignalRecord, WindowRecord, VMDRecord


def compute_reconstruction_metrics(
    original: np.ndarray,
    modes: np.ndarray,
) -> Tuple[float, float]:
    """
    Computes mathematical reconstruction quality metrics.
    
    Args:
        original: 1D array of original waveform f(t).
        modes: 2D array of decomposed modes u_k(t) of shape (K, N).

    Returns:
        (reconstruction_snr_db, relative_error_norm)
    """
    recon = np.sum(modes, axis=0)
    error = original - recon

    orig_energy = float(np.sum(original ** 2))
    error_energy = float(np.sum(error ** 2))

    if orig_energy < 1e-10:
        # Near-zero or silent signal
        return (100.0, 0.0)

    snr_db = 10.0 * np.log10(orig_energy / (error_energy + 1e-12))
    rel_error = float(np.sqrt(error_energy) / (np.sqrt(orig_energy) + 1e-12))

    return (float(snr_db), float(rel_error))


def compute_mode_orthogonality(modes: np.ndarray) -> np.ndarray:
    """
    Computes the K x K cross-correlation / overlap matrix between modes.
    Diagonal elements are 1.0; off-diagonal elements indicate spectral/temporal overlap.
    """
    K = modes.shape[0]
    corr_matrix = np.zeros((K, K), dtype=np.float64)

    norms = np.sqrt(np.sum(modes ** 2, axis=1))

    for i in range(K):
        for j in range(K):
            denom = norms[i] * norms[j]
            if denom > 1e-12:
                corr_matrix[i, j] = float(np.abs(np.dot(modes[i], modes[j])) / denom)
            else:
                corr_matrix[i, j] = 1.0 if i == j else 0.0

    return corr_matrix


def decompose_waveform(
    signal: np.ndarray,
    sampling_rate_hz: float,
    K: int = 5,
    alpha: float = 2000.0,
    tau: float = 0.0,
    DC: int = 0,
    init: int = 1,
    tol: float = 1e-7,
) -> Tuple[np.ndarray, np.ndarray, float, float]:
    """
    Decomposes a 1D current waveform into K intrinsic oscillatory modes using VMD.

    Args:
        signal: 1D NumPy array representing current waveform.
        sampling_rate_hz: Sampling frequency in Hz.
        K: Number of modes.
        alpha: Bandwidth constraint (penalty factor).
        tau: Dual ascent time-step (0 for strict fidelity).
        DC: Retention of DC component (0 = omit).
        init: Initialization of central frequencies (1 = uniform).
        tol: Convergence tolerance.

    Returns:
        (modes, center_frequencies_hz, reconstruction_snr_db, relative_error_norm)
    """
    if signal is None or len(signal) == 0:
        raise ValueError("Cannot perform VMD on empty or None waveform.")

    sig_float = np.asarray(signal, dtype=np.float64)
    if sig_float.ndim != 1:
        raise ValueError(f"Waveform must be 1-dimensional, got ndim={sig_float.ndim}")

    if bool(np.isnan(sig_float).any()) or bool(np.isinf(sig_float).any()):
        raise ValueError("Cannot perform VMD on waveform containing NaNs or Infs.")

    # Guard against completely flat zero signals
    ptp = float(np.ptp(sig_float))
    if ptp < 1e-6:
        N = len(sig_float)
        modes = np.zeros((K, N), dtype=np.float64)
        center_freqs = np.linspace(60.0, sampling_rate_hz / 4.0, K, dtype=np.float64)
        return (modes, center_freqs, 100.0, 0.0)

    # Call core VMD optimization engine
    u, u_hat, omega = VMD(sig_float, alpha, tau, K, DC, init, tol)

    modes = np.asarray(u, dtype=np.float64)

    # In vmdpy, omega has shape (iterations, K) with values in normalized frequency [0, 0.5]
    # Physical frequency in Hz is omega[-1] * sampling_rate_hz
    final_omega = omega[-1] if omega.ndim == 2 else omega
    center_freqs_hz = np.asarray(final_omega * sampling_rate_hz, dtype=np.float64)

    # Calculate reconstruction fidelity metrics
    snr_db, rel_error = compute_reconstruction_metrics(sig_float, modes)

    return (modes, center_freqs_hz, snr_db, rel_error)


def decompose_window(
    window: WindowRecord,
    config: Optional[Dict[str, Any]] = None,
) -> VMDRecord:
    """
    Decomposes the current waveform of a WindowRecord into a certified VMDRecord.
    Preserves complete provenance (house_id, recording_id, window_type, label).
    """
    if window.current is None:
        raise ValueError(f"WindowRecord '{window.window_id}' contains no current waveform.")

    cfg = config or {}
    K = cfg.get("K", 5)
    if "alpha" in cfg:
        alpha = cfg["alpha"]
    else:
        # Adaptive bandwidth penalty: transients need wider bandwidth (lower alpha)
        alpha = cfg.get("alpha_transient", 500.0) if window.window_type == "transient" else cfg.get("alpha", 2000.0)
    tau = cfg.get("tau", 0.1)
    DC = cfg.get("DC", 0)
    init = cfg.get("init", 1)
    tol = cfg.get("tol", 1e-7)

    modes, center_freqs, snr_db, rel_error = decompose_waveform(
        signal=window.current,
        sampling_rate_hz=window.sampling_rate_hz,
        K=K,
        alpha=alpha,
        tau=tau,
        DC=DC,
        init=init,
        tol=tol,
    )

    metadata = dict(window.metadata)
    metadata["vmd_params"] = {
        "K": K,
        "alpha": alpha,
        "tau": tau,
        "DC": DC,
        "init": init,
        "tol": tol,
    }

    return VMDRecord(
        record_id=f"{window.window_id}_vmd",
        parent_window_id=window.window_id,
        parent_signal_id=window.parent_signal_id,
        recording_id=window.recording_id,
        source_dataset=window.source_dataset,
        house_id=window.house_id,
        sampling_rate_hz=window.sampling_rate_hz,
        window_type=window.window_type,
        K=K,
        modes=modes,
        center_frequencies_hz=center_freqs,
        reconstruction_snr_db=round(snr_db, 2),
        reconstruction_error_norm=round(rel_error, 5),
        appliance_label=window.appliance_label,
        appliance_instance_id=window.appliance_instance_id,
        metadata=metadata,
    )


def run_vmd(
    record: Union[SignalRecord, WindowRecord],
    K: int = 5,
    alpha: float = 2000.0,
    tau: float = 0.0,
    DC: int = 0,
    init: int = 1,
    tol: float = 1e-7,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    General-purpose VMD interface for SignalRecords and WindowRecords.
    Backward-compatible with Phase 0 test harness.
    """
    if record.current is None:
        raise ValueError("Cannot perform VMD on a record without current waveform.")

    modes, center_freqs, _, _ = decompose_waveform(
        signal=record.current,
        sampling_rate_hz=record.sampling_rate_hz,
        K=K,
        alpha=alpha,
        tau=tau,
        DC=DC,
        init=init,
        tol=tol,
    )
    return modes, center_freqs
