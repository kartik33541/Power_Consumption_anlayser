"""
Electrical metric extraction from canonical SignalRecords.
Computes active power P, apparent power S, reactive power Q, and power factor.
"""

from typing import Dict
import numpy as np
from datasets.base import SignalRecord


def extract_electrical_features(record: SignalRecord) -> Dict[str, float]:
    """
    Computes electrical features from voltage and current in a SignalRecord.
    If voltage is missing, defaults to RMS current only.
    """
    if record.current is None or len(record.current) == 0:
        return {}

    i_rms = float(np.sqrt(np.mean(record.current ** 2)))
    features: Dict[str, float] = {"i_rms": i_rms}

    if record.voltage is not None and len(record.voltage) == len(record.current):
        v_rms = float(np.sqrt(np.mean(record.voltage ** 2)))
        p_active = float(np.mean(record.voltage * record.current))
        s_apparent = v_rms * i_rms
        # Q = sqrt(S^2 - P^2)
        q_diff = max(0.0, s_apparent ** 2 - p_active ** 2)
        q_reactive = float(np.sqrt(q_diff))
        power_factor = float(p_active / (s_apparent + 1e-12))

        features.update({
            "v_rms": v_rms,
            "active_power_p": p_active,
            "apparent_power_s": s_apparent,
            "reactive_power_q": q_reactive,
            "power_factor": power_factor,
        })

    return features
