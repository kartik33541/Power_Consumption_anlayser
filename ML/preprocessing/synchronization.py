"""
Synchronization module for Phase 2.
Handles zero-crossing detection with noise-rejection dead-time lockout,
fundamental grid frequency estimation, and Voltage-Current phase alignment analysis.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from datasets.base import SignalRecord


def detect_zero_crossings(
    signal: np.ndarray,
    sampling_rate_hz: float,
    direction: str = "rising",
    subsample: bool = True,
    min_distance_samples: Optional[int] = None,
) -> np.ndarray:
    """
    Detects sample indices/locations where the signal crosses zero,
    incorporating a dead-time lockout to reject high-frequency switching noise chattering.

    Args:
        signal: 1D NumPy array representing waveform.
        sampling_rate_hz: Sampling frequency in Hz.
        direction: 'rising' (neg to pos), 'falling' (pos to neg), or 'both'.
        subsample: If True, uses linear interpolation for sub-sample precision (float array).
        min_distance_samples: Minimum number of samples between consecutive detected crossings
                              (default is 0.75 * (Fs / 60) ~ 375 samples to prevent noise chattering).

    Returns:
        1D NumPy array of zero-crossing sample locations.
    """
    if signal is None or len(signal) < 2:
        return np.array([], dtype=float if subsample else int)

    if min_distance_samples is None:
        # 0.75 of a nominal 60Hz cycle at given Fs
        min_distance_samples = int(0.75 * (sampling_rate_hz / 60.0))

    s = np.signbit(signal)  # True if < 0, False if >= 0
    sign_changes = np.diff(s.astype(int))

    if direction == "rising":
        raw_indices = np.where(sign_changes == -1)[0]
    elif direction == "falling":
        raw_indices = np.where(sign_changes == 1)[0]
    elif direction == "both":
        raw_indices = np.where(sign_changes != 0)[0]
    else:
        raise ValueError(f"Unknown direction '{direction}', expected 'rising', 'falling', or 'both'")

    if len(raw_indices) == 0:
        return np.array([], dtype=float if subsample else int)

    # Apply noise-rejection lockout filter (Schmitt-trigger equivalent)
    filtered_indices = [raw_indices[0]]
    for idx in raw_indices[1:]:
        if idx - filtered_indices[-1] >= min_distance_samples:
            filtered_indices.append(idx)

    indices = np.array(filtered_indices, dtype=int)

    if not subsample or len(indices) == 0:
        return indices

    # Linear interpolation for sub-sample crossing location:
    # y[k] to y[k+1]: delta_k = -y[k] / (y[k+1] - y[k])
    y_k = signal[indices]
    y_next = signal[indices + 1]
    denom = y_next - y_k
    denom = np.where(denom == 0.0, 1e-12, denom)
    frac = -y_k / denom
    frac = np.clip(frac, 0.0, 1.0)
    subsample_crossings = indices.astype(float) + frac

    return subsample_crossings


def estimate_grid_frequency(
    record: SignalRecord,
    channel: str = "voltage",
    nominal_freq_hz: float = 60.0,
) -> Tuple[float, float, int]:
    """
    Estimates fundamental grid frequency from zero-crossings with noise lockout.

    Returns:
        (median_frequency_hz, std_frequency_hz, valid_cycle_count)
    """
    signal = record.voltage if channel == "voltage" else record.current
    if signal is None or len(signal) == 0:
        return (nominal_freq_hz, 0.0, 0)

    # Center signal for zero-crossing detection
    centered = signal - np.mean(signal)
    
    ptp = np.ptp(centered)
    if ptp < 1e-4:
        return (nominal_freq_hz, 0.0, 0)

    # Detect rising zero crossings with lockout (0.75 of nominal cycle)
    min_dist = int(0.75 * (record.sampling_rate_hz / nominal_freq_hz))
    zx = detect_zero_crossings(
        centered,
        record.sampling_rate_hz,
        direction="rising",
        subsample=True,
        min_distance_samples=min_dist,
    )
    if len(zx) < 2:
        return (nominal_freq_hz, 0.0, 0)

    # Inter-crossing cycle intervals
    cycle_samples = np.diff(zx)
    
    # Reject extreme outliers (< 0.8 cycle or > 1.2 cycles of nominal)
    nominal_samples = record.sampling_rate_hz / nominal_freq_hz
    valid_mask = (cycle_samples > 0.8 * nominal_samples) & (cycle_samples < 1.2 * nominal_samples)
    valid_cycles = cycle_samples[valid_mask]

    if len(valid_cycles) == 0:
        return (nominal_freq_hz, 0.0, len(zx) - 1)

    freqs = record.sampling_rate_hz / valid_cycles
    # Use median for robust central tendency, std for variation
    median_freq = float(np.median(freqs))
    std_freq = float(np.std(freqs))
    
    return (median_freq, std_freq, len(valid_cycles))


def compute_vi_phase_metrics(record: SignalRecord) -> Dict[str, Any]:
    """
    Computes phase relationship and zero-crossing alignment between Voltage and Current.

    Returns:
        - vi_phase_lag_deg: Current phase lag relative to Voltage in degrees (-180 to +180).
        - displacement_power_factor: cos(phi).
        - load_character: 'resistive', 'inductive', 'capacitive', or 'silent'.
    """
    if record.voltage is None or record.current is None:
        return {
            "vi_phase_lag_deg": 0.0,
            "displacement_power_factor": 1.0,
            "load_character": "unknown_channels_missing",
        }

    v_centered = record.voltage - np.mean(record.voltage)
    i_centered = record.current - np.mean(record.current)

    v_ptp = np.ptp(v_centered)
    i_ptp = np.ptp(i_centered)

    if i_ptp < 1e-3:
        return {
            "vi_phase_lag_deg": 0.0,
            "displacement_power_factor": 1.0,
            "load_character": "silent",
        }

    # Use middle 60% of signal to avoid startup switching transients
    n = len(v_centered)
    start_idx = int(0.2 * n)
    end_idx = int(0.8 * n)

    v_slice = v_centered[start_idx:end_idx]
    i_slice = i_centered[start_idx:end_idx]

    min_dist = int(0.75 * (record.sampling_rate_hz / 60.0))
    zx_v = detect_zero_crossings(
        v_slice, record.sampling_rate_hz, direction="rising", subsample=True, min_distance_samples=min_dist
    )
    zx_i = detect_zero_crossings(
        i_slice, record.sampling_rate_hz, direction="rising", subsample=True, min_distance_samples=min_dist
    )

    if len(zx_v) < 2 or len(zx_i) < 2:
        return {
            "vi_phase_lag_deg": 0.0,
            "displacement_power_factor": 1.0,
            "load_character": "insufficient_crossings",
        }

    nominal_samples_per_cycle = record.sampling_rate_hz / 60.0

    # Match each voltage zero-crossing to nearest current zero-crossing
    lags = []
    for zv in zx_v:
        diffs = zx_i - zv
        half_cycle = nominal_samples_per_cycle / 2.0
        closest_idx = np.argmin(np.abs(diffs))
        diff = diffs[closest_idx]
        if abs(diff) < half_cycle:
            lags.append(diff)

    if not lags:
        return {
            "vi_phase_lag_deg": 0.0,
            "displacement_power_factor": 1.0,
            "load_character": "unaligned",
        }

    mean_lag_samples = float(np.median(lags))
    phase_deg = (mean_lag_samples / nominal_samples_per_cycle) * 360.0
    phase_deg = (phase_deg + 180.0) % 360.0 - 180.0
    dpf = float(np.cos(np.radians(phase_deg)))

    if abs(phase_deg) < 5.0:
        character = "resistive"
    elif phase_deg > 5.0:
        character = "inductive"  # Current lags voltage
    else:
        character = "capacitive"  # Current leads voltage

    return {
        "vi_phase_lag_deg": round(phase_deg, 2),
        "displacement_power_factor": round(dpf, 4),
        "load_character": character,
    }


def synchronize_vi(record: SignalRecord) -> SignalRecord:
    """
    Enriches SignalRecord metadata with phase metrics and estimated grid frequency.
    Does NOT alter raw waveform arrays (preserves sample-to-sample timing).
    """
    grid_freq, grid_std, n_cycles = estimate_grid_frequency(record, channel="voltage")
    phase_metrics = compute_vi_phase_metrics(record)

    new_metadata = dict(record.metadata)
    new_metadata["grid_frequency_estimated_hz"] = round(grid_freq, 3)
    new_metadata["grid_frequency_std_hz"] = round(grid_std, 4)
    new_metadata["grid_cycle_count"] = n_cycles
    new_metadata.update(phase_metrics)

    return SignalRecord(
        signal_id=record.signal_id,
        source_dataset=record.source_dataset,
        recording_id=record.recording_id,
        sampling_rate_hz=record.sampling_rate_hz,
        session_id=record.session_id,
        appliance_label=record.appliance_label,
        appliance_instance_id=record.appliance_instance_id,
        timestamp=record.timestamp,
        window_start=record.window_start,
        window_end=record.window_end,
        event_type=record.event_type,
        voltage=record.voltage,
        current=record.current,
        metadata=new_metadata,
    )
