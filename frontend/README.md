# NILM Signal Lab (`nilm-site`)

Interactive technical explainer for **Non-Intrusive Load Monitoring (NILM)** — demonstrating single-point mains sensing, real FFT-based Variational Mode Decomposition (VMD) in a Web Worker, and a 12-stage signal-to-inference pipeline.

> **Status:** Project in active development. The hardware monitoring device and trained disaggregation model are not yet released; all demo metrics and waveforms are illustrative.

## Commands

```bash
# Install dependencies
npm install

# Start local dev server (http://localhost:3000)
npm run dev

# Build production bundle (dist/ with inlined critical CSS)
npm run build

# Preview production build
npm run preview

# Regenerate versioned hero poster (public/media/hero-poster.<hash>.webp) after replacing hero-bg.mp4
npm run poster

# Run runtime verification suite (dev + prod preview, 1440px & 390px, dark & light)
npm run test:runtime
```

## Editing Copy & Parameters

- **All page copy, section titles, badges, and limits:** `src/data/content.js`
- **Hero interactive panel demo loads & tariff:** `src/data/heroPanelConfig.js`
- **18-phase roadmap status:** `src/data/phases.js`
- **Real VMD solver & synthetic signal:** `src/lib/vmd.js` (unit test: `node scripts/test_vmd.mjs`)

## Routing & Future Pages

The app uses a lightweight client-side router in `src/lib/router.jsx`:
- `/` — Main NILM technical explainer
- `/estimator`, `/dashboard` — Reserved placeholder routes for future phases
- `*` — Custom 404 page

## Deployment

### Vercel
1. Connect the repository in Vercel and set **Root Directory** to `nilm-site`.
2. Build Command: `npm run build`, Output Directory: `dist`.
3. `vercel.json` is pre-configured with SPA rewrites, immutable caching for `/assets/*` and `/media/hero-poster.*.webp`, `no-cache` for `index.html`, and `Accept-Ranges: bytes` for `.mp4`.

### Netlify
1. Set **Base directory** to `nilm-site`, **Build command** to `npm run build`, **Publish directory** to `dist`.
2. `netlify.toml` and `public/_headers` handle SPA fallback and cache headers.

### GitHub Pages
1. If deploying to a project subpath (`https://<user>.github.io/<repo>/`), set `base: '/<repo>/'` in `vite.config.js`.
2. Run `npm run build` and publish `dist/` (e.g. via `peaceiris/actions-gh-pages`). Copy `dist/index.html` to `dist/404.html` if deep-link SPA fallback is needed.
