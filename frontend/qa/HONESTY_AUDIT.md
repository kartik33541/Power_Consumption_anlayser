# Honesty Audit (`qa/HONESTY_AUDIT.md`)

| Location | Claim / Content | Type | Fix / Verification |
|---|---|---|---|
| `index.html` `<title>` & `<meta description>` | "NILM Signal Lab — Non-Intrusive Load Monitoring Explainer" + active development note | Fact / Project Plan | Qualified as an interactive technical explainer and noted project is in active development. |
| `Navbar.jsx` / `content.js` `header.badge` | `"SIGNAL EXPLAINER"` | Fact | Verified present; accurately describes the site as an explainer. |
| `HeroPanel.jsx` & `heroPanelConfig.js` | Interactive mains load (`1,650 W`), PF (`0.84`), EST (`₹13.20/hr`), `example tariff ₹8/kWh · Illustrative` | Illustrative Demo | Explicitly tagged `"Demo data · Illustrative"` and `"example tariff ₹8/kWh · Illustrative"`; zero THD % or `"96% AI"` claims. |
| `WhyItMatters.jsx` & `content.js` | 3 problem cards ("Unitemized Utility Bills", "Appliances Left Running", "Hardware Instrumentation Burden") | Illustrative Demo | Each card carries `"Illustrative scenario"` / `"Illustrative comparison"` note; no invented rupee amounts or waste %. |
| `TheProblem.jsx` | Superposition interactive waveforms (`AC`, `Fridge`, `Fan`) | Illustrative Demo | Labelled illustrative synthesis of parallel mains superposition. |
| `Pipeline.jsx` Stage 12 (`content.js` L208) | Previously said "Delivers the 4 intelligence tiers: real-time breakdown..." | Project Plan | Updated to `"Target architecture: 4 intelligence tiers — live load breakdown, left-on alerts, bill forecast, and maintenance drift."` |
| `VmdSection.jsx` | Real FFT-based ADMM VMD on `N=1024, fs=1000 Hz` synthetic signal | Illustrative Demo | Added explicit caption under cards: `"If K is larger than the number of real components, VMD splits a component or captures noise. K=3 matches this synthetic signal."` Never calls a mode an appliance. |
| `FeaturesSection.jsx` | 40-descriptor example (`5 × 8 = 40 is an example, not a frozen constant`) | Project Plan | Explicitly states dimension is dynamic (`K × per-mode + electrical`). |
| `ModelSection.jsx` | Multi-label scenario probabilities (`Fridge Only`, `AC + Fridge`, etc.) | Illustrative Demo | Labelled `"Illustrative output shape"` — abstract representation, not measured model accuracy. |
| `LimitsSection.jsx` | Look-alike loads, simultaneous switching, V-I degradation, domain shift, wording table | Fact | Explicitly documents real-world NILM boundaries and avoids overclaiming. |
| `ProgressTracker.jsx` & `content.js` | 18-Phase State Machine (`PENDING until physical pass gates are achieved`) | Project Plan | Added explicit note: `"Project in active development — the monitoring hardware device and trained disaggregation model are not yet released. All future metrics are marked PENDING until physical pass gates are achieved."` |
| `Footer.jsx` & `content.js` | Footer disclaimer | Fact / Disclosure | Updated to `"Project in active development: the monitoring device and trained model are not yet released. Figures and waveforms on this page are illustrative examples."` |
| `docs/ASSETS.md` | Stock photos (`bill-inspection.webp`, `empty-room-ac.webp`, `mains-panel.webp`) | Fact | Unsplash License verified with author credits; no recognisable named people on site. |
