"""
Windowing and Event/Steady-State Representation Engine for Phase 3.
Transforms certified continuous SignalRecords into uniform, cycle-synchronized WindowRecords.
Maintains complete provenance (house_id, recording_id, appliance_label) to guarantee
strictly leakage-free splitting in Phase 8.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from datasets.base import SignalRecord, WindowRecord
from preprocessing.synchronization import detect_zero_crossings


def calculate_cycle_metrics(
    record: SignalRecord,
    nominal_freq_hz: float = 60.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes cycle-by-cycle active power P and RMS current from voltage zero-crossings.

    Returns:
        (cycle_start_indices, cycle_active_power_w, cycle_rms_current_a)
    """
    if record.current is None or len(record.current) == 0:
        return (np.array([], dtype=int), np.array([]), np.array([]))

    fs = record.sampling_rate_hz
    nominal_cycle_samples = int(fs / nominal_freq_hz)

    # Use voltage for cycle zero-crossings if available, else current
    ref_signal = record.voltage if record.voltage is not None else record.current
    centered_ref = ref_signal - np.mean(ref_signal)

    # Detect rising zero crossings with 0.75-cycle lockout
    min_dist = int(0.75 * nominal_cycle_samples)
    zx = detect_zero_crossings(
        centered_ref,
        fs,
        direction="rising",
        subsample=False,
        min_distance_samples=min_dist,
    )

    if len(zx) < 2:
        # Fallback to fixed-grid boundaries if zero-crossings cannot be resolved
        total_samples = len(record.current)
        zx = np.arange(0, total_samples, nominal_cycle_samples, dtype=int)
        if len(zx) < 2:
            return (np.array([], dtype=int), np.array([]), np.array([]))

    cycle_starts = zx[:-1]
    cycle_ends = zx[1:]

    p_cycles = []
    i_rms_cycles = []

    for start, end in zip(cycle_starts, cycle_ends):
        if end <= start:
            continue
        i_slice = record.current[start:end]
        i_rms = float(np.sqrt(np.mean(i_slice ** 2)))
        i_rms_cycles.append(i_rms)

        if record.voltage is not None:
            v_slice = record.voltage[start:end]
            p_active = float(np.mean(v_slice * i_slice))
            p_cycles.append(p_active)
        else:
            p_cycles.append(i_rms * 120.0)  # Nominal estimation if V absent

    return (cycle_starts, np.array(p_cycles), np.array(i_rms_cycles))


def detect_activation_event(
    record: SignalRecord,
    threshold_w: float = 30.0,
    nominal_freq_hz: float = 60.0,
) -> Optional[int]:
    """
    Detects the sample index of an appliance activation / turn-on event (surge).

    Returns:
        Sample index of the start of the activation cycle, or None if no surge detected.
    """
    cycle_starts, p_cycles, i_rms_cycles = calculate_cycle_metrics(record, nominal_freq_hz)
    if len(p_cycles) < 2:
        return None

    # Step changes in active power between adjacent cycles
    delta_p = np.diff(p_cycles)
    
    # Check for forward power jump exceeding threshold
    surge_indices = np.where(delta_p >= threshold_w)[0]
    if len(surge_indices) > 0:
        event_cycle = surge_indices[0] + 1  # The cycle where high power begins
        return int(cycle_starts[event_cycle])

    # Fallback to current step change (delta Irms >= 0.25 A)
    delta_i = np.diff(i_rms_cycles)
    surge_i_indices = np.where(delta_i >= 0.25)[0]
    if len(surge_i_indices) > 0:
        event_cycle = surge_i_indices[0] + 1
        return int(cycle_starts[event_cycle])

    return None


def extract_transient_window(
    record: SignalRecord,
    config: Optional[Dict[str, Any]] = None,
) -> Optional[WindowRecord]:
    """
    Extracts a cycle-synchronized activation transient window centered on turn-on.
    """
    cfg = config or {}
    nominal_freq = cfg.get("grid_frequency_nominal_hz", 60.0)
    samples_per_cycle = int(round(record.sampling_rate_hz / nominal_freq))
    
    pre_cycles = cfg.get("pre_event_cycles", 2)
    post_cycles = cfg.get("post_event_cycles", 4)
    total_cycles = pre_cycles + post_cycles  # e.g., 6 cycles = 100 ms
    window_samples = total_cycles * samples_per_cycle

    event_sample = detect_activation_event(
        record,
        threshold_w=cfg.get("transient_event_threshold_power_w", 30.0),
        nominal_freq_hz=nominal_freq,
    )

    if event_sample is None:
        return None

    # Calculate desired window start (pre_cycles before event)
    desired_start = event_sample - (pre_cycles * samples_per_cycle)

    # Align to nearest rising zero crossing if possible
    ref_signal = record.voltage if record.voltage is not None else record.current
    centered = ref_signal - np.mean(ref_signal)
    zx = detect_zero_crossings(
        centered,
        record.sampling_rate_hz,
        direction="rising",
        subsample=False,
        min_distance_samples=int(0.75 * samples_per_cycle),
    )

    if len(zx) > 0:
        # Find closest zero crossing to desired_start
        closest_idx = np.argmin(np.abs(zx - desired_start))
        start_idx = int(zx[closest_idx])
    else:
        start_idx = max(0, desired_start)

    end_idx = start_idx + window_samples

    # Boundary check against total record samples
    total_len = record.sample_count
    if end_idx > total_len:
        # Shift back so window fits within record
        end_idx = total_len
        start_idx = max(0, end_idx - window_samples)
    if start_idx < 0 or (end_idx - start_idx) != window_samples:
        return None

    v_win = record.voltage[start_idx:end_idx] if record.voltage is not None else None
    i_win = record.current[start_idx:end_idx] if record.current is not None else None

    # Inherit location/house_id strictly for Phase 8 group-split
    house_id = str(record.metadata.get("location") or record.metadata.get("house_id", "unknown"))

    return WindowRecord(
        window_id=f"{record.signal_id}_w_transient",
        parent_signal_id=record.signal_id,
        recording_id=record.recording_id,
        source_dataset=record.source_dataset,
        house_id=house_id,
        sampling_rate_hz=record.sampling_rate_hz,
        window_type="transient",
        window_start_sec=round(start_idx / record.sampling_rate_hz, 4),
        window_end_sec=round(end_idx / record.sampling_rate_hz, 4),
        start_sample_idx=start_idx,
        end_sample_idx=end_idx,
        appliance_label=record.appliance_label,
        appliance_instance_id=record.appliance_instance_id,
        voltage=v_win,
        current=i_win,
        metadata={
            **record.metadata,
            "event_sample_idx": event_sample,
            "pre_cycles": pre_cycles,
            "post_cycles": post_cycles,
        },
    )


def extract_steady_state_window(
    record: SignalRecord,
    config: Optional[Dict[str, Any]] = None,
) -> Optional[WindowRecord]:
    """
    Extracts a cycle-synchronized steady-state window from the stable operating region.
    """
    cfg = config or {}
    nominal_freq = cfg.get("grid_frequency_nominal_hz", 60.0)
    samples_per_cycle = int(round(record.sampling_rate_hz / nominal_freq))
    cycles = cfg.get("cycles_per_window", 6)
    window_samples = cycles * samples_per_cycle

    cycle_starts, p_cycles, i_rms_cycles = calculate_cycle_metrics(record, nominal_freq)
    if len(cycle_starts) < cycles:
        return None

    # Check for activation event to avoid inrush transient
    event_sample = detect_activation_event(
        record,
        threshold_w=cfg.get("transient_event_threshold_power_w", 30.0),
        nominal_freq_hz=nominal_freq,
    )

    settle_delay_sec = cfg.get("steady_state_settle_delay_sec", 0.40)
    min_start_sample = int(settle_delay_sec * record.sampling_rate_hz)
    if event_sample is not None:
        min_start_sample = max(min_start_sample, event_sample + int(0.20 * record.sampling_rate_hz))

    # Evaluate rolling stability (variance of cycle RMS current)
    best_start = None
    min_variance = float("inf")

    for k in range(len(cycle_starts) - cycles):
        s_idx = cycle_starts[k]
        if s_idx < min_start_sample:
            continue
        if s_idx + window_samples > record.sample_count:
            break

        window_i_rms = i_rms_cycles[k : k + cycles]
        mean_rms = np.mean(window_i_rms)

        # Skip dead/off windows if appliance is supposed to be active
        if mean_rms < 0.01:
            continue

        var = float(np.var(window_i_rms))
        if var < min_variance:
            min_variance = var
            best_start = int(s_idx)

    # Fallback to mid-recording aligned to nearest zero crossing
    if best_start is None:
        mid_sample = int(0.5 * record.sample_count)
        # Find closest cycle_start
        closest_k = np.argmin(np.abs(cycle_starts - mid_sample))
        best_start = int(cycle_starts[closest_k])

    start_idx = best_start
    end_idx = start_idx + window_samples

    if end_idx > record.sample_count:
        end_idx = record.sample_count
        start_idx = max(0, end_idx - window_samples)

    if (end_idx - start_idx) != window_samples:
        return None

    v_win = record.voltage[start_idx:end_idx] if record.voltage is not None else None
    i_win = record.current[start_idx:end_idx] if record.current is not None else None

    house_id = str(record.metadata.get("location") or record.metadata.get("house_id", "unknown"))

    return WindowRecord(
        window_id=f"{record.signal_id}_w_steady",
        parent_signal_id=record.signal_id,
        recording_id=record.recording_id,
        source_dataset=record.source_dataset,
        house_id=house_id,
        sampling_rate_hz=record.sampling_rate_hz,
        window_type="steady",
        window_start_sec=round(start_idx / record.sampling_rate_hz, 4),
        window_end_sec=round(end_idx / record.sampling_rate_hz, 4),
        start_sample_idx=start_idx,
        end_sample_idx=end_idx,
        appliance_label=record.appliance_label,
        appliance_instance_id=record.appliance_instance_id,
        voltage=v_win,
        current=i_win,
        metadata={
            **record.metadata,
            "steady_state_variance": round(min_variance, 6),
        },
    )


def extract_sliding_windows(
    record: SignalRecord,
    window_samples: int,
    overlap_ratio: float = 0.50,
) -> List[WindowRecord]:
    """
    Extracts continuous overlapping sliding windows across the full record.
    """
    total_samples = record.sample_count
    if total_samples < window_samples or window_samples <= 0:
        return []

    step = max(1, int(round(window_samples * (1.0 - overlap_ratio))))
    windows: List[WindowRecord] = []
    idx = 0
    w_num = 0
    house_id = str(record.metadata.get("location") or record.metadata.get("house_id", "unknown"))

    while idx + window_samples <= total_samples:
        v_win = record.voltage[idx : idx + window_samples] if record.voltage is not None else None
        i_win = record.current[idx : idx + window_samples] if record.current is not None else None
        t_start = idx / record.sampling_rate_hz
        t_end = (idx + window_samples) / record.sampling_rate_hz

        win_rec = WindowRecord(
            window_id=f"{record.signal_id}_slide_{w_num:03d}",
            parent_signal_id=record.signal_id,
            recording_id=record.recording_id,
            source_dataset=record.source_dataset,
            house_id=house_id,
            sampling_rate_hz=record.sampling_rate_hz,
            window_type="sliding",
            window_start_sec=round(t_start, 4),
            window_end_sec=round(t_end, 4),
            start_sample_idx=idx,
            end_sample_idx=idx + window_samples,
            appliance_label=record.appliance_label,
            appliance_instance_id=record.appliance_instance_id,
            voltage=v_win,
            current=i_win,
            metadata={**record.metadata, "window_index": w_num},
        )
        windows.append(win_rec)
        idx += step
        w_num += 1

    return windows


def window_signal(
    record: SignalRecord,
    config: Optional[Dict[str, Any]] = None,
) -> List[WindowRecord]:
    """
    High-level Phase 3 windowing engine.
    
    Extracts deterministic, cycle-synchronized analysis windows from a SignalRecord.
    Supports 'event' mode (transient + steady), 'sliding' mode, or 'both'.
    """
    cfg = config or {}
    mode = cfg.get("mode", "both")
    nominal_freq = cfg.get("grid_frequency_nominal_hz", 60.0)
    samples_per_cycle = int(round(record.sampling_rate_hz / nominal_freq))
    cycles = cfg.get("cycles_per_window", 6)
    window_samples = cycles * samples_per_cycle
    overlap_ratio = cfg.get("overlap_ratio", 0.50)

    windows: List[WindowRecord] = []

    if mode in ("event", "both"):
        # 1. Extract transient activation window if surge detected
        transient = extract_transient_window(record, cfg)
        if transient is not None:
            windows.append(transient)

        # 2. Extract steady-state operating window
        steady = extract_steady_state_window(record, cfg)
        if steady is not None:
            windows.append(steady)

    if mode in ("sliding", "both"):
        sliding = extract_sliding_windows(record, window_samples, overlap_ratio)
        windows.extend(sliding)

    return windows


# Backward compatibility for Phase 0 pass-through tests
def extract_event_windows(
    record: SignalRecord,
    window_samples: int,
    overlap_samples: int = 0,
) -> List[SignalRecord]:
    """Phase 0 backward-compatible wrapper returning SignalRecord slices."""
    overlap_ratio = overlap_samples / window_samples if window_samples > 0 else 0.0
    win_records = extract_sliding_windows(record, window_samples, overlap_ratio)
    # Convert WindowRecords back to SignalRecords for phase 0 compatibility
    return [
        SignalRecord(
            signal_id=w.window_id,
            source_dataset=w.source_dataset,
            recording_id=w.recording_id,
            sampling_rate_hz=w.sampling_rate_hz,
            appliance_label=w.appliance_label,
            appliance_instance_id=w.appliance_instance_id,
            window_start=w.window_start_sec,
            window_end=w.window_end_sec,
            event_type=w.window_type,
            voltage=w.voltage,
            current=w.current,
            metadata=w.metadata,
        )
        for w in win_records
    ]
