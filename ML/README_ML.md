# ML Pipeline — Non-Intrusive Load Monitoring (NILM)

Welcome to the **`ML/`** workspace. This directory contains the complete signal-processing and machine-learning pipeline for the **Power Consumption Analyzer ("Bijli ka X-Ray Machine")**.

---

## 1. What was done in Phase 0 & Why

### The Core Problem Phase 0 Solves
In this project, electrical measurements come from multiple distinct sources:
1. **PLAID**: High-frequency (~30 kHz) lab recordings of individual appliances.
2. **iAWE**: Indian household aggregate metrics ($P, Q, S, V, I$).
3. **HIFDA**: High-frequency appliance recordings for secondary validation.
4. **Our Own Sensor Hardware**: SCT-013 current clamp + ZMPT101B voltage sensor on an ESP32 / Raspberry Pi.

If we write code directly for the PLAID dataset first, all downstream functions (VMD, features, ML models) become permanently dependent on PLAID's file structures, column names, and sampling rates. When our own real-world sensor data arrives, the entire downstream codebase would break and have to be rewritten.

### The Solution: Universal Data Contract
In **Phase 0**, we built the **pipeline foundation and software architecture** before downloading any dataset:
* Created a universal data container: `SignalRecord`.
* Created an adapter base class: `BaseDatasetAdapter`.
* Configured all hyperparameters in an external file: `configs/pipeline.yaml`.
* Verified the contract using synthetic mathematical signals with automated cleanup in `tests/`.

**Golden Rule:** No downstream signal-processing or ML module ever touches raw dataset files directly. Everything consumes standard `SignalRecord` objects.

---

## 2. Folder Structure (11 Folders Explained)

The `ML/` directory contains **11 modular folders**, each with a dedicated role:

```text
ML/
├── configs/          # 1. Central configuration (no hardcoded parameters in code)
├── data/             # 2. Local dataset storage (raw, interim, processed)
├── datasets/         # 3. Canonical data contract & source adapters
├── preprocessing/    # 4. Signal calibration, DC removal & windowing
├── vmd/              # 5. Variational Mode Decomposition & mode ordering
├── features/         # 6. Time, frequency & electrical feature extractors
├── selection/        # 7. Feature selection & ablation analysis
├── models/           # 8. Classifiers (Random Forest, XGBoost, Neural)
├── evaluation/       # 9. Metrics, confusion matrix & unknown rejection
├── inference/        # 10. End-to-end prediction pipeline
└── tests/            # 11. Dedicated test suite with auto-cleanup
```

### Detailed Breakdown of Each Folder:

| # | Folder Name | Why it Exists & What it Contains |
|---|---|---|
| 1 | **`configs/`** | Contains `pipeline.yaml`. Eliminates magic numbers from code. Holds sampling rates, VMD parameters ($K=5, \alpha=2000$), window lengths, feature lists, and model thresholds. |
| 2 | **`data/`** | Standard 3-tier data directory: `raw/` (unmodified downloaded datasets), `interim/` (cleaned data), and `processed/` (final feature matrices). Tracked with `.gitkeep`. |
| 3 | **`datasets/`** | Contains the universal `SignalRecord` dataclass and `BaseDatasetAdapter`. Houses adapter stubs for `PLAID`, `HIFDA`, `iAWE`, and `OwnData`. |
| 4 | **`preprocessing/`** | Prepares raw electrical waves for analysis: linear calibration (`calibration.py`), DC offset removal (`cleaning.py`), $V$-$I$ synchronization (`synchronization.py`), and sliding/event windowing (`windowing.py`). |
| 5 | **`vmd/`** | Implements Variational Mode Decomposition (`decomposition.py`), mode sorting by center frequency or energy (`mode_ordering.py`), and reconstruction fidelity metrics (`reconstruction.py`). |
| 6 | **`features/`** | Extracts fingerprints from waves: statistical time-domain features (`time_domain.py`), spectral centroid/dominant frequency (`frequency_domain.py`), real/reactive power $P, Q$ and power factor (`electrical.py`), assembled via `FeaturePipeline`. |
| 7 | **`selection/`** | Stubs for optimizing the feature set: correlation filtering (`correlation.py`), mutual information (`mutual_information.py`), and ablation experiments (`ablation.py`). |
| 8 | **`models/`** | Houses machine learning models: the primary Random Forest classifier (`random_forest.py`), XGBoost stub (`xgboost.py`), and neural network architectures (`neural/`). |
| 9 | **`evaluation/`** | Performance assessment: classification metrics (`metrics.py`), confusion matrices (`confusion.py`), cross-dataset validation (`cross_dataset.py`), and unknown rejection thresholding (`unknown.py`). |
| 10 | **`inference/`** | Houses `InferencePipeline`, which takes any canonical `SignalRecord` in real time, runs preprocessing and feature extraction, and outputs the predicted appliance. |
| 11 | **`tests/`** | Dedicated test suite (`test_phase0_contract.py`). All tests operate in memory or self-cleaning temporary folders to guarantee no scratch files pollute the workspace. |

---

## 3. The Canonical Data Contract (`SignalRecord`)

Defined in `datasets/base.py`, every record contains:
* **Waveforms**: `current` ($I$) and `voltage` ($V$) as 1D NumPy float arrays.
* **Sampling Rate**: `sampling_rate_hz` explicitly specified (positive float).
* **Provenance**: `source_dataset` (`"PLAID"`, `"IAWE"`, `"HIFDA"`, `"OWN"`).
* **Ground Truth**: `appliance_label` ($Y$), strictly separated from feature arrays ($X$).
* **Metadata**: Optional timestamps, window start/end, and event types without fabricating missing values.

---

## 4. Phase 0 Verification & Pass Gate

Phase 0 was verified by running the unit test suite:
```bash
python -m unittest tests/test_phase0_contract.py
```

### Results:
* **Ran 6 tests in 0.022s — Status: OK**
* Invariant tests passed (negative sampling rates and invalid array dimensions are blocked).
* Preprocessing, feature extraction, and inference stubs successfully executed on synthetic waveforms.
* Teardown confirmed: zero persistent scratch files or temp folders were left behind.

---

## 5. Phase 1 — PLAID Dataset Ingestion & Adapter

### Implementation Details:
* **Adapter**: [`datasets/plaid_adapter.py`](file:///d:/Acedemic/Epics/ML/datasets/plaid_adapter.py) implements `PLAIDAdapter(BaseDatasetAdapter)`.
* **On-Demand Streaming**: Loads individual recordings by ID without duplicating 2.43 GB of data or holding the full dataset in RAM.
* **Verified Signal Mapping**:
  - Column 0 = Instantaneous Current $I(t)$ in Amperes.
  - Column 1 = Instantaneous Voltage $V(t)$ in Volts.
  - Sampling Rate = 30,000 Hz (parsed from metadata).
  - Mains frequency is NOT hardcoded (`mains_frequency_hz = None`).
* **Preservation & Extensible Quality Flags**: Missing optional metadata (brand, wattage) is preserved as `None` (zero fabrication). `quality_flags` records source notes (`calibration_warning`, `metadata_incomplete`) and signal length validation.

### Verification Results:
Ran the test suite [`tests/test_plaid_adapter.py`](file:///d:/Acedemic/Epics/ML/tests/test_plaid_adapter.py) following the single-record-first sequence:
1. `test_01_load_record_1_cfl`: Loaded Record `"1"` (CFL), validated 60,000 samples, ~120V RMS, quality flags.
2. `test_02_load_record_6_fridge`: Loaded Record `"6"` (Fridge), validated 300,000 samples (10.0s), current spike.
3. `test_03_load_multiple_appliance_types`: Verified Hairdryer, AC, Laptop, Microwave, Fan, Heater.
4. `test_04_filtering_and_iter_records`: Verified streaming iteration with ID and appliance filtering.
5. `test_05_error_handling_unknown_id`: Verified clean `KeyError` on invalid ID.
6. `test_06_get_dataset_info`: Verified summary statistics (1,876 records, 56 locations, 16 classes).

```bash
python -m unittest discover tests
```
### Waveform Inspection & Diagnostics (PASS GATE Verified):
Generated publication-grade 3-panel diagnostic plots for 7 representative electrical load categories in [`data/interim/phase1_inspection_plots/`](file:///d:/Acedemic/Epics/ML/data/interim/phase1_inspection_plots):
1. **CFL (`#1`)**: SMPS non-linear pulses ($V_{rms}=120V, I_{rms}=0.36A, P=24.3W, PF=0.57$).
2. **Fridge (`#6`)**: Compressor motor steady-state ($V_{rms}=120V, I_{rms}=0.96A, P=114.2W, PF=0.99$).
3. **Hairdryer (`#7`)**: Motor + heating element ($V_{rms}=120V, I_{rms}=1.55A, P=173.7W, PF=0.94$).
4. **Laptop (`#22`)**: SMPS electronic sharp spikes ($V_{rms}=120V, I_{rms}=0.30A, P=17.5W, PF=0.48$).
5. **Microwave (`#27`)**: Complex magnetron ($V_{rms}=120V, I_{rms}=6.60A, P=195.3W, PF=0.25$).
6. **Fan (`#56`)**: Inductive motor phase shift ($V_{rms}=120V, I_{rms}=0.26A, P=27.5W, PF=0.89$).
7. **Heater (`#123`)**: High-power resistive load ($V_{rms}=120V, I_{rms}=9.35A, P=848.0W, PF=0.76$).

### PASS GATE Status:
* [x] Dataset downloaded & extracted.
* [x] Directory structure documented.
* [x] Metadata mapping understood.
* [x] Raw V/I loaded successfully.
* [x] Sampling rate verified from source (30,000 Hz).
* [x] Appliance labels verified (16 classes).
* [x] 5–10 records plotted and visually inspected (7 appliances plotted across all 4 load types).
* [x] PLAID adapter outputs valid SignalRecords (12/12 unit tests passed).
* [x] No guessed column names/labels remain.

**PHASE 1 STATUS: 100% PASSED AND SIGNED OFF.**

---

## 6. Next Phase
With Phase 1 complete and signed off, **Phase 2: Raw Signal Validation & Preprocessing Policy** is UNLOCKED.


