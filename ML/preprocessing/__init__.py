"""
Preprocessing module - Calibration, cleaning, synchronization, and windowing.
All functions strictly accept and operate on canonical SignalRecord objects.
"""

from .calibration import calibrate_signal
from .cleaning import clean_signal, remove_dc_bias
from .synchronization import synchronize_vi
from .windowing import extract_event_windows

__all__ = [
    "calibrate_signal",
    "clean_signal",
    "remove_dc_bias",
    "synchronize_vi",
    "extract_event_windows",
]
