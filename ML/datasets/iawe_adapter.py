"""
iAWE Dataset Adapter (Scheduled for Indian Household Baseline Phase).

Converts iAWE household aggregate and appliance measurements into canonical records.
"""

from typing import Any, Dict, Iterator
from .base import BaseDatasetAdapter, SignalRecord


class IAWEAdapter(BaseDatasetAdapter):
    """Adapter for iAWE (Indian Appliance Energy Dataset)."""

    def load_record(self, record_id: str, **kwargs: Any) -> SignalRecord:
        raise NotImplementedError("IAWEAdapter.load_record will be implemented in iAWE phase.")

    def iter_records(self, **kwargs: Any) -> Iterator[SignalRecord]:
        raise NotImplementedError("IAWEAdapter.iter_records will be implemented in iAWE phase.")

    def get_dataset_info(self) -> Dict[str, Any]:
        return {
            "name": "iAWE",
            "type": "Indian Household Aggregate Metrics",
            "status": "Pending Baseline Phase",
        }
