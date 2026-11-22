"""
Canonical Data Contract and Base Dataset Adapter.

Phase 0 Mandate:
Define exactly what the rest of the pipeline expects from any dataset,
preventing dataset-specific format assumptions from leaking downstream.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, Optional
import numpy as np


@dataclass
class SignalRecord:
    """
    Canonical representation of an electrical measurement record.
    
    All dataset adapters (PLAID, HIFDA, iAWE, Own Hardware) must transform
    their source-specific data into this canonical structure before passing it
    to preprocessing, VMD, feature extraction, or machine learning.
    """
    signal_id: str
    source_dataset: str                       # e.g., 'PLAID', 'HIFDA', 'IAWE', 'OWN', 'SYNTHETIC'
    recording_id: str
    sampling_rate_hz: float                   # Must be explicit and > 0 (Rule 3)
    
    # Optional provenance & contextual metadata (Never fabricated, default None)
    session_id: Optional[str] = None
    appliance_label: Optional[str] = None     # Ground truth Y (Rule 4: kept separate from X)
    appliance_instance_id: Optional[str] = None
    timestamp: Optional[float] = None         # Unix epoch or relative seconds
    window_start: Optional[float] = None      # Window start in seconds
    window_end: Optional[float] = None        # Window end in seconds
    event_type: Optional[str] = None          # e.g. 'on', 'off', 'steady'
    
    # Waveform measurements (Rule 1 & Rule 2: 1D arrays or None)
    voltage: Optional[np.ndarray] = None      # 1D array in Volts
    current: Optional[np.ndarray] = None      # 1D array in Amperes
    
    # Dataset-specific extra metadata dictionary
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Enforces canonical invariants."""
        # Rule 3: Sampling rate must be strictly positive and explicit
        if not isinstance(self.sampling_rate_hz, (int, float)) or self.sampling_rate_hz <= 0:
            raise ValueError(f"sampling_rate_hz must be a positive float, got {self.sampling_rate_hz}")
        self.sampling_rate_hz = float(self.sampling_rate_hz)

        # Rule 5: Source identity must not be empty
        if not self.source_dataset or not isinstance(self.source_dataset, str):
            raise ValueError("source_dataset must be a non-empty string identifier")

        # Rule 1: Current must be a 1D float array if provided
        if self.current is not None:
            if not isinstance(self.current, np.ndarray):
                self.current = np.asarray(self.current, dtype=np.float64)
            if self.current.ndim != 1:
                raise ValueError(f"current waveform must be 1-dimensional, got ndim={self.current.ndim}")
            if not np.issubdtype(self.current.dtype, np.floating):
                self.current = self.current.astype(np.float64)

        # Rule 2: Voltage must be a 1D float array if provided
        if self.voltage is not None:
            if not isinstance(self.voltage, np.ndarray):
                self.voltage = np.asarray(self.voltage, dtype=np.float64)
            if self.voltage.ndim != 1:
                raise ValueError(f"voltage waveform must be 1-dimensional, got ndim={self.voltage.ndim}")
            if not np.issubdtype(self.voltage.dtype, np.floating):
                self.voltage = self.voltage.astype(np.float64)

        # Invariant check: if both V and I exist, lengths should match
        if self.voltage is not None and self.current is not None:
            if len(self.voltage) != len(self.current):
                raise ValueError(
                    f"Voltage and current length mismatch: {len(self.voltage)} vs {len(self.current)}"
                )

    @property
    def sample_count(self) -> int:
        """Returns the number of samples in the record."""
        if self.current is not None:
            return len(self.current)
        if self.voltage is not None:
            return len(self.voltage)
        return 0

    @property
    def duration_seconds(self) -> float:
        """Returns signal duration in seconds."""
        count = self.sample_count
        if count == 0 or self.sampling_rate_hz <= 0:
            return 0.0
        return count / self.sampling_rate_hz

    def summary(self) -> str:
        """Quick diagnostic string."""
        return (
            f"SignalRecord(id='{self.signal_id}', source='{self.source_dataset}', "
            f"appliance='{self.appliance_label}', samples={self.sample_count}, "
            f"duration={self.duration_seconds:.3f}s, Fs={self.sampling_rate_hz}Hz)"
        )


class BaseDatasetAdapter(abc.ABC):
    """
    Abstract Base Class for all dataset adapters.
    
    Encapsulates dataset-specific ingestion, parsing, and unit conversion,
    ensuring downstream pipeline components only see canonical SignalRecords.
    """

    def __init__(self, dataset_path: str, config: Optional[Dict[str, Any]] = None):
        self.dataset_path = dataset_path
        self.config = config or {}

    @abc.abstractmethod
    def load_record(self, record_id: str, **kwargs: Any) -> SignalRecord:
        """Load a single record by its identifier and return a canonical SignalRecord."""
        pass

    @abc.abstractmethod
    def iter_records(self, **kwargs: Any) -> Iterator[SignalRecord]:
        """Iterate through records in the dataset yielding canonical SignalRecords."""
        pass

    @abc.abstractmethod
    def get_dataset_info(self) -> Dict[str, Any]:
        """Return dataset metadata, statistics, and available classes."""
        pass
