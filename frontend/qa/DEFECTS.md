# Round 7C QA Report & Defects Log

## 1. Root Cause Found (Hero Video & LivingBackground Regression)
1. **`LivingBackground.jsx` Adaptive Governor Permanently Killed the Canvas:**
   - Previously, `LivingBackground.jsx` had `if (slowFrameStreak >= 4) { ctx.clearRect(0, 0, width, height); animId = null; return; }`. During initial load, `LazySection` mounts, or `model` mood's `O(n^2)` node lines, 4 slow frames (`> 32 ms`) permanently cleared the canvas and halted the draw loop, leaving only the static Layer 1 CSS `.living-blob` glows.
   - Additionally, `LivingBackground.jsx` delayed startup via `window.load` + `requestIdleCallback(..., { timeout: 2000 })` + `300 ms` and only ran `document.querySelectorAll('section[id], h2[id]')` once before lazy sections mounted, so section moods never attached to lazy-loaded sections.
2. **`Hero.jsx` Video Preload & Autoplay Guard:**
   - `Hero.jsx` previously used `preload="metadata"` and called `setVideoVisible(true)` on `onLoadedData` without explicitly ensuring `videoEl.muted = true; videoEl.defaultMuted = true; videoEl.play()` on ready/canPlay, which could leave the video paused at frame 0 when the poster faded out.
3. **`test_runtime.js` Static Server Lacked Range Support:**
   - `startStaticServer` in `test_runtime.js` did not serve `206 Partial Content` / `Accept-Ranges: bytes` for `.mp4` and launched Chrome with `--disable-gpu`, and had no motion assertions.

## 2. Fixes Applied
- **`src/components/LivingBackground.jsx`:**
  - Replaced the fatal canvas-kill governor with graceful degradation (drops to `15 fps` without `O(n^2)` node lines if frames exceed `32 ms`, and recovers to `30 fps` when fast, never blanking the canvas).
  - Started Layer 2 after first paint (`requestAnimationFrame` + `150 ms`) and added a `MutationObserver` so section mood `IntersectionObserver` attaches to all lazy-mounted sections.
  - Mounted at the top app layout level in `App.jsx` so it persists across `/`, `/estimator`, `/dashboard`, and `404`.
- **`src/components/Hero.jsx`:**
  - Switched desktop `<video>` (mounted after first paint + `400 ms`) to `preload="auto"`, explicitly enforced `muted = true` / `defaultMuted = true`, and invoked `play()` on mount, `IntersectionObserver` entry, `onCanPlay`, and `onPlaying` (while keeping `< 768px`, `Save-Data`, and `prefers-reduced-motion` poster-only).
- **`test_runtime.js`:**
  - Added HTTP `206` Range support for `.mp4`, removed `--disable-gpu`, and added permanent motion assertions on `PROD_BUILD` (`1440x800`, `dark` & `light`): checks `paused === false`, `readyState >= 3`, `dt >= 0.8 s` over `1.5 s`, outside-panel pixel diff `> 0.15`, and `LivingBackground` canvas pixel hash changing over `1.0 s` at Hero, Pipeline, VMD, and Phases.

## 3. Verification & Negative-Test Proof
- **Negative-Test Proof (`task-3697`):** Temporarily paused the hero video and blanked `LivingBackground` -> `npm run test:runtime` failed with exit code 1 and reported all 10 motion errors (`motion.hero_video_frozen` + `motion.living_bg_stopped` across Hero, Pipeline, VMD, and Phases in dark & light).
- **Post-Fix Motion Metrics (`test_runtime.js`):**
  - **Dark (`1440x800`):** Hero video `dt = 3.303s`, `readyState = 4`, `paused = false`, `outsidePixelDiff = 24.755`. `LivingBackground` `1440x800` `hashChanged = true` at Hero (`nonZero=1512`), Pipeline (`8975`), VMD (`8882`), and Phases (`2329`).
  - **Light (`1440x800`):** Hero video `dt = 3.043s`, `readyState = 4`, `paused = false`, `outsidePixelDiff = 25.371`. `LivingBackground` `1440x800` `hashChanged = true` at Hero (`nonZero=1495`), Pipeline (`8941`), VMD (`8941`), and Phases (`1905`).
- **Screenshots Inspected (`qa/screenshots-round7c/`):**
  - `hero-t0-1440.png` vs `hero-t15-1440.png` (1.5s apart): Background video visibly advances across scenes while `HeroPanel` waveforms scroll smoothly.
  - `mid-dark-1440.png` & `mid-light-1440.png`: `LivingBackground` ribbons, drifting particles, and connected node network are clearly visible behind the Features cards in both themes.

## 4. Final QA & Benchmarks (Post-Final-Edit)
- **`npm --prefix frontend run test:runtime`:** Passed (`0` console errors, `0` exceptions, `0` failed requests, `0` ErrorBoundary triggers, all permanent motion checks passing).
- **Lighthouse Mobile (Gzip, `run_lh.mjs`):** Performance **97**, Accessibility **100**, Best Practices **100**, SEO **100**, FCP **1.6 s**, LCP **2.4 s**, TBT **20 ms**, CLS **0**.
- **Headful Chrome Scroll (`measure_fps.mjs`):** `1541` frames, **125.4 fps** average, `8.0 ms` avg delta, **2.7%** frames `> 20 ms`.
