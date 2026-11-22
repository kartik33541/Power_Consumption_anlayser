# Phase Implementation Plan — NILM / Power Consumption Analyzer

## Purpose

This document is the implementation contract for building the NILM pipeline before the team's final real-world sensor dataset is available.

The immediate goal is to make approximately **80% of the reusable signal-processing + ML pipeline functional and verifiable now**, while leaving approximately 20% configurable for the final SCT-013 / ZMPT101B / ADC dataset.

The target architecture is:

```text
Raw electrical measurements
        ↓
Dataset / sensor adapter
        ↓
Canonical V/I representation
        ↓
Calibration + cleaning
        ↓
Synchronization
        ↓
Window / event preparation
        ↓
VMD
        ↓
Consistent mode ordering
        ↓
Feature extraction
        ↓
Feature selection
        ↓
ML baseline
        ↓
Unknown / rejection evaluation
        ↓
Cross-dataset validation
        ↓
Own sensor-data validation
        ↓
Deployment
```

---

# NON-NEGOTIABLE RULE FOR THE LOCAL AGENT

The local agent must work phase-by-phase.

**Never advance to a later phase if the previous phase has not passed its PASS GATE.**

If a prerequisite is missing, ambiguous, broken, or not verified:

1. Stop.
2. State exactly which gate failed.
3. Do not invent missing dataset structure, labels, sampling rates, thresholds, VMD parameters, or model performance.
4. Inspect the required artifact if it is available.
5. Otherwise request the missing artifact.
6. Never silently mark a phase complete.

Every phase contains:

- Goal
- Objective
- Why it exists
- Order of progress
- Inputs
- Outputs
- Implementation tasks
- Verification
- Failure conditions
- PASS GATE
- HARD ENTRY GATE for the next phase

---

# PHASE 0 — PROJECT CONTRACT AND PIPELINE SKELETON

## Goal

Before downloading or processing any dataset, define exactly what the rest of the pipeline expects from a dataset.

The purpose is to prevent PLAID-specific, HIFDA-specific, iAWE-specific, or future sensor-specific code from leaking into VMD, feature extraction, and ML.

The intended structure is:

```text
PLAID files ───────→ PLAID Adapter ──────┐
                                         │
HIFDA files ───────→ HIFDA Adapter ──────┤
                                         ├→ Canonical SignalRecord
iAWE files ────────→ iAWE Adapter ───────┤
                                         │
Own sensor data ───→ OwnData Adapter ────┘
```

Everything after the adapter boundary should operate on the canonical representation.

## What Phase 0 actually means

**Do NOT download the dataset yet.**

Phase 0 is software architecture and interface design.

You are deciding:

> "Regardless of where the electrical signal came from, what exact object will my preprocessing/VMD/features/model code receive?"

You are not yet deciding the final physical sensor values, final sampling rate, final window size, or final number of VMD modes.

## Why this phase exists

Without Phase 0, code tends to become:

```text
read PLAID CSV
→ hardcoded PLAID assumptions
→ VMD
→ features
→ model
```

Later, when the team's real sensor data arrives, you discover:

- ADC counts instead of physical units
- different sampling frequency
- DC bias
- different channel names
- different signal lengths
- sensor noise
- voltage/current timing differences

and have to rewrite downstream code.

Instead:

```text
source-specific world
        ↓
     adapter
        ↓
standard internal world
```

## Canonical SignalRecord

Define a documented internal representation containing at least:

```text
signal_id
source_dataset
recording_id
session_id              # if available
appliance_label         # if available
appliance_instance_id   # if available
voltage                 # array or None
current                 # array or None
sampling_rate_hz
timestamp               # if available
window_start
window_end
event_type              # if known
metadata
```

Do not fabricate missing fields.

For example, a dataset may not provide a session ID. That field must then be `None`/missing, not invented.

## Canonical invariants

### Rule 1 — Current is a time series

```text
I = [I0, I1, I2, ...]
```

### Rule 2 — Voltage is a time series when available

```text
V = [V0, V1, V2, ...]
```

### Rule 3 — Sampling rate must be explicit

Never globally hardcode `Fs = 10 kHz` or `Fs = 30 kHz`.

### Rule 4 — Labels are separate from features

```text
X = measurements/features
Y = ground truth
```

The appliance label must never accidentally enter X.

### Rule 5 — Source identity is preserved

Every record should know:

```text
PLAID / HIFDA / iAWE / OWN
```

This is essential for cross-dataset evaluation.

## Repository skeleton

Create:

```text
project/
│
├── data/
│   ├── raw/
│   ├── interim/
│   └── processed/
│
├── datasets/
│   ├── base.py
│   ├── plaid_adapter.py
│   ├── hifda_adapter.py
│   ├── iawe_adapter.py
│   └── own_adapter.py
│
├── preprocessing/
│   ├── calibration.py
│   ├── cleaning.py
│   ├── synchronization.py
│   └── windowing.py
│
├── vmd/
│   ├── decomposition.py
│   ├── mode_ordering.py
│   └── reconstruction.py
│
├── features/
│   ├── time_domain.py
│   ├── frequency_domain.py
│   ├── electrical.py
│   └── pipeline.py
│
├── selection/
│   ├── correlation.py
│   ├── mutual_information.py
│   ├── importance.py
│   └── ablation.py
│
├── models/
│   ├── random_forest.py
│   ├── xgboost.py
│   └── neural/
│
├── evaluation/
│   ├── metrics.py
│   ├── confusion.py
│   ├── unknown.py
│   └── cross_dataset.py
│
├── inference/
│   └── pipeline.py
│
├── configs/
│   └── pipeline.yaml
│
└── tests/
```

## Configuration

Keep potentially changing values configurable:

```text
sampling_rate
window_duration
window_samples
VMD_K
VMD_parameters
feature_list
mode_ordering_rule
split_strategy
random_seed
model_parameters
unknown_threshold
```

Do not claim final values yet.

## Inputs

Phase 0 requires no downloaded dataset.

Inputs:

- project objective
- expected sensor architecture
- expected public dataset types
- expected ML outputs

## Outputs

At the end of Phase 0:

1. Repository skeleton.
2. Canonical SignalRecord specification.
3. Dataset adapter interface.
4. Configuration schema.
5. Pipeline diagram.
6. Documented assumptions.
7. Synthetic SignalRecord test.

## Verification

Create a synthetic record containing:

```text
V(t) = known sinusoid
I(t) = known current waveform + optional harmonic
Fs = known test value
label = test_label
```

Verify:

- arrays are valid;
- sampling rate is valid;
- metadata survives;
- labels remain separate;
- downstream code accepts the object;
- no source-specific file format is referenced.

## Failure conditions

Phase 0 fails if:

- downstream code directly depends on PLAID file names;
- sampling rate is globally hardcoded;
- `400 samples` is treated as universal;
- labels are mixed into features;
- missing values are fabricated;
- the own-data adapter has no defined boundary.

## PASS GATE — PHASE 0

All must be true:

- [ ] SignalRecord documented.
- [ ] Adapter interface documented.
- [ ] Repository skeleton exists.
- [ ] Configuration mechanism exists.
- [ ] Synthetic SignalRecord test passes.
- [ ] No downstream module depends directly on raw dataset file format.
- [ ] No unverified sampling rate/window length is treated as universal.

### HARD ENTRY GATE FOR PHASE 1

**Phase 1 is LOCKED until every Phase 0 checkbox passes.**

If any checkbox fails: STOP.

---

# PHASE 1 — PLAID DATASET INGESTION

## Goal

Use PLAID as the primary development source for the raw high-frequency voltage/current pipeline.

## Objective

Convert PLAID files into the canonical SignalRecord without doing VMD or ML yet.

PLAID is appropriate for this first stage because it contains high-frequency voltage/current measurements and multiple appliance instances/types.

## Source

User-provided source:

https://figshare.com/articles/dataset/PLAID_-_A_Voltage_and_Current_Measurement_Dataset_for_Plug_Load_Appliance_Identification_in_Households/10084619

The associated dataset literature reports high-frequency V/I measurements and many physical appliance instances. Exact local file structure must be inspected rather than guessed.

## Order

```text
Download
→ inspect directory
→ inspect metadata
→ identify formats
→ identify V/I representation
→ map record → appliance
→ map record → physical instance/session
→ implement adapter
→ load sample records
→ validate
→ scale to selected subset
```

## Inputs

PLAID files and metadata.

## Outputs

Canonical records containing, where available:

```text
V
I
Fs
label
recording_id
instance_id
session_id
metadata
```

## First implementation

Do not process the whole dataset immediately.

Load 5–10 records first.

For each inspect:

- file name
- columns
- sample count
- sampling rate
- voltage range
- current range
- appliance label
- recording/session information
- physical appliance identity if available

## Appliance subset

Initially select approximately 5–6 classes only after inspecting the actual metadata.

Prefer a mixture of electrical behaviors:

```text
resistive
motor
SMPS/electronic
compressor
```

Do not claim a class exists until the metadata confirms it.

## Verification

For at least 5–10 records:

1. Load V.
2. Load I.
3. Check lengths.
4. Verify Fs from metadata.
5. Plot V(t).
6. Plot I(t).
7. Confirm label.
8. Confirm record identity.
9. Confirm physical-instance/session information where available.

## PASS GATE — PHASE 1

- [ ] Dataset downloaded.
- [ ] Directory structure documented.
- [ ] Metadata mapping understood.
- [ ] Raw V/I loaded successfully.
- [ ] Sampling rate verified from source.
- [ ] Appliance labels verified.
- [ ] 5–10 records plotted and inspected.
- [ ] PLAID adapter outputs valid SignalRecords.
- [ ] No guessed column names/labels remain.

### HARD ENTRY GATE FOR PHASE 2

**Phase 2 remains LOCKED until Phase 1 passes completely.**

---

# PHASE 2 — RAW SIGNAL VALIDATION AND PREPROCESSING

## Goal

Convert raw PLAID waveforms into clean, correctly interpreted electrical signals without destroying appliance information.

## Objective

Establish:

```text
raw V/I
 ↓
validated V/I
```

before VMD.

## Inputs

SignalRecords from Phase 1.

## Outputs

Validated signals:

```text
V_clean
I_clean
Fs
metadata
```

## Order

```text
raw
→ NaN/missing check
→ length check
→ offset check
→ range/outlier inspection
→ synchronization check
→ filtering only if justified
→ validated signal
```

## Important: do not blindly normalize amplitude

Amplitude can contain appliance information.

Test:

1. amplitude-preserving representation;
2. shape-normalized representation.

Do not choose one merely because it is common in ML.

## DC offset

Inspect:

```text
mean(V)
mean(I)
```

If an offset exists, determine whether it is physical or a measurement artifact before removing it.

## Sampling rate

Read and verify the actual source metadata.

## Verification

For representative records:

- inspect NaNs/infinities;
- inspect amplitude;
- inspect offset;
- inspect V/I alignment;
- inspect waveform before/after any transformation.

## PASS GATE — PHASE 2

- [ ] No unexplained NaNs.
- [ ] Signal lengths understood.
- [ ] V/I synchronization understood.
- [ ] Fs verified.
- [ ] Offset behavior documented.
- [ ] Filtering justified.
- [ ] No destructive normalization without an experiment.
- [ ] Cleaned signals plot correctly.

### HARD ENTRY GATE FOR PHASE 3

**Phase 3 is LOCKED until Phase 2 passes.**

---

# PHASE 3 — WINDOWING AND EVENT / STEADY-STATE REPRESENTATION

## Goal

Define exactly what constitutes one ML sample.

## Objective

Transform a recording into meaningful windows.

## Critical formula

```text
number_of_samples = sampling_rate × duration
```

Therefore never hardcode:

```text
400 samples = one event
```

For example, 400 samples corresponds to 40 ms only at 10 kHz.

## Window types

Initially support:

### A. Steady-state window

A period of stable operation.

### B. Transient/event window

A period around activation/deactivation where the source supports it.

Keep the type explicit.

## Inputs

Clean SignalRecords.

## Outputs

WindowRecord:

```text
window_id
recording_id
V_window
I_window
Fs
window_start
window_end
window_type
label
instance_id/session_id
source_dataset
```

## Verification

For several recordings:

- plot the full recording;
- mark window boundaries;
- plot extracted window;
- verify V/I time bases;
- verify sample count;
- verify no unintended truncation.

## PASS GATE — PHASE 3

- [ ] Window duration configurable.
- [ ] Sample count derived from Fs.
- [ ] Steady-state windows generated.
- [ ] Transient/event windows representable.
- [ ] Metadata preserved.
- [ ] Windows manually inspected.
- [ ] Random slicing is not being used as a substitute for event logic.

### HARD ENTRY GATE FOR PHASE 4

**Phase 4 is LOCKED until Phase 3 passes.**

---

# PHASE 4 — VMD IMPLEMENTATION

## Goal

Introduce Variational Mode Decomposition as a signal representation stage.

## Objective

Determine whether decomposing an electrical waveform into band-limited modes creates useful information for appliance recognition.

VMD is not a classifier.

Conceptually:

```text
x(t)
 ↓
VMD
 ↓
u1(t), u2(t), ..., uK(t)
```

The modes must not be interpreted as automatic appliance identities.

## Inputs

Validated signal windows.

Initial primary signal:

```text
current I(t)
```

Voltage can be tested separately.

## Outputs

For each window:

- K modes
- center frequencies
- VMD parameters
- reconstructed signal
- reconstruction error

## Parameter policy

Do not permanently assume K=5.

Test a configurable set, for example:

```text
K = 3,4,5,6,7
```

Keep VMD parameters configurable.

## Order

```text
window
→ VMD
→ modes
→ center-frequency calculation
→ mode ordering
→ reconstruction
→ reconstruction error
```

## Verification

For representative windows:

1. Plot original.
2. Plot each mode.
3. Plot reconstruction.
4. Calculate reconstruction error.
5. Record center frequencies.
6. Check behavior across multiple windows.

## PASS GATE — PHASE 4

- [ ] VMD executes.
- [ ] K configurable.
- [ ] VMD parameters configurable.
- [ ] Modes plotted.
- [ ] Reconstruction measured.
- [ ] Reconstruction error recorded.
- [ ] No mode-to-appliance mapping is assumed.
- [ ] Current VMD works.
- [ ] Voltage VMD is either tested or explicitly marked as a later experiment.

### HARD ENTRY GATE FOR PHASE 5

**Phase 5 is LOCKED until VMD reconstruction and mode behavior are verified.**

---

# PHASE 5 — CONSISTENT MODE ORDERING

## Goal

Ensure `mode1_*` means the same type of mode across samples.

## Problem

VMD output order must not be assumed to be semantically stable.

If mode positions change meaning between records, the feature matrix becomes inconsistent.

## Initial solution

Calculate center frequency for every mode and sort:

```text
lowest center frequency → mode 1
next → mode 2
...
highest → mode K
```

Keep the ordering rule documented.

## Inputs

VMD modes.

## Outputs

Deterministically ordered modes.

## Verification

Run ordering over a large random sample.

Check:

```text
CF(mode1) < CF(mode2) < ... < CF(modeK)
```

according to the defined sorting rule.

Inspect for duplicated/collapsed modes.

## PASS GATE — PHASE 5

- [ ] Ordering rule documented.
- [ ] Ordering deterministic.
- [ ] Tested on many windows.
- [ ] Center frequencies stored.
- [ ] Feature names use ordered mode IDs.

### HARD ENTRY GATE FOR PHASE 6

**Phase 6 is LOCKED until mode ordering is deterministic.**

---

# PHASE 6 — FEATURE EXTRACTION

## Goal

Convert waveform/mode information into numerical ML features.

## Objective

Create a candidate feature library. Do not prematurely decide the final feature count.

## Candidate time-domain features

```text
mean
std
RMS
peak
peak-to-peak
crest factor
skewness
kurtosis
```

## Candidate frequency-domain features

```text
center frequency
dominant frequency
bandwidth
spectral energy
spectral entropy
```

## Candidate electrical features

When synchronized V/I permit:

```text
Vrms
Irms
P
S
Q
PF
Ipeak
crest factor
harmonic features
```

## Candidate transient features

Only where the window actually contains a transient:

```text
startup peak
rise time
decay characteristics
transient energy
duration
```

## VMD feature policy

Do not freeze:

```text
5 modes × 8 = 40
```

Use:

```text
K modes × candidate features
```

and determine the final dimension experimentally.

## Inputs

Ordered VMD modes + validated electrical signals.

## Outputs

FeatureRecord:

```text
sample_id
feature_1 ... feature_N
label
metadata
```

## Verification

For every feature:

- finite value;
- no NaN/inf;
- sensible range;
- deterministic output;
- manually verify several calculations.

## PASS GATE — PHASE 6

- [ ] Candidate feature library implemented.
- [ ] VMD features work.
- [ ] Electrical features work where valid.
- [ ] Feature values sanity-checked.
- [ ] Feature order documented.
- [ ] Labels separate from X.
- [ ] Final dimension is not assumed to be 40.

### HARD ENTRY GATE FOR PHASE 7

**Phase 7 is LOCKED until candidate features pass numerical sanity checks.**

---

# PHASE 7 — FEATURE SELECTION AND ABLATION

## Goal

Determine the useful feature count empirically.

## Objective

Test whether 40, 20, 15, 10, or another dimension is appropriate.

## Required feature groups

```text
A = electrical features
B = VMD features
C = electrical + VMD
```

Then evaluate reduced versions.

## Required methods

1. Correlation analysis.
2. Mutual information.
3. Random Forest feature importance.
4. Permutation importance.
5. Ablation experiments.

## Important rule

Correlation is evidence of redundancy, not an automatic deletion rule.

A feature with low correlation may still contain information useful for classification.

## Example ablations

```text
all features
remove harmonics
remove transient features
remove VMD features
reduced feature subset
```

Compare validation performance.

## Outputs

Versioned feature specification, e.g.:

```text
features_v1.json
```

containing:

- feature names;
- order;
- calculation;
- units;
- mode association;
- source.

## PASS GATE — PHASE 7

- [ ] Redundancy analyzed.
- [ ] Importance analyzed.
- [ ] Ablation performed.
- [ ] Reduced feature sets evaluated.
- [ ] Current final candidate set selected.
- [ ] Feature order versioned.
- [ ] Test set was not used for feature selection.

### HARD ENTRY GATE FOR PHASE 8

**Phase 8 is LOCKED until the feature specification is frozen for the current experiment.**

---

# PHASE 8 — LEAKAGE-SAFE TRAIN / VALIDATION / TEST SPLIT

## Goal

Produce honest ML evaluation.

## Critical problem

Do not split many nearly identical windows from one recording randomly.

Bad:

```text
one recording
→ 100 windows
→ 90 train
→ 10 test
```

This can produce inflated results.

## Preferred grouping

Where metadata permits, group by:

```text
recording
session
physical appliance instance
```

The exact grouping strategy must be documented.

## Inputs

Feature matrix + metadata.

## Outputs

```text
X_train, y_train
X_val, y_val
X_test, y_test
```

plus split IDs.

## Verification

Check:

- no same-recording leakage;
- class distribution;
- no test-driven feature selection;
- reproducibility.

## PASS GATE — PHASE 8

- [ ] Split strategy documented.
- [ ] Grouping key identified.
- [ ] No same-recording leakage.
- [ ] Test set untouched during feature selection.
- [ ] Class distributions inspected.
- [ ] Split IDs saved.

### HARD ENTRY GATE FOR PHASE 9

**Phase 9 is LOCKED until leakage-safe splitting passes.**

---

# PHASE 9 — RANDOM FOREST AND XGBOOST BASELINES

## Goal

Establish strong tabular baselines.

## Objective

Measure how much information is already present in engineered features before deep learning.

## Models

Train:

```text
Random Forest
XGBoost
```

Tune only using training/validation data.

## Required comparisons

```text
Electrical-only → RF
VMD-only        → RF
Combined        → RF

Electrical-only → XGBoost
VMD-only        → XGBoost
Combined        → XGBoost
```

## Metrics

Single-label:

```text
accuracy
precision
recall
F1
confusion matrix
per-class metrics
```

Multi-label:

```text
per-appliance precision
per-appliance recall
per-appliance F1
macro/micro F1
Hamming loss
subset accuracy where appropriate
```

Do not use accuracy alone.

## Outputs

Save:

```text
model
model configuration
feature specification
metrics
confusion matrix
training metadata
```

## PASS GATE — PHASE 9

- [ ] RF trained.
- [ ] XGBoost trained.
- [ ] Electrical/VMD/combined comparisons done.
- [ ] Validation used for tuning.
- [ ] Test set held out.
- [ ] Per-class metrics generated.
- [ ] Reproducible configuration saved.

### HARD ENTRY GATE FOR PHASE 10

**Phase 10 is LOCKED until baseline results exist.**

---

# PHASE 10 — EMPIRICALLY PROVE OR DISPROVE VMD'S VALUE

## Goal

Answer:

> Does VMD actually improve our NILM representation?

## Required comparison

```text
baseline features
      vs
VMD features
      vs
combined features
```

Measure:

```text
performance
generalization
robustness
feature count
runtime
memory
```

## Possible decisions

### VMD clearly helps

Retain it.

### VMD helps slightly with acceptable cost

Retain if the trade-off is justified.

### VMD gives negligible benefit and large cost

Do not force it into deployment.

### VMD hurts generalization

Investigate and potentially remove it.

## PASS GATE — PHASE 10

A reproducible experiment must show:

```text
without VMD
with VMD
combined
```

and the decision must be based on measured results.

### HARD ENTRY GATE FOR PHASE 11

**VMD must not become a production dependency until this comparison has been completed.**

---

# PHASE 11 — HIFDA CROSS-DATASET VALIDATION

## Goal

Test whether the signal-processing representation transfers to another high-frequency dataset.

The current HIFDA v3 record reports 14 appliances plus an empty grid, 100 kSPS acquisition, 50 windows per appliance, approximately 54,000 samples per full window, and derived shorter windows. It also explicitly states that captured voltage bandwidth begins around 300 Hz, so the 50-Hz fundamental is absent.

Source:

https://zenodo.org/records/14886758

## Critical limitation

HIFDA is excellent for high-frequency waveform/VMD experiments but is not an identical replacement for our eventual synchronized mains V/I measurement.

Do not blindly calculate 50-Hz electrical quantities from a voltage signal that does not contain the 50-Hz fundamental.

## Inputs

HIFDA files.

## Processing

```text
HIFDA
→ adapter
→ canonical representation
→ window
→ VMD
→ same applicable feature definitions
→ saved model
```

Do not silently change features to make performance better.

## PASS GATE — PHASE 11

- [ ] HIFDA adapter works.
- [ ] File structure verified.
- [ ] Bandwidth limitation documented.
- [ ] Same applicable preprocessing/VMD/features executed.
- [ ] Invalid electrical features are not fabricated.
- [ ] Cross-dataset results reported separately.

### HARD ENTRY GATE FOR PHASE 12

**Never merge HIFDA rows into PLAID training merely to increase sample count without a documented domain-normalization experiment.**

---

# PHASE 12 — iAWE INDIAN-CONTEXT EXPERIMENT

## Goal

Use iAWE for Indian household context rather than forcing it through the raw high-frequency VMD pipeline.

Official source:

https://iawe.github.io/

The official site describes approximately 73 days of New Delhi household measurements at meter, circuit and appliance levels, and reports voltage variation of approximately 180–260 V during deployment.

## Objective

Study:

```text
aggregate electrical behavior
+
appliance-level states
+
Indian operating conditions
```

## Representation rule

Treat iAWE as a separate experiment:

```text
iAWE
→ inspect files
→ align timestamps
→ construct appliance states
→ aggregate/appliance analysis
→ Indian-context model
```

Do not present iAWE results as equivalent to high-frequency raw waveform VMD results.

## PASS GATE — PHASE 12

- [ ] Data downloaded.
- [ ] File structure inspected.
- [ ] Timestamp structure verified.
- [ ] Aggregate/appliance relationship verified.
- [ ] ON/OFF/state construction documented.
- [ ] Results kept separate from raw-waveform VMD experiments.

### HARD ENTRY GATE FOR PHASE 13

**Phase 13 is LOCKED until the iAWE experiment is correctly separated from the raw waveform pipeline.**

---

# PHASE 13 — UNKNOWN / UNSEEN APPLIANCE EVALUATION

## Goal

Measure the closed-set limitation of normal classifiers.

## Problem

A model trained on:

```text
Fan
Fridge
TV
Laptop
```

can still be forced to output one of those classes when given:

```text
Washing Machine
```

even if washing machine was never trained.

## First experiment

Leave-one-class-out:

```text
TRAIN:
Fan
Fridge
TV
Laptop

TEST:
Washing Machine
```

Measure whether the system can reject the unseen class.

## Advanced later experiment

Investigate:

```text
Raw waveform
→ 1D CNN
→ embedding
→ prototype/distance
→ known vs unknown
```

and eventually Siamese/metric learning.

Do not make Siamese the first model.

## PASS GATE — PHASE 13

- [ ] At least one unseen-class experiment performed.
- [ ] Closed-set failure behavior documented.
- [ ] Unknown detection treated as a separate requirement.
- [ ] No claim that RF automatically recognizes unseen appliances.
- [ ] Advanced metric learning remains separate from the baseline.

### HARD ENTRY GATE FOR PHASE 14

**No deployment claim without documented unknown-input behavior.**

---

# PHASE 14 — OWN SENSOR DATA ADAPTER

## Goal

Plug the team's actual SCT-013 / ZMPT101B / ADC data into the existing pipeline without rewriting downstream processing.

## Inputs

Actual team dataset.

Possible fields:

```text
timestamp
voltage_adc
current_adc
sampling rate
calibration information
```

The actual structure must be inspected when received.

## Required conversion

```text
Own raw data
→ OwnDataAdapter
→ Canonical SignalRecord
→ existing preprocessing
→ existing VMD
→ existing feature extraction
→ existing model
```

## Expected hardware-specific work

Likely areas:

```text
ADC → physical-unit calibration
DC bias
sensor gain
phase relationship
sampling rate
synchronization
noise
event detection
```

Do not assume exact values before measuring the hardware.

## PASS GATE — PHASE 14

- [ ] OwnDataAdapter implemented.
- [ ] Actual file format inspected.
- [ ] Calibration documented.
- [ ] V/I synchronization verified.
- [ ] Sampling rate verified.
- [ ] Real signals plotted.
- [ ] Existing pipeline consumes own data.
- [ ] Downstream modules do not depend on raw ADC file structure.

### HARD ENTRY GATE FOR PHASE 15

**Phase 15 is LOCKED until own data can pass through the existing pipeline.**

---

# PHASE 15 — REAL-DATA REVALIDATION AND MODEL ADAPTATION

## Goal

Measure the domain shift between public datasets and the team's actual hardware/appliances.

## Why this matters

Public and own data differ in:

```text
sensor
ADC
noise
mains conditions
appliance models
environment
sampling
calibration
```

Therefore public-data accuracy is not deployment accuracy.

## Experiments

### A — Public-trained model → own data

Measure direct transfer.

### B — Own-data training/fine-tuning

Measure adapted performance.

### C — Mixed-domain training

Use only if justified by the experiments.

## Required split

Avoid random windows from one recording appearing in both train and test.

Prefer recording/session/appliance-instance grouping.

## PASS GATE — PHASE 15

- [ ] Public-only performance on own data measured.
- [ ] Own-data adapted model measured.
- [ ] Dataset shift documented.
- [ ] Unknown behavior measured.
- [ ] Simultaneous-load behavior measured if claimed.
- [ ] Error cases manually inspected.

### HARD ENTRY GATE FOR PHASE 16

**No deployment claim until own-data validation passes.**

---

# PHASE 16 — DEPLOYMENT PIPELINE

## Goal

Make the validated pipeline execute on the selected edge platform, such as Raspberry Pi.

## Pipeline

```text
Sensor
→ ADC
→ raw V/I
→ calibration
→ window
→ VMD
→ mode ordering
→ features
→ feature selection
→ model
→ appliance state
```

## Critical requirement

Training and inference must generate the same representation.

Compare offline Python and deployment implementation using identical inputs.

Compare:

```text
VMD modes
features
model input
prediction
```

within documented tolerances.

## Runtime measurements

Record:

```text
VMD runtime
feature runtime
model runtime
total latency
CPU
memory
```

## PASS GATE — PHASE 16

- [ ] Deployment pipeline executes.
- [ ] Same input gives equivalent features.
- [ ] Same model gives equivalent predictions.
- [ ] Runtime measured.
- [ ] Memory measured.
- [ ] VMD cost measured.
- [ ] Invalid-window handling implemented.
- [ ] Sensor/data failure behavior documented.

### HARD ENTRY GATE FOR PHASE 17

**Phase 17 is LOCKED until deployment equivalence is verified.**

---

# PHASE 17 — FINAL END-TO-END VALIDATION

## Goal

Validate the complete project as an actual NILM prototype.

## Test categories

### Single appliance

```text
Fan ON
```

### Different appliance

```text
Fridge ON
```

### Multiple appliances

```text
Fan + Fridge
```

### Transition

```text
Fan OFF → ON
```

### Unknown

```text
unseen appliance
```

### Noise

Realistic measurement noise.

### Voltage variation

Relevant operating conditions.

## Metrics

Record:

```text
accuracy
precision
recall
F1
per-appliance F1
confusion matrix
unknown rejection
latency
CPU
memory
VMD runtime
feature runtime
```

## PASS GATE — PHASE 17

The system is functionally complete only when:

- [ ] End-to-end acquisition works.
- [ ] Processing works.
- [ ] VMD works if retained.
- [ ] Features match training representation.
- [ ] Model inference works.
- [ ] Multiple-appliance behavior evaluated if claimed.
- [ ] Unknown behavior evaluated.
- [ ] Runtime measured.
- [ ] Failure cases documented.
- [ ] Results reproducible.

---

# MASTER PHASE TABLE

| Phase | Required result |
|---|---|
| 0 | Pipeline contract exists |
| 1 | PLAID correctly ingested |
| 2 | Raw signals validated |
| 3 | Windows correctly generated |
| 4 | VMD verified |
| 5 | Modes consistently ordered |
| 6 | Features numerically verified |
| 7 | Features selected experimentally |
| 8 | Leakage-safe split created |
| 9 | RF/XGBoost baselines working |
| 10 | VMD contribution proven/disproven |
| 11 | HIFDA cross-dataset validation |
| 12 | iAWE Indian-context experiment |
| 13 | Unknown-appliance behavior tested |
| 14 | Own sensor adapter working |
| 15 | Own-data revalidation complete |
| 16 | Edge/deployment equivalence verified |
| 17 | End-to-end validation complete |

---

# MASTER ARCHITECTURE

```text
                     REAL HOUSEHOLD
                           │
                  SCT-013 + ZMPT101B
                           │
                           ↓
                     ADC / Acquisition
                           │
                           ↓
                      Canonical V/I
                           │
                           ↓
                  Calibration / Cleaning
                           │
                           ↓
                     Synchronization
                           │
                           ↓
                        Windowing
                           │
                    ┌──────┴──────┐
                    ↓             ↓
                 Current        Voltage
                    │             │
                    ↓             │
                   VMD            │
                    │             │
                    ↓             │
              Ordered Modes       │
                    │             │
                    └──────┬──────┘
                           ↓
                   Feature Extraction
                           ↓
                  Candidate Features
                           ↓
                   Feature Selection
                           ↓
                    Final Feature X
                           ↓
                  RF / XGBoost
                           ↓
              Unknown / State Logic
                           ↓
                  Appliance States
                           ↓
                  Backend / Dashboard
```

---

# LOCAL AGENT STATE MACHINE

The local agent should maintain:

```text
PHASE_0 = NOT_STARTED / IN_PROGRESS / PASSED / FAILED
PHASE_1 = LOCKED
PHASE_2 = LOCKED
...
PHASE_17 = LOCKED
```

Initially:

```text
PHASE_0 = IN_PROGRESS
PHASE_1 = LOCKED
...
PHASE_17 = LOCKED
```

After Phase 0 passes:

```text
PHASE_0 = PASSED
PHASE_1 = UNLOCKED
```

If Phase 0 fails:

```text
PHASE_0 = FAILED
PHASE_1 = LOCKED
```

The agent must never skip a locked phase.

If asked to train a model while Phase 7/8 has not passed, it must not fabricate a feature matrix or split. It must identify the missing prerequisite and stop.

---

# CURRENT ACTION — PHASE 0 ONLY

Do this before downloading PLAID:

1. Create the repository.
2. Create `SignalRecord`.
3. Create the base adapter interface.
4. Create empty:
   - `PLAIDAdapter`
   - `HIFDAAdapter`
   - `iAWEAdapter`
   - `OwnDataAdapter`
5. Create a configuration file.
6. Create a synthetic V/I SignalRecord.
7. Validate that the synthetic record can pass the common interface.
8. Document every assumption.
9. Do not write VMD code yet.
10. Do not download/process the real datasets yet.

When all Phase 0 PASS GATE items are true, unlock Phase 1.

