/**
 * NILM Signal Lab — Central Content Repository
 * Authoritative master copy for all site sections.
 * Keeping text strictly in this file allows edits without touching React components.
 */

export const CONTENT = {
  header: {
    title: "NILM Signal Lab",
    subtitle: "Bijli ka X-Ray Machine",
    badge: "SIGNAL EXPLAINER",
    themeLight: "Light",
    themeDark: "Dark"
  },

  hero: {
    headline: "One wire. Many appliances. Which ones are on?",
    subheadline: "Non-Intrusive Load Monitoring (NILM) listens to the aggregate electrical waveform at a single mains feed and infers which appliances are active — without smart plugs or rewiring.",
    tagline: "Bijli ka X-Ray Machine",
    waveBadge: "LIVE WAVEFORM (ILLUSTRATIVE SYNTHESIS)",
    mediaBadge: "ILLUSTRATIVE CONCEPT SCENE",
    scrollHint: "Scroll to decompose the signal"
  },

  whyItMatters: {
    badge: "THE PROBLEM SPACE",
    title: "Why Power Line Fingerprinting Matters",
    subtitle: "Traditional energy metering treats a building like a black box — recording only aggregate totals with no visibility into which appliances drove consumption.",
    cards: [
      {
        id: "opaque-bills",
        title: "Unitemized Utility Bills",
        context: "Billing Uncertainty",
        contextNote: "Illustrative scenario",
        stat: "Aggregate Totals Only",
        statSub: "Delayed, unitemized feedback",
        description: "Standard residential meters record only gross energy draw. If a bill arrives significantly higher than expected, determining whether an air conditioner, water heater, or secondary appliance caused the spike is impossible without submetering.",
        imageAlt: "Resident examining an unitemized electricity bill with concern"
      },
      {
        id: "left-on",
        title: "Appliances Left Running",
        context: "Unmonitored Load Baseline",
        contextNote: "Illustrative scenario",
        stat: "Continuous Idle Draw",
        statSub: "Undetected appliance baselines",
        description: "Water heaters left energized past use, cooling units operating in unoccupied rooms, and secondary motors running continuously draw needless power without any warning on conventional meters.",
        imageAlt: "Cutaway view of residential spaces with appliances operating unattended"
      },
      {
        id: "costly-metering",
        title: "Hardware Instrumentation Burden",
        context: "Architectural Comparison",
        contextNote: "Illustrative comparison",
        stat: "N Sockets vs 1 Clamp",
        statSub: "Distributed plugs vs single CT feed",
        description: "Instrumenting every wall outlet with dedicated smart plugs requires purchasing, configuring, and maintaining dozens of separate devices. NILM measures once at the mains junction to disaggregate all downstream loads.",
        imageAlt: "Comparison between multiple individual smart plugs and a single non-invasive CT clamp"
      }
    ]
  },

  theProblem: {
    badge: "PHYSICAL COUPLING",
    title: "The Superposition Challenge",
    subtitle: "All appliances connect in parallel across your 230V mains supply. Current draws sum linearly into one entangled aggregate signal.",
    formula: "x(t) = AC(t) + Fridge(t) + Fan(t) + noise(t)",
    instruction: "Toggle appliances below to observe how individual current waveforms superimpose into the aggregate mains signal:",
    appliances: [
      {
        id: "ac",
        name: "Air Conditioner (Inverter / Compressor)",
        baseCurrent: 6.2,
        pf: 0.88,
        nature: "Inductive motor with dynamic steady draw",
        badge: "Compressor load"
      },
      {
        id: "fridge",
        name: "Refrigerator",
        baseCurrent: 1.4,
        pf: 0.72,
        nature: "Cyclic inductive compressor with starting surge",
        badge: "Thermostatic load"
      },
      {
        id: "fan",
        name: "Ceiling Fan",
        baseCurrent: 0.35,
        pf: 0.65,
        nature: "Inductive motor with low-order harmonic distortion",
        badge: "Continuous inductive"
      }
    ],
    explanation: "Notice how the total current x(t) preserves features of each contributing load, but phase shifts and harmonics overlap. Untangling this aggregate sum from one measurement point is the central challenge of NILM."
  },

  pipeline: {
    badge: "RUNTIME PIPELINE",
    title: "From Raw Amperes to Appliance States",
    subtitle: "A rigorous 12-stage signal and inference chain converts high-frequency analog waveforms into reliable multi-label appliance predictions.",
    cards: [
      {
        step: "01",
        name: "Mains Feed",
        input: "230V AC Single-Phase, 50 Hz",
        output: "Magnetic flux & raw voltage",
        problem: "Accessing electrical data without stripping live wires or cutting power.",
        solves: "Provides the physical aggregate power conduit for the entire household.",
        doesNotSolve: "Does not separate or identify individual appliances."
      },
      {
        step: "02",
        name: "Sensors (CT + ZMPT)",
        input: "Mains current & voltage",
        output: "Proportional low-voltage AC analog signals (0–1V)",
        problem: "Mains voltage (230V) is lethal and destroys microcontrollers.",
        solves: "SCT-013 CT clamp non-invasively scales current; ZMPT101B galvanically isolates voltage.",
        doesNotSolve: "Does not digitize data or remove analog sensor distortion."
      },
      {
        step: "03",
        name: "ADC Sampling",
        input: "Conditioned analog signals",
        output: "Synchronized digital time series at ~8–10 kHz (or 30 kHz PLAID)",
        problem: "Sampling jitter or phase skew between V and I corrupts power calculations.",
        solves: "Captures steady-state waveforms and high-frequency harmonics up to the 15th harmonic.",
        doesNotSolve: "Higher sampling rate is not source separation; ~8–10 kHz cannot resolve microsecond switching edges."
      },
      {
        step: "04",
        name: "Conditioning & Windowing",
        input: "Continuous raw digital streams",
        output: "Calibrated, cycle-aligned analysis windows",
        problem: "DC offset, clipping, and sensor bias distort spectral features.",
        solves: "Mean subtraction, clipping audits, and dynamic duration windowing (N = Fs × T).",
        doesNotSolve: "Does not interpolate or fabricate missing channels (Universal Data Contract)."
      },
      {
        step: "05",
        name: "Event Detection",
        input: "Windowed active power P(t)",
        output: "Event trigger flag (ON / OFF / Steady-state)",
        problem: "Continuous ML inference drains edge compute and generates false positives.",
        solves: "Monitors step changes (ΔP > 30W) to isolate transients from steady-state periods.",
        doesNotSolve: "Cannot distinguish simultaneous near-coincident switches within the same window."
      },
      {
        step: "06",
        name: "VMD on Current",
        input: "Current waveform window I(t) only",
        output: "K band-limited intrinsic oscillatory modes u_k(t)",
        problem: "FFT assumes stationary harmonics; simple filters suffer from phase distortion.",
        solves: "Decomposes current into compact spectral modes around adaptive center frequencies.",
        doesNotSolve: "VMD is NOT an appliance separator. A mode is NOT an appliance; mixed modes are expected."
      },
      {
        step: "07",
        name: "Semantic Mode Ordering",
        input: "K unordered modes from VMD optimization",
        output: "Deterministically ordered modes (ω₁ < ω₂ < ... < ω_K)",
        problem: "Unconstrained VMD index assignment scrambles tabular feature columns.",
        solves: "Sorts modes strictly by center frequency to enforce reproducible feature columns.",
        doesNotSolve: "Does not prevent mode overlap or frequency collapse when K is chosen poorly."
      },
      {
        step: "08",
        name: "Multi-Domain Features",
        input: "K ordered modes + synchronized Voltage V(t)",
        output: "Candidate feature vector (Time, Spectral, Electrical)",
        problem: "Raw current alone cannot separate resistive and inductive loads.",
        solves: "Fuses per-mode statistical shapes with fundamental V-I metrics: P, Q, S, PF, Crest Factor.",
        doesNotSolve: "V-I loops and transient spikes are not independently reliable under heavily mixed simultaneous loads."
      },
      {
        step: "09",
        name: "Feature Selection & Fusion",
        input: "Candidate feature vector (e.g. 50+ candidates)",
        output: "Compact, non-redundant feature specification (features_v1.json)",
        problem: "High dimensionality causes edge latency and tree overfitting.",
        solves: "Filters collinear features (r > 0.95) and ranks discriminative mutual information.",
        doesNotSolve: "Cannot recover electrical information that was never captured by the front-end."
      },
      {
        step: "10",
        name: "Multi-Label Model",
        input: "Reduced feature vector X",
        output: "Independent class probabilities P(y_i = 1 | X)",
        problem: "Standard multi-class softmax assumes exactly one appliance is ON at a time.",
        solves: "Random Forest with independent per-appliance sigmoid / tree outputs for simultaneous loads.",
        doesNotSolve: "Cannot generalize to unseen appliance classes without open-set confidence rejection."
      },
      {
        step: "11",
        name: "State Tracking & Filter",
        input: "Window-level predictions",
        output: "Stable appliance ON/OFF state ledger",
        problem: "Single-window noise or short motor inrush causes flickering state toggles.",
        solves: "Applies temporal hysteresis and debouncing over consecutive windows.",
        doesNotSolve: "Does not fix prolonged model misclassification."
      },
      {
        step: "12",
        name: "Actionable Dashboard",
        input: "Live state ledger + calculated power P",
        output: "Per-appliance metrics, bill projection, health alerts",
        problem: "Raw IoT telemetry data is unhelpful without behavioral context.",
        solves: "Target architecture: 4 intelligence tiers — live load breakdown, left-on alerts, bill forecast, and maintenance drift.",
        doesNotSolve: "Cannot enforce physical cutoff without an external controllable relay."
      }
    ]
  },

  vmd: {
    badge: "HYPOTHESIS UNDER EVALUATION",
    title: "Variational Mode Decomposition (VMD)",
    subtitle: "VMD decomposes the current waveform into K compact, band-limited modes. It is an empirical hypothesis under test, not an appliance separator.",
    evaluationBadge: "UNDER EVALUATION IN PHASE 10",
    disclaimer: "Illustrative interactive demo. Modes are band-limited frequency slices, not clean individual appliance isolations. A mode is NOT an appliance; mixed contributions are expected.",
    parameters: {
      alpha: 2000,
      kMin: 2,
      kMax: 8,
      kDefault: 5,
      snrTarget: "> 30 dB"
    },
    retentionRule: {
      keepCondition: "Retain VMD if macro F1 gain ≥ +3% over non-VMD baseline with acceptable edge latency.",
      dropCondition: "Drop VMD from production deployment if gain < 1% or edge compute exceeds real-time budget."
    }
  },

  features: {
    badge: "REPRESENTATION LAYER",
    title: "Multi-Domain Feature Vector",
    subtitle: "A machine learning model cannot ingest a raw oscillating waveform directly. We extract physical descriptors across time, spectral, and electrical domains.",
    note: "Dimension is dynamic: K modes × per-mode features + electrical features. (5 × 8 = 40 is an example, not a frozen constant).",
    domains: [
      {
        name: "Time-Domain Shape",
        target: "Extracted per mode u_k(t) and raw current I(t)",
        features: [
          { name: "RMS Current", desc: "Energy magnitude of the oscillatory mode" },
          { name: "Variance (σ²)", desc: "Spread of instantaneous amplitude" },
          { name: "Peak-to-Peak", desc: "Full span between maximum and minimum values" },
          { name: "Crest Factor", desc: "Peak / RMS — distinguishes non-linear SMPS spikes from smooth sine waves" },
          { name: "Form Factor", desc: "RMS / Mean absolute — characterizes waveform profile" },
          { name: "Skewness & Kurtosis", desc: "Higher-order statistical symmetry and tail heaviness" }
        ]
      },
      {
        name: "Frequency-Domain Spectral",
        target: "Derived from mode center frequencies and FFT distribution",
        features: [
          { name: "Center Frequency (ω_k)", desc: "Dynamic center frequency around which the mode is band-limited" },
          { name: "Spectral Centroid", desc: "Center of mass of the power spectrum" },
          { name: "Spectral Spread", desc: "Standard deviation of the spectral distribution" },
          { name: "Dominant Harmonic Ratio", desc: "Ratio of harmonic power to fundamental grid frequency" },
          { name: "Total Harmonic Distortion (THD)", desc: "Quantifies distortion introduced by switched-mode rectifiers" }
        ]
      },
      {
        name: "Electrical Domain (V + I)",
        target: "Computed from synchronized Voltage and Current waveforms",
        features: [
          { name: "Active Power (P)", desc: "True work done: mean(V(t) × I(t)) in Watts" },
          { name: "Apparent Power (S)", desc: "Total circulating energy: V_rms × I_rms in VA" },
          { name: "Reactive Power (Q)", desc: "Magnetic oscillation: √(S² − P²) in VAR (huge motor separator)" },
          { name: "Power Factor (PF)", desc: "Ratio P/S — separates pure heaters (~1.0) from motors (0.6–0.85)" }
        ]
      }
    ]
  },

  model: {
    badge: "CLASSIFICATION ENGINE",
    title: "Multi-Label Supervised Inference",
    subtitle: "Because multiple appliances can be ON simultaneously, the model outputs independent probabilities rather than a single exclusive softmax class.",
    abstractForestNote: "Abstract Random Forest representation mapping joint feature vectors to independent sigmoid outputs.",
    caption: "Illustrative output shape. Final classification decision requires P > 0.5 thresholding.",
    scenarios: [
      {
        id: "fridge_only",
        label: "Fridge Only",
        description: "Cyclic compressor running during steady cooling",
        featuresSummary: "Moderate P (~180W), high Q (~140 VAR), low PF (0.78), Mode 1 fundamental dominant",
        probs: { ac: 0.08, fridge: 0.94, fan: 0.04 }
      },
      {
        id: "ac_fridge",
        label: "AC + Fridge",
        description: "High-power inductive mixture with dual motor harmonics",
        featuresSummary: "High P (~1450W), significant Q (~780 VAR), PF ~0.88, Modes 1 & 3 energized",
        probs: { ac: 0.96, fridge: 0.91, fan: 0.12 }
      },
      {
        id: "ac_fan",
        label: "AC + Fan",
        description: "Heavy compressor load plus continuous low-power ceiling motor",
        featuresSummary: "High P (~1320W), PF ~0.87, distinctive 3rd harmonic spread from fan motor",
        probs: { ac: 0.93, fridge: 0.09, fan: 0.89 }
      },
      {
        id: "all_three",
        label: "AC + Fridge + Fan",
        description: "Triple load simultaneous operation (True disaggregation challenge)",
        featuresSummary: "Total P (~1620W), mixed harmonics across Modes 1, 2, 4, lower apparent crest factor",
        probs: { ac: 0.95, fridge: 0.92, fan: 0.87 }
      }
    ]
  },

  limits: {
    badge: "HONEST ENGINEERING",
    title: "Limitations & Real-World Boundaries",
    subtitle: "NILM is an active, evolving engineering domain. Overclaiming reliability on heavily mixed signals leads to brittle deployments.",
    items: [
      {
        title: "Look-Alike Loads",
        detail: "Resistive appliances like a 1500W electric iron, 1500W geyser, and 1500W electric kettle share virtually identical unity-power-factor sine waves. They cannot be reliably separated by steady-state harmonics alone without duration context."
      },
      {
        title: "Simultaneous Switching",
        detail: "If two appliances turn ON within the same 50–200 ms observation window, their transient startup spikes superimpose. Event-based disaggregation algorithms can miss or fuse these events."
      },
      {
        title: "V-I Trajectory Degradation",
        detail: "While V-I trajectories are crisp discriminators for single isolated devices in clean controlled settings, overlapping non-linear loads distort the 2D loop into an ambiguous composite shape."
      },
      {
        title: "Fixed Mode Count (K)",
        detail: "VMD requires an explicit mode count K. If K is too small, distinct harmonic bands merge; if K is too large, noise gets over-decomposed into spurious duplicate modes."
      },
      {
        title: "Domain Shift Between Homes",
        detail: "Models trained on North American 120V/60Hz data (PLAID) suffer distribution shift when deployed on Indian 230V/50Hz grids with ambient voltage fluctuations (180V–260V)."
      }
    ],
    wordingTable: [
      {
        avoid: "VMD separates the appliances from the signal.",
        sayInstead: "VMD decomposes the current waveform into band-limited frequency modes; appliance identity is learned by the classifier from the combined feature vector."
      },
      {
        avoid: "VMD is proven to make NILM 90% accurate.",
        sayInstead: "VMD is an empirical hypothesis under evaluation; Phase 10 will measure whether it yields a statistically significant F1 gain over baseline."
      },
      {
        avoid: "We run deep neural network disaggregation inside the ESP32.",
        sayInstead: "ESP32 performs sampling, conditioning, and feature extraction; disaggregation runs on a Raspberry Pi or edge processor."
      },
      {
        avoid: "V-I trajectories provide 100% reliable fingerprinting on whole-house mains.",
        sayInstead: "V-I loops work well for isolated appliances; disaggregating heavily mixed simultaneous loads remains an open challenge."
      }
    ]
  },

  tracker: {
    badge: "PROJECT ROADMAP",
    title: "18-Phase Implementation State Machine",
    subtitle: "Execution follows an unyielding engineering contract: no phase begins until its predecessor pass gate is verified against ground truth.",
    note: "Project in active development — the monitoring hardware device and trained disaggregation model are not yet released. All future metrics are marked PENDING until physical pass gates are achieved."
  },

  footer: {
    disclaimer: "Project in active development: the monitoring device and trained model are not yet released. Figures and waveforms on this page are illustrative examples.",
    project: "NILM Signal Lab — Non-Intrusive Load Monitoring",
    tag: "Bijli ka X-Ray Machine"
  }
};
