/**
 * Master Phase-Wise Implementation Status (Phases 0 - 17)
 * Authoritative source: Phase_Wise_Implementation_Plan.md
 */

export const PHASES_DATA = [
  {
    phase: 0,
    title: "Project Contract & Pipeline Skeleton",
    status: "passed",
    statusLabel: "PASSED",
    summary: "Establish canonical SignalRecord contract, universal abstract adapters, and unit test harness.",
    passGate: "Unit tests pass on synthetic signals; invariant checks prevent format leakage.",
    details: "Universal data contract defined in ML/datasets/base.py. Absolute 1D float arrays, explicit Fs > 0, strict separation of features X and ground-truth Y."
  },
  {
    phase: 1,
    title: "PLAID Dataset Ingestion & Universal Adapter",
    status: "passed",
    statusLabel: "PASSED",
    summary: "Ingest 1,876 submetered PLAID recordings (30 kHz, ~120V, 60Hz) via streaming adapter.",
    passGate: "1:1 match with metadata_submetered.json (1,876 files); zero NaNs/Infs found; diagnostic plots verified.",
    details: "North American 60Hz mains, 16 appliance classes across 56 homes. Instantaneous current (col 0) & voltage (col 1)."
  },
  {
    phase: 2,
    title: "Raw Signal Validation & Preprocessing Policy",
    status: "current",
    statusLabel: "CURRENT",
    summary: "Audit DC bias, sensor clipping, and phase synchronization across all recordings.",
    passGate: "All 1,876 records audited; DC offsets handled; absolute current amplitudes strictly preserved without destructive normalization.",
    details: "Active focus: ensuring sensor offset subtraction and clipping detection without corrupting physical Ampere scale."
  },
  {
    phase: 3,
    title: "Windowing & Event / Steady-State Representation",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Configurable dynamic windowing (samples = Fs × duration) for steady-state and activation transients.",
    passGate: "No hardcoded sample counts; window duration configurable (20, 50, 100, 200 ms); ΔP > 30W threshold validated.",
    details: "Separates steady operating windows from startup transient bursts while tracking home ID."
  },
  {
    phase: 4,
    title: "Variational Mode Decomposition (VMD) Implementation",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Decompose current waveforms I(t) into K band-limited intrinsic oscillatory modes.",
    passGate: "VMD executes without numerical divergence; reconstruction SNR > 30 dB; K configurable (3–7).",
    details: "Decomposes current ONLY. Evaluates α=2000 default. No mode is assumed to map directly to an appliance."
  },
  {
    phase: 5,
    title: "Consistent Mode Ordering (Semantic Alignment)",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Sort modes deterministically by center frequency so mode indices map consistently across samples.",
    passGate: "Center frequency sorting ω₁ < ω₂ < ... < ω_K verified; zero index permutation leakage.",
    details: "Ensures column 0 always represents the fundamental band and subsequent columns represent ascending harmonic bands."
  },
  {
    phase: 6,
    title: "Multi-Domain Feature Extraction",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Extract time-domain, spectral, and electrical (P, Q, S, PF) domain features into candidate tabular matrix.",
    passGate: "Zero NaNs/Infs; dynamic feature dimension (K × per-mode + electrical); labels strictly decoupled.",
    details: "Combines per-mode statistics with fundamental voltage-current electrical metrics."
  },
  {
    phase: 7,
    title: "Feature Selection & Ablation Analysis",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Eliminate collinear features via Pearson r > 0.95 filter and mutual information ranking.",
    passGate: "Feature selection computed strictly on training folds; held-out test data untouched.",
    details: "Generates features_v1.json specification to minimize model complexity on edge targets."
  },
  {
    phase: 8,
    title: "Leakage-Safe Train / Validation / Test Group Split",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Partition dataset using GroupKFold grouped strictly by residential location (House ID).",
    passGate: "Zero house overlap between train and test splits; prevents inflated evaluation accuracy.",
    details: "Tests true generalization across unseen homes rather than memorizing room-specific background noise."
  },
  {
    phase: 9,
    title: "Random Forest & XGBoost Baseline Modeling",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Train explainable tree-based tabular classifiers on engineered multi-domain feature vectors.",
    passGate: "Full confusion matrix and per-class metrics reported; baseline accuracy targets established.",
    details: "Fast training, low compute, interpretable feature importances."
  },
  {
    phase: 10,
    title: "Empirical Proof: Does VMD Actually Add Value?",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Rigorous 3-way ablation benchmark: No-VMD baseline vs. VMD-only vs. Combined features.",
    passGate: "Formal retention decision: Retain if F1 gain ≥ +3% with viable edge latency; drop if < 1%.",
    details: "Critical gate: VMD is an empirical hypothesis under evaluation, not a mandatory production dogma."
  },
  {
    phase: 11,
    title: "HIFDA Cross-Dataset High-Frequency Validation",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Cross-dataset generalization check on 100 kHz industrial dataset.",
    passGate: "Pipeline handles missing 50 Hz fundamental in HIFDA without fabricating artificial signals.",
    details: "Evaluates current-only high-frequency harmonics and domain adaptation."
  },
  {
    phase: 12,
    title: "iAWE Indian Household Context Baseline",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Evaluate low-frequency electrical disaggregation under authentic New Delhi 230V grid fluctuations.",
    passGate: "73-day multi-channel iAWE records aligned; Indian voltage sag/surge behavior modeled.",
    details: "Macro electrical metric analysis (1 Hz P/Q/S), completely separated from raw VMD waveform work."
  },
  {
    phase: 13,
    title: "Unknown & Unseen Appliance Rejection Evaluation",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Prevent closed-world misclassification by thresholding confidence score τ (0.5 – 0.9).",
    passGate: "Reliable 'UNKNOWN' state emitted when max class probability < τ on leave-one-appliance-out tests.",
    details: "Ensures novel or unmonitored devices do not cause false alarms."
  },
  {
    phase: 14,
    title: "Own Hardware Sensor Adapter (SCT-013 & ZMPT101B)",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Integrate prototype split-core CT clamp and voltage transformer readings via ADC.",
    passGate: "Raw ADC counts calibrated to physical Amperes and Volts verified with laboratory multimeter.",
    details: "Feeds real laboratory prototype measurements directly into canonical SignalRecord pipeline."
  },
  {
    phase: 15,
    title: "Real-Data Revalidation & Domain Shift Adaptation",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Quantify and bridge domain gap between public dataset training and real laboratory testbed.",
    passGate: "Achieve ≥ 90% classification target on 6 core target appliances via fine-tuning.",
    details: "Tests transfer learning and sensor calibration curves under Indian grid voltages."
  },
  {
    phase: 16,
    title: "Edge Deployment Pipeline (Raspberry Pi / ESP32)",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Compile validated signal-processing and inference pipeline onto embedded hardware.",
    passGate: "Numerical equivalence (< 0.1% drift) between Python and edge C++; sampling jitter < 100 µs; inference ≤ 200 ms.",
    details: "Optimized fixed-point/int8 math running within real-time embedded budget."
  },
  {
    phase: 17,
    title: "Final End-to-End System Validation & Demonstration",
    status: "locked",
    statusLabel: "LOCKED",
    summary: "Live physical acceptance test: 'Bijli ka X-Ray Machine' disaggregating household loads.",
    passGate: "Real-time non-invasive detection, live active power estimation, and telemetry to dashboard.",
    details: "Final project evaluation and demonstration of the complete prototype."
  }
];
