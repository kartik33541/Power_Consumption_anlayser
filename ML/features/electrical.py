"""
Electrical metric extraction from canonical SignalRecords and WindowRecords.
Implements IEEE 1459 macroscopic power quantities, power factor, harmonic distortion,
and waveform geometry metrics for Non-Intrusive Load Monitoring.
"""

from typing import Any, Dict, Optional, Union
import numpy as np
from datasets.base import SignalRecord, WindowRecord


def compute_thd_fft(signal: np.ndarray, eps: float = 1e-12) -> float:
    """
    Computes Total Harmonic Distortion (THD) via FFT.
    THD = sqrt(sum(H_n^2 for n >= 2)) / H_1.
    """
    if len(signal) == 0:
        return 0.0
    rfft_mag = np.abs(np.fft.rfft(signal))
    if len(rfft_mag) <= 1:
        return 0.0
    # Omit DC component at bin 0
    ac_mags = rfft_mag[1:]
    if len(ac_mags) == 0:
        return 0.0
    fund_idx = int(np.argmax(ac_mags))
    fund_mag = ac_mags[fund_idx]
    if fund_mag < eps:
        return 0.0
    total_harmonic_energy = np.sum(ac_mags ** 2) - (fund_mag ** 2)
    return float(np.sqrt(max(0.0, total_harmonic_energy)) / (fund_mag + eps))


def extract_electrical_features(
    record: Union[SignalRecord, WindowRecord],
    fundamental_current: Optional[np.ndarray] = None,
    fundamental_voltage: Optional[np.ndarray] = None,
    eps: float = 1e-12,
) -> Dict[str, float]:
    """
    Computes rigorous electrical features from voltage and current in a record.

    Features computed:
      - Current statistics: i_rms, i_peak, i_ptp, i_crest_factor, i_form_factor, i_thd
      - Voltage statistics: v_rms, v_peak, v_ptp, v_crest_factor, v_form_factor, v_thd
      - Power quantities (IEEE 1459):
          * active_power_p: Real power P [W]
          * apparent_power_s: Apparent power S [VA]
          * reactive_power_q: Reactive power Q [VAR]
          * distortion_power_d: Budeanu distortion power D [VAR]
          * power_factor: True power factor P / S [-1, 1]
          * displacement_power_factor: cos(phi_1) [-1, 1] (if fundamental is available)

    Guarantees:
      - Bounded values (PF in [-1, 1], THD >= 0)
      - Zero NaNs / Infs on zero-current or standby conditions
      - Graceful fallback when voltage is missing
    """
    if record.current is None or len(record.current) == 0:
        return {}

    current = np.asarray(record.current, dtype=np.float64)
    n_samples = len(current)

    # 1. Current waveform metrics
    i_mean_sq = float(np.mean(current ** 2))
    i_rms = float(np.sqrt(max(0.0, i_mean_sq)))
    i_abs = np.abs(current)
    i_peak = float(np.max(i_abs)) if n_samples > 0 else 0.0
    i_ptp = float(np.ptp(current)) if n_samples > 0 else 0.0
    i_mean_abs = float(np.mean(i_abs)) if n_samples > 0 else 0.0

    # Guard against zero-current standby
    if i_rms < 1e-5:
        i_crest_factor = 0.0
        i_form_factor = 0.0
        i_thd = 0.0
    else:
        i_crest_factor = float(i_peak / (i_rms + eps))
        i_form_factor = float(i_rms / (i_mean_abs + eps))
        if fundamental_current is not None and len(fundamental_current) == n_samples:
            i1_rms = float(np.sqrt(max(0.0, np.mean(fundamental_current ** 2))))
            if i1_rms > 1e-5:
                harm_energy = max(0.0, (i_rms ** 2) - (i1_rms ** 2))
                i_thd = float(np.sqrt(harm_energy) / (i1_rms + eps))
            else:
                i_thd = 0.0
        else:
            i_thd = compute_thd_fft(current, eps=eps)

    features: Dict[str, float] = {
        "current_rms": i_rms,
        "current_peak": i_peak,
        "current_ptp": i_ptp,
        "current_crest_factor": i_crest_factor,
        "current_form_factor": i_form_factor,
        "current_thd": i_thd,
    }

    # 2. Voltage and Cross-Channel Power Metrics
    if record.voltage is not None and len(record.voltage) == n_samples:
        voltage = np.asarray(record.voltage, dtype=np.float64)
        v_mean_sq = float(np.mean(voltage ** 2))
        v_rms = float(np.sqrt(max(0.0, v_mean_sq)))
        v_abs = np.abs(voltage)
        v_peak = float(np.max(v_abs)) if n_samples > 0 else 0.0
        v_ptp = float(np.ptp(voltage)) if n_samples > 0 else 0.0
        v_mean_abs = float(np.mean(v_abs)) if n_samples > 0 else 0.0

        if v_rms < 1e-5:
            v_crest_factor = 0.0
            v_form_factor = 0.0
            v_thd = 0.0
        else:
            v_crest_factor = float(v_peak / (v_rms + eps))
            v_form_factor = float(v_rms / (v_mean_abs + eps))
            v_thd = compute_thd_fft(voltage, eps=eps)

        # Macroscopic Powers
        p_active = float(np.mean(voltage * current))
        s_apparent = float(v_rms * i_rms)

        if s_apparent < 1e-5:
            power_factor = 0.0
            q_reactive = 0.0
            d_distortion = 0.0
            dpf = 0.0
        else:
            raw_pf = p_active / (s_apparent + eps)
            power_factor = float(np.clip(raw_pf, -1.0, 1.0))

            # Fundamental quantities if fundamental current is available
            if fundamental_current is not None and len(fundamental_current) == n_samples:
                v1 = fundamental_voltage if fundamental_voltage is not None else voltage
                v1_rms = float(np.sqrt(max(0.0, np.mean(v1 ** 2))))
                i1_rms = float(np.sqrt(max(0.0, np.mean(fundamental_current ** 2))))
                s1 = float(v1_rms * i1_rms)
                p1 = float(np.mean(v1 * fundamental_current))

                if s1 > 1e-5:
                    dpf = float(np.clip(p1 / (s1 + eps), -1.0, 1.0))
                    q_fund = float(np.sqrt(max(0.0, (s1 ** 2) - (p1 ** 2))))
                else:
                    dpf = 0.0
                    q_fund = 0.0

                q_reactive = q_fund
                # Distortion Power D = sqrt(max(0, S^2 - P^2 - Q^2))
                d_sq = max(0.0, (s_apparent ** 2) - (p_active ** 2) - (q_reactive ** 2))
                d_distortion = float(np.sqrt(d_sq))
            else:
                # Traditional Budeanu approximation
                q_diff = max(0.0, (s_apparent ** 2) - (p_active ** 2))
                q_reactive = float(np.sqrt(q_diff))
                d_distortion = 0.0
                dpf = power_factor

        features.update({
            "voltage_rms": v_rms,
            "voltage_peak": v_peak,
            "voltage_ptp": v_ptp,
            "voltage_crest_factor": v_crest_factor,
            "voltage_form_factor": v_form_factor,
            "voltage_thd": v_thd,
            "active_power_p": p_active,
            "apparent_power_s": s_apparent,
            "reactive_power_q": q_reactive,
            "distortion_power_d": d_distortion,
            "power_factor": power_factor,
            "displacement_power_factor": dpf,
        })

    return features
