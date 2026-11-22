"""
Synchronization module.
Aligns phase / zero-crossings of voltage and current signals.
"""

from datasets.base import SignalRecord


def synchronize_vi(record: SignalRecord) -> SignalRecord:
    """
    Ensures voltage and current channels are aligned in time.
    Phase 0 contract pass-through.
    """
    return record
