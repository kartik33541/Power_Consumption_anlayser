"""
Consistent Mode Ordering (Semantic Mode Alignment) Engine for Phase 5.
Sorts decomposed VMD modes deterministically by ascending center frequency or descending energy,
ensuring consistent physical columns across all samples in downstream tabular feature extraction.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import numpy as np

from datasets.base import VMDRecord


def order_modes(
    modes: np.ndarray,
    center_frequencies: np.ndarray,
    rule: str = "center_frequency",
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Sorts VMD modes either by ascending center frequency or descending energy.

    Args:
        modes: (K, N) 2D array of modal time series.
        center_frequencies: (K,) 1D array of center frequencies in Hz.
        rule: 'center_frequency' (ascending frequency) or 'energy' (descending energy).

    Returns:
        (sorted_modes, sorted_center_frequencies, permutation_indices)
    """
    if modes.ndim != 2:
        raise ValueError(f"modes must be a 2D array of shape (K, N), got ndim={modes.ndim}")
    if center_frequencies.ndim != 1 or len(center_frequencies) != modes.shape[0]:
        raise ValueError("center_frequencies must be 1D with length matching modes.shape[0]")

    if rule == "center_frequency":
        idx = np.argsort(center_frequencies)
    elif rule == "energy":
        energies = np.sum(modes ** 2, axis=1)
        idx = np.argsort(-energies)
    else:
        raise ValueError(f"Unknown mode ordering rule: '{rule}', expected 'center_frequency' or 'energy'")

    return modes[idx], center_frequencies[idx], idx


def detect_mode_clashes(
    center_frequencies_sorted: np.ndarray,
    tolerance_hz: float = 15.0,
) -> Tuple[bool, List[Dict[str, Any]]]:
    """
    Detects whether any adjacent decomposed modes have collapsed / clashed into the same frequency band.

    Args:
        center_frequencies_sorted: 1D array of sorted center frequencies in Hz.
        tolerance_hz: Minimum frequency separation (in Hz) between distinct physical modes.

    Returns:
        (has_clash, clash_details_list)
    """
    if len(center_frequencies_sorted) < 2:
        return False, []

    diffs = np.diff(center_frequencies_sorted)
    clashes: List[Dict[str, Any]] = []

    for i, diff in enumerate(diffs):
        if diff < tolerance_hz:
            clashes.append({
                "mode_pair": (int(i), int(i + 1)),
                "freq_lower_hz": round(float(center_frequencies_sorted[i]), 2),
                "freq_upper_hz": round(float(center_frequencies_sorted[i + 1]), 2),
                "separation_hz": round(float(diff), 2),
            })

    has_clash = len(clashes) > 0
    return has_clash, clashes


def order_vmd_record(
    record: VMDRecord,
    config: Optional[Dict[str, Any]] = None,
) -> VMDRecord:
    """
    Enforces deterministic mode ordering on a VMDRecord.
    
    1. Reorders modes by ascending center frequency (or energy).
    2. Detects mode duplication or frequency clashing.
    3. Preserves mathematical reconstruction SNR and L2 error norms.
    4. Preserves full provenance (house_id, recording_id, window_type, label).
    5. Appends ordering metadata and updates preprocessing history.

    Returns:
        New certified VMDRecord with consistently sorted modes.
    """
    cfg = config or {}
    rule = cfg.get("mode_ordering_rule", "center_frequency")
    clash_tol = cfg.get("mode_clash_tolerance_hz", 15.0)

    # 1. Sort modes deterministically
    sorted_modes, sorted_freqs, perm_indices = order_modes(
        record.modes,
        record.center_frequencies_hz,
        rule=rule,
    )

    # 2. Check for mode collapse / clashing
    has_clash, clashes = detect_mode_clashes(sorted_freqs, tolerance_hz=clash_tol)

    # 3. Update metadata
    new_metadata = dict(record.metadata)
    new_metadata["mode_ordering"] = {
        "rule": rule,
        "permutation_indices": perm_indices.tolist(),
        "original_frequencies_hz": np.round(record.center_frequencies_hz, 2).tolist(),
        "sorted_frequencies_hz": np.round(sorted_freqs, 2).tolist(),
        "mode_clash_detected": has_clash,
        "clashes": clashes,
        "is_sorted": True,
    }

    # Record preprocessing history
    history = list(new_metadata.get("preprocessing_history", []))
    history.append("consistent_mode_ordering")
    new_metadata["preprocessing_history"] = history

    # Return new canonical VMDRecord with sorted modes
    return VMDRecord(
        record_id=f"{record.record_id}_sorted",
        parent_window_id=record.parent_window_id,
        parent_signal_id=record.parent_signal_id,
        recording_id=record.recording_id,
        source_dataset=record.source_dataset,
        house_id=record.house_id,
        sampling_rate_hz=record.sampling_rate_hz,
        window_type=record.window_type,
        K=record.K,
        modes=sorted_modes,
        center_frequencies_hz=sorted_freqs,
        reconstruction_snr_db=record.reconstruction_snr_db,
        reconstruction_error_norm=record.reconstruction_error_norm,
        appliance_label=record.appliance_label,
        appliance_instance_id=record.appliance_instance_id,
        metadata=new_metadata,
    )
