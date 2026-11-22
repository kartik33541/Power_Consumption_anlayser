"""
Own Hardware Dataset Adapter (Scheduled for Real-World Validation Phase).

Converts measurements captured from SCT-013 CT clamp + ZMPT101B voltage sensor
(via ESP32 / Raspberry Pi) into canonical SignalRecord objects.
"""

from typing import Any, Dict, Iterator
from .base import BaseDatasetAdapter, SignalRecord


class OwnDataAdapter(BaseDatasetAdapter):
    """Adapter for custom sensor measurements (SCT-013 + ZMPT101B)."""

    def load_record(self, record_id: str, **kwargs: Any) -> SignalRecord:
        raise NotImplementedError("OwnDataAdapter.load_record will be implemented in Own Data phase.")

    def iter_records(self, **kwargs: Any) -> Iterator[SignalRecord]:
        raise NotImplementedError("OwnDataAdapter.iter_records will be implemented in Own Data phase.")

    def get_dataset_info(self) -> Dict[str, Any]:
        return {
            "name": "OwnData",
            "type": "Hardware Lab Sensor Measurements (SCT-013 / ZMPT101B)",
            "status": "Pending Hardware Bring-up Phase",
        }
