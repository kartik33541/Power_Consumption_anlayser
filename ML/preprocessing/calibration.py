"""
Calibration module.
Converts raw ADC counts to physical units (Volts, Amperes) if needed.
"""

from typing import Optional
from datasets.base import SignalRecord


def calibrate_signal(
    record: SignalRecord,
    v_scale: float = 1.0,
    i_scale: float = 1.0,
    v_offset: float = 0.0,
    i_offset: float = 0.0,
) -> SignalRecord:
    """
    Applies linear calibration to voltage and current signals in a SignalRecord.
    Returns a new or updated SignalRecord with calibrated waveforms.
    """
    calibrated_v = None
    calibrated_i = None

    if record.voltage is not None:
        calibrated_v = (record.voltage - v_offset) * v_scale
    if record.current is not None:
        calibrated_i = (record.current - i_offset) * i_scale

    return SignalRecord(
        signal_id=f"{record.signal_id}_calibrated",
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
        voltage=calibrated_v,
        current=calibrated_i,
        metadata={**record.metadata, "calibrated": True},
    )
