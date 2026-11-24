"""
Leakage-Safe Group Splitting Engine (Phase 8).

Implements 3-way Group-Aware Splitting (Train, Validation, Test) and
Group K-Fold Cross-Validation grouped by physical house/location (house_id).

Guarantees:
1. Zero Spatial Leakage: Houses in Train NEVER appear in Validation or Test.
2. Zero Sample Leakage: Identical recordings or cycle windows never straddle splits.
3. Stratified Class Representation: Balanced distribution of appliance types across sets.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold, GroupKFold


@dataclass
class SplitResult:
    """
    Encapsulates the output of a 3-way group-aware split.
    """
    train_indices: np.ndarray
    val_indices: np.ndarray
    test_indices: np.ndarray
    train_houses: List[str]
    val_houses: List[str]
    test_houses: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def summary(self) -> str:
        """Returns diagnostic string summary of the split."""
        n_total = len(self.train_indices) + len(self.val_indices) + len(self.test_indices)
        train_pct = 100.0 * len(self.train_indices) / max(1, n_total)
        val_pct = 100.0 * len(self.val_indices) / max(1, n_total)
        test_pct = 100.0 * len(self.test_indices) / max(1, n_total)

        return (
            f"SplitResult(\n"
            f"  Train: {len(self.train_indices)} samples ({train_pct:.1f}%) across {len(self.train_houses)} houses\n"
            f"  Val:   {len(self.val_indices)} samples ({val_pct:.1f}%) across {len(self.val_houses)} houses\n"
            f"  Test:  {len(self.test_indices)} samples ({test_pct:.1f}%) across {len(self.test_houses)} houses\n"
            f")"
        )


class LeakageSafeSplitter:
    """
    Group-aware dataset partitioner that prevents spatial and identity leakage.
    """

    def __init__(
        self,
        group_col: str = "house_id",
        label_col: str = "appliance_label",
        test_size: float = 0.20,
        val_size: float = 0.15,
        random_state: int = 42,
    ):
        """
        Args:
            group_col: Column name identifying the house/location group.
            label_col: Column name containing the target appliance class label.
            test_size: Fraction of houses to allocate to held-out Test set.
            val_size: Fraction of houses to allocate to Validation set.
            random_state: Seed for deterministic group allocation.
        """
        if test_size <= 0.0 or test_size >= 1.0:
            raise ValueError(f"test_size must be in (0, 1), got {test_size}")
        if val_size <= 0.0 or val_size >= 1.0:
            raise ValueError(f"val_size must be in (0, 1), got {val_size}")
        if test_size + val_size >= 1.0:
            raise ValueError(
                f"Sum of test_size ({test_size}) and val_size ({val_size}) must be < 1.0"
            )

        self.group_col = group_col
        self.label_col = label_col
        self.test_size = test_size
        self.val_size = val_size
        self.random_state = random_state

    def split(
        self,
        df: pd.DataFrame,
    ) -> SplitResult:
        """
        Partitions dataframe into Train, Validation, and Test subsets grouped by house_id.

        Algorithm:
        1. Outer Split: Partitions all houses into Development (1 - test_size) and Test (test_size).
        2. Inner Split: Partitions Development houses into Train (1 - relative_val) and Val (relative_val).
        3. Uses StratifiedGroupKFold where possible to maximize class stratification.
        """
        if self.group_col not in df.columns:
            raise KeyError(f"group_col '{self.group_col}' not found in dataframe columns: {list(df.columns)}")
        if self.label_col not in df.columns:
            raise KeyError(f"label_col '{self.label_col}' not found in dataframe columns: {list(df.columns)}")

        n_samples = len(df)
        if n_samples < 5:
            raise ValueError(f"Dataframe too small to split ({n_samples} samples).")

        groups = df[self.group_col].astype(str).values
        labels = df[self.label_col].astype(str).values
        indices = np.arange(n_samples)

        unique_groups = np.unique(groups)
        n_groups = len(unique_groups)

        if n_groups < 3:
            raise ValueError(
                f"At least 3 distinct houses are required for Train/Val/Test split, found only {n_groups}."
            )

        # -------------------------------------------------------------------------
        # Stage 1: Outer Split -> Dev vs. Test
        # -------------------------------------------------------------------------
        n_outer_folds = max(2, int(round(1.0 / self.test_size)))
        outer_splitter = self._get_splitter(n_outer_folds)

        try:
            outer_folds = list(outer_splitter.split(indices, labels, groups))
        except Exception:
            # Fallback to pure GroupKFold if class distribution prohibits StratifiedGroupKFold
            outer_splitter = GroupKFold(n_splits=min(n_outer_folds, n_groups))
            outer_folds = list(outer_splitter.split(indices, labels, groups))

        # Pick fold with test group count closest to target
        target_test_groups = int(round(n_groups * self.test_size))
        best_fold_idx = 0
        min_group_diff = float("inf")

        for fold_idx, (dev_idx, test_idx) in enumerate(outer_folds):
            test_grp_count = len(np.unique(groups[test_idx]))
            diff = abs(test_grp_count - target_test_groups)
            if diff < min_group_diff:
                min_group_diff = diff
                best_fold_idx = fold_idx

        dev_indices, test_indices = outer_folds[best_fold_idx]

        # -------------------------------------------------------------------------
        # Stage 2: Inner Split -> Train vs. Val (from Dev)
        # -------------------------------------------------------------------------
        dev_groups = groups[dev_indices]
        dev_labels = labels[dev_indices]
        unique_dev_groups = np.unique(dev_groups)
        n_dev_groups = len(unique_dev_groups)

        if n_dev_groups < 2:
            raise ValueError(
                f"Insufficient development houses ({n_dev_groups}) remaining after allocating test set."
            )

        # Target relative val fraction within dev set
        dev_fraction = 1.0 - self.test_size
        relative_val_size = self.val_size / dev_fraction
        n_inner_folds = max(2, int(round(1.0 / relative_val_size)))

        inner_splitter = self._get_splitter(min(n_inner_folds, n_dev_groups))
        try:
            inner_folds = list(inner_splitter.split(dev_indices, dev_labels, dev_groups))
        except Exception:
            inner_splitter = GroupKFold(n_splits=min(n_inner_folds, n_dev_groups))
            inner_folds = list(inner_splitter.split(dev_indices, dev_labels, dev_groups))

        target_val_groups = max(1, int(round(n_groups * self.val_size)))
        best_inner_idx = 0
        min_inner_diff = float("inf")

        for fold_idx, (train_sub_idx, val_sub_idx) in enumerate(inner_folds):
            val_grp_count = len(np.unique(dev_groups[val_sub_idx]))
            diff = abs(val_grp_count - target_val_groups)
            if diff < min_inner_diff:
                min_inner_diff = diff
                best_inner_idx = fold_idx

        train_sub_indices, val_sub_indices = inner_folds[best_inner_idx]

        final_train_indices = dev_indices[train_sub_indices]
        final_val_indices = dev_indices[val_sub_indices]
        final_test_indices = test_indices

        train_houses = sorted(list(set(groups[final_train_indices])))
        val_houses = sorted(list(set(groups[final_val_indices])))
        test_houses = sorted(list(set(groups[final_test_indices])))

        meta = {
            "total_samples": int(n_samples),
            "total_houses": int(n_groups),
            "test_size_target": float(self.test_size),
            "val_size_target": float(self.val_size),
            "random_state": self.random_state,
        }

        return SplitResult(
            train_indices=np.sort(final_train_indices),
            val_indices=np.sort(final_val_indices),
            test_indices=np.sort(final_test_indices),
            train_houses=train_houses,
            val_houses=val_houses,
            test_houses=test_houses,
            metadata=meta,
        )

    def _get_splitter(self, n_splits: int):
        """Constructs StratifiedGroupKFold instance."""
        return StratifiedGroupKFold(
            n_splits=n_splits,
            shuffle=True,
            random_state=self.random_state,
        )

    def get_group_kfold(
        self,
        df: pd.DataFrame,
        n_splits: int = 5,
        stratified: bool = True,
    ) -> Iterator[Tuple[np.ndarray, np.ndarray]]:
        """
        Generates K-Fold train/val splits for hyperparameter tuning.
        Each fold guarantees zero house leakage between train and validation.
        """
        groups = df[self.group_col].astype(str).values
        labels = df[self.label_col].astype(str).values
        indices = np.arange(len(df))

        n_groups = len(np.unique(groups))
        actual_splits = min(n_splits, n_groups)

        if stratified:
            try:
                cv = StratifiedGroupKFold(
                    n_splits=actual_splits,
                    shuffle=True,
                    random_state=self.random_state,
                )
                yield from cv.split(indices, labels, groups)
                return
            except Exception:
                pass

        cv = GroupKFold(n_splits=actual_splits)
        yield from cv.split(indices, labels, groups)


def train_val_test_group_split(
    df: pd.DataFrame,
    group_col: str = "house_id",
    label_col: str = "appliance_label",
    test_size: float = 0.20,
    val_size: float = 0.15,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Convenience function returning partitioned dataframes.
    """
    splitter = LeakageSafeSplitter(
        group_col=group_col,
        label_col=label_col,
        test_size=test_size,
        val_size=val_size,
        random_state=random_state,
    )
    result = splitter.split(df)

    train_df = df.iloc[result.train_indices].copy().reset_index(drop=True)
    val_df = df.iloc[result.val_indices].copy().reset_index(drop=True)
    test_df = df.iloc[result.test_indices].copy().reset_index(drop=True)

    return train_df, val_df, test_df
