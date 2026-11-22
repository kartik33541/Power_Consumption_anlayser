"""
Windowing and event slicing module.
Slices canonical SignalRecords into analysis windows or transient event windows.
"""

from typing import List
import numpy as np
from datasets.base import SignalRecord


def extract_event_windows(
    record: SignalRecord,
    window_samples: int,
    overlap_samples: int = 0,
) -> List[SignalRecord]:
    """
    Slices a continuous SignalRecord into a list of windowed SignalRecords.
    """
    total_samples = record.sample_count
    if total_samples < window_samples or window_samples <= 0:
        return [record]

    step = max(1, window_samples - overlap_samples)
    windows: List[SignalRecord] = []
    idx = 0
    w_num = 0

    while idx + window_samples <= total_samples:
        v_win = record.voltage[idx : idx + window_samples] if record.voltage is not None else None
        i_win = record.current[idx : idx + window_samples] if record.current is not None else None
        t_start = idx / record.sampling_rate_hz
        t_end = (idx + window_samples) / record.sampling_rate_hz

        win_rec = SignalRecord(
            signal_id=f"{record.signal_id}_win{w_num}",
            source_dataset=record.source_dataset,
            recording_id=record.recording_id,
            session_id=record.session_id,
            appliance_label=record.appliance_label,
            appliance_instance_id=record.appliance_instance_id,
            sampling_rate_hz=record.sampling_rate_hz,
            timestamp=record.timestamp,
            window_start=t_start,
            window_end=t_end,
            event_type=record.event_type,
            voltage=v_win,
            current=i_win,
            metadata={**record.metadata, "window_index": w_num},
        )
        windows.append(win_rec)
        idx += step
        w_num += 1

    return windows
