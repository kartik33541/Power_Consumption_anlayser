"""
Cleaning module.
Handles DC offset removal and bandpass filtering on canonical SignalRecords.
"""

import numpy as np
from datasets.base import SignalRecord


def remove_dc_bias(record: SignalRecord) -> SignalRecord:
    """Removes mean DC offset from both voltage and current signals."""
    v_clean = record.voltage - np.mean(record.voltage) if record.voltage is not None else None
    i_clean = record.current - np.mean(record.current) if record.current is not None else None

    return SignalRecord(
        signal_id=f"{record.signal_id}_dc_removed",
        source_dataset=record.source_dataset,
        recording_id=record.recording_id,
        session_id=record.session_id,
        appliance_label=record.appliance_label,
        appliance_instance_id=record.appliance_instance_id,
        sampling_rate_hz=record.sampling_rate_hz,
        timestamp=record.timestamp,
        window_start=record.window_start,
        window_end=record.window_end,
        event_type=record.event_type,
        voltage=v_clean,
        current=i_clean,
        metadata={**record.metadata, "dc_bias_removed": True},
    )


def clean_signal(record: SignalRecord) -> SignalRecord:
    """High-level cleaning pipeline."""
    return remove_dc_bias(record)
