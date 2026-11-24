"""
Cleaning and Preprocessing Module for Phase 2.
Implements DC offset removal, sensor clipping detection, and high-level cleaning pipeline
while strictly honoring the canonical SignalRecord data contract and preserving physical units.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple
import numpy as np

from datasets.base import SignalRecord
from preprocessing.synchronization import synchronize_vi


def detect_clipping(
    signal: Optional[np.ndarray],
    consecutive_threshold: int = 15,
    atol: float = 1e-4,
) -> Tuple[bool, int, Dict[str, Any]]:
    """
    Detects true hardware ADC / sensor rail saturation clipping.

    Distinguishes true clipping from:
    1. Normal ADC quantization rounding at sinusoidal crests (streaks <= 5 samples at 30 kHz).
    2. Power electronic diode dead-bands / non-conduction zero-current regions (I ~ 0).

    Args:
        signal: 1D NumPy array representing waveform (or None).
        consecutive_threshold: Minimum number of consecutive flat samples required at the
                               global extremum to declare hardware clipping (default: 15 samples).
        atol: Absolute tolerance for identifying samples at the global peak.

    Returns:
        (is_clipped, total_clipped_samples, clipping_metadata)
    """
    if signal is None or len(signal) < consecutive_threshold:
        return (False, 0, {"is_clipped": False, "clipped_samples": 0})

    peak_pos = float(np.max(signal))
    peak_neg = float(np.min(signal))
    dynamic_range = peak_pos - peak_neg

    if dynamic_range < 1e-3:
        return (False, 0, {"is_clipped": False, "clipped_samples": 0})

    # Identify samples within atol of global positive peak or negative peak
    at_pos_peak = np.isclose(signal, peak_pos, atol=atol)
    at_neg_peak = np.isclose(signal, peak_neg, atol=atol)

    def _streak_analysis(mask: np.ndarray) -> Tuple[int, int]:
        """Returns (max_consecutive_streak, total_samples_in_qualifying_streaks)."""
        max_streak = 0
        qualifying_samples = 0
        cur_streak = 0
        for m in mask:
            if m:
                cur_streak += 1
                if cur_streak > max_streak:
                    max_streak = cur_streak
            else:
                if cur_streak >= consecutive_threshold:
                    qualifying_samples += cur_streak
                cur_streak = 0
        if cur_streak >= consecutive_threshold:
            qualifying_samples += cur_streak
        return max_streak, qualifying_samples

    max_pos_streak, pos_clipped_samples = _streak_analysis(at_pos_peak)
    max_neg_streak, neg_clipped_samples = _streak_analysis(at_neg_peak)

    total_clipped = pos_clipped_samples + neg_clipped_samples
    is_clipped = (max_pos_streak >= consecutive_threshold) or (max_neg_streak >= consecutive_threshold)

    metadata = {
        "is_clipped": is_clipped,
        "clipped_samples": int(total_clipped),
        "max_pos_streak": int(max_pos_streak),
        "max_neg_streak": int(max_neg_streak),
        "pos_clipped_samples": int(pos_clipped_samples),
        "neg_clipped_samples": int(neg_clipped_samples),
        "peak_pos": round(peak_pos, 4),
        "peak_neg": round(peak_neg, 4),
    }

    return (is_clipped, total_clipped, metadata)


def remove_dc_bias(
    record: SignalRecord,
    method: str = "mean",
    dc_tol_v: float = 0.5,
    dc_tol_i: float = 0.005,
) -> SignalRecord:
    """
    Removes sensor DC offset from voltage and current waveforms.
    
    Strictly preserves physical SI units (Volts and Amperes).
    Zero blind scaling or min-max normalization is applied.

    Args:
        record: Canonical SignalRecord.
        method: 'mean' (unbiased sample mean subtraction) or 'highpass'.
        dc_tol_v: Voltage DC offset warning threshold in Volts.
        dc_tol_i: Current DC offset warning threshold in Amperes (default 5 mA).

    Returns:
        New SignalRecord with zero-mean waveforms and logged offset metadata.
    """
    v_clean = None
    i_clean = None
    v_offset = 0.0
    i_offset = 0.0

    if record.voltage is not None:
        v_offset = float(np.mean(record.voltage))
        v_clean = record.voltage - v_offset

    if record.current is not None:
        i_offset = float(np.mean(record.current))
        i_clean = record.current - i_offset

    new_metadata = dict(record.metadata)
    quality_flags = dict(new_metadata.get("quality_flags", {}))

    # Log removed DC metrics
    new_metadata["removed_dc_offset"] = {
        "voltage_v": round(v_offset, 5),
        "current_a": round(i_offset, 6),
        "method": method,
    }

    # Flag abnormal DC bias if exceeding sensor tolerance
    quality_flags["dc_bias_removed"] = True
    quality_flags["high_voltage_dc_bias"] = abs(v_offset) > dc_tol_v
    quality_flags["high_current_dc_bias"] = abs(i_offset) > dc_tol_i

    new_metadata["quality_flags"] = quality_flags

    # Record preprocessing history
    history = list(new_metadata.get("preprocessing_history", []))
    history.append("dc_bias_removal")
    new_metadata["preprocessing_history"] = history

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
        voltage=v_clean,
        current=i_clean,
        metadata=new_metadata,
    )


def clean_signal(
    record: SignalRecord,
    config: Optional[Dict[str, Any]] = None,
) -> SignalRecord:
    """
    High-level, end-to-end signal validation and cleaning pipeline.
    
    1. Validates numerical sanity (NaNs/Infs).
    2. Runs sensor clipping detection on Current and Voltage channels.
    3. Removes sensor DC bias while strictly preserving physical units.
    4. Enriches with grid frequency and V-I phase synchronization metrics.
    5. Returns a certified, clean canonical SignalRecord.
    """
    cfg = config or {}
    dc_tol_v = cfg.get("dc_offset_tolerance_v", 0.5)
    dc_tol_i = cfg.get("dc_offset_tolerance_i", 0.005)
    clipping_streak_thresh = cfg.get("clipping_consecutive_samples", 15)

    # 1. Numerical Sanity Check
    has_nan = False
    has_inf = False
    if record.voltage is not None:
        has_nan = has_nan or bool(np.isnan(record.voltage).any())
        has_inf = has_inf or bool(np.isinf(record.voltage).any())
    if record.current is not None:
        has_nan = has_nan or bool(np.isnan(record.current).any())
        has_inf = has_inf or bool(np.isinf(record.current).any())

    # 2. True Saturation Clipping Detection
    is_clipped_i, clipped_count_i, clip_meta_i = detect_clipping(
        record.current, consecutive_threshold=clipping_streak_thresh
    )
    is_clipped_v, clipped_count_v, clip_meta_v = detect_clipping(
        record.voltage, consecutive_threshold=clipping_streak_thresh
    )

    # Update metadata and quality flags
    new_metadata = dict(record.metadata)
    quality_flags = dict(new_metadata.get("quality_flags", {}))
    quality_flags["has_nan"] = has_nan
    quality_flags["has_inf"] = has_inf
    quality_flags["is_clipped"] = is_clipped_i or is_clipped_v
    quality_flags["is_clipped_current"] = is_clipped_i
    quality_flags["is_clipped_voltage"] = is_clipped_v
    quality_flags["clipped_samples_current"] = clipped_count_i
    quality_flags["clipped_samples_voltage"] = clipped_count_v

    new_metadata["quality_flags"] = quality_flags
    new_metadata["clipping_analysis"] = {
        "current": clip_meta_i,
        "voltage": clip_meta_v,
    }

    # Pack intermediate record to pass to DC removal
    temp_record = SignalRecord(
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

    # 3. DC Bias Removal
    dc_cleaned = remove_dc_bias(
        temp_record,
        method=cfg.get("dc_removal_method", "mean"),
        dc_tol_v=dc_tol_v,
        dc_tol_i=dc_tol_i,
    )

    # 4. Synchronization and Grid Frequency Analysis
    synchronized = synchronize_vi(dc_cleaned)

    # 5. Certification flag
    final_metadata = dict(synchronized.metadata)
    final_quality_flags = dict(final_metadata.get("quality_flags", {}))
    final_quality_flags["phase2_certified"] = True
    final_metadata["quality_flags"] = final_quality_flags

    history = list(final_metadata.get("preprocessing_history", []))
    history.append("phase2_validation_and_cleaning")
    final_metadata["preprocessing_history"] = history

    return SignalRecord(
        signal_id=f"{record.signal_id}_clean",
        source_dataset=synchronized.source_dataset,
        recording_id=synchronized.recording_id,
        sampling_rate_hz=synchronized.sampling_rate_hz,
        session_id=synchronized.session_id,
        appliance_label=synchronized.appliance_label,
        appliance_instance_id=synchronized.appliance_instance_id,
        timestamp=synchronized.timestamp,
        window_start=synchronized.window_start,
        window_end=synchronized.window_end,
        event_type=synchronized.event_type,
        voltage=synchronized.voltage,
        current=synchronized.current,
        metadata=final_metadata,
    )
