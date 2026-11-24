"""
Evaluation package - Metrics, group splitting, leakage audit, scaling, and manifests.
"""

from .metrics import calculate_classification_metrics
from .unknown import evaluate_unknown_rejection
from .splitting import LeakageSafeSplitter, SplitResult, train_val_test_group_split
from .audit_leakage import audit_leakage, DataLeakageError
from .scaling import LeakageSafeScaler
from .split_manifest import create_split_manifest, load_processed_dataset

__all__ = [
    "calculate_classification_metrics",
    "evaluate_unknown_rejection",
    "LeakageSafeSplitter",
    "SplitResult",
    "train_val_test_group_split",
    "audit_leakage",
    "DataLeakageError",
    "LeakageSafeScaler",
    "create_split_manifest",
    "load_processed_dataset",
]
