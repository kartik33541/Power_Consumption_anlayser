# Media Assets & Licensing Ledger

All media assets used in the **NILM Signal Lab** web application are locally hosted inside `public/media/` and tracked here. Zero external CDN hotlinking is used.

---

## 1. Active Asset Registry

| File Path | Description | Type / Format | Provenance & License | Notes / Label |
|---|---|---|---|---|
| `public/media/hero-bg.mp4` | Person at a microphone with cool blue background tones | Provided Video (MP4, 3.90 MB) | Provided by the project owner | Hero ambient background video; muted, desktop-only |
| `public/media/hero-poster.<hash>.webp` | Versioned keyframe extracted from `hero-bg.mp4` via `npm run poster` | Keyframe Video Extract (WebP, ~25 KB) | Generated from `hero-bg.mp4` | Immediate first-paint LCP poster and mobile hero image |
| `public/media/og-preview.jpg` | 1200x630 social preview card generated from `hero-poster` + project title | Open Graph Image (JPEG, 1200x630) | Generated from project assets | Used in `og:image` and `twitter:image` |
| `public/media/bill-inspection.webp` | Hands holding and reviewing a printed utility bill at a desk (no identifiable face/person) | Stock Photography (WebP, 50 KB) | Unsplash (Unsplash License); Author: Towfiqu barbhuiya | Why It Matters Card 1: "Illustrative scenario" |
| `public/media/empty-room-ac.webp` | Split air conditioner mounted in an unoccupied living room | Stock Photography (WebP, 75 KB) | Unsplash (Unsplash License); Author: Max Rahubovskiy | Why It Matters Card 2: "Illustrative scenario" |
| `public/media/mains-panel.webp` | Open residential electrical circuit breaker distribution board | Stock Photography (WebP, 62 KB) | Unsplash (Unsplash License); Author: Troy Bridges | Why It Matters Card 3: "Illustrative comparison" |
| `public/media/sct013-clamp.svg` | SCT-013-030 split-core CT clamp vector icon | Vector Graphic (SVG, 2.2 KB) | Custom-authored project SVG; MIT License | Site favicon & apple-touch-icon |
| `public/media/own/placeholder.svg` | Reserved slot for future physical hardware prototype photo | Placeholder Card (SVG) | Project placeholder; MIT License | Reserved for physical testbed photos |

---

## 2. Integrity & Honesty Rules
- **No Recognisable Named Persons:** Stock photos do not identify or quote any named individuals.
- **Zero Fabrication Rule:** No stock photo or synthetic waveform is claimed to be the team's physical prototype or measured hardware data.
