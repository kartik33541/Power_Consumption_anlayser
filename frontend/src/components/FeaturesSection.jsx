import { useState, lazy, Suspense } from 'react';
import { Database, Activity, Compass, Info, ChevronDown } from 'lucide-react';
import { CONTENT } from '../data/content';

const FeaturesRadar = lazy(() => import('./FeaturesRadar'));

export default function FeaturesSection() {
  const [activeLoadType, setActiveLoadType] = useState('mixed'); // 'resistive', 'inductive', 'mixed'
  const [prevLoadType, setPrevLoadType] = useState(null);
  const [techOpen, setTechOpen] = useState(false);

  const handleLoadChange = (type) => {
    if (type !== activeLoadType) {
      setPrevLoadType(activeLoadType);
      setActiveLoadType(type);
    }
  };

  // 6 Radar dimensions (0 to 1 scale):
  // 1. Size (RMS Magnitude)
  // 2. Peak (Crest Factor)
  // 3. Shape (Waveform Symmetry)
  // 4. Power Factor (cos φ)
  // 5. Harmonics (THD content)
  // 6. Spread (Bandwidth)
  const loadProfiles = {
    resistive: {
      title: "Pure Heater (PF ≈ 1.0)",
      phaseDeg: 0,
      phaseLabel: "In step (0° shift)",
      summary: "Current rises and falls in perfect lockstep with voltage. Harmonics are negligible and almost all power turns directly into heat.",
      radar: [0.85, 0.40, 0.85, 0.98, 0.12, 0.20],
      techItems: [
        { label: "RMS Current (I_rms)", val: "5.8 A (illustrative)" },
        { label: "Phase Shift (φ)", val: "0.0° (cos φ ≈ 1.00)" },
        { label: "Crest Factor", val: "1.41 (pure sinusoid)" },
        { label: "Harmonic THD", val: "< 1.5% (negligible higher modes)" },
        { label: "Spectral Modes", val: "ω₁ = 50 Hz fundamental only" }
      ]
    },
    inductive: {
      title: "Inductive Motor (PF ≈ 0.86)",
      phaseDeg: 32,
      phaseLabel: "Current lags voltage by ~32°",
      summary: "Magnetic motor coils delay the current waveform behind voltage. Switching harmonics and magnetic slip create distinct frequency sidebands.",
      radar: [0.72, 0.55, 0.60, 0.82, 0.48, 0.65],
      techItems: [
        { label: "RMS Current (I_rms)", val: "6.2 A (illustrative)" },
        { label: "Phase Shift (φ)", val: "32.0° lag (cos φ ≈ 0.86)" },
        { label: "Crest Factor", val: "1.52 (asymmetric inductive peak)" },
        { label: "Harmonic THD", val: "8.4% (3rd & 5th rotor harmonics)" },
        { label: "Spectral Modes", val: "ω₁ = 50 Hz, ω₂ = 150 Hz, ω₃ = 250 Hz" }
      ]
    },
    mixed: {
      title: "Mixed Superposition (AC + Fridge)",
      phaseDeg: 20,
      phaseLabel: "Composite lag (~20° phase spread)",
      summary: "Superimposed compressors and auxiliary blowers distort both phase and harmonic distribution into an aggregate signature.",
      radar: [0.92, 0.75, 0.45, 0.91, 0.70, 0.85],
      techItems: [
        { label: "RMS Current (I_rms)", val: "8.4 A (illustrative)" },
        { label: "Phase Shift (φ)", val: "19.5° composite (cos φ ≈ 0.94)" },
        { label: "Crest Factor", val: "1.74 (multi-peak crests)" },
        { label: "Harmonic THD", val: "14.2% (composite non-linear modes)" },
        { label: "Spectral Modes", val: "ω₁ = 50 Hz through ω_K mode decomposition" }
      ]
    }
  };

  const curr = loadProfiles[activeLoadType];
  const prev = prevLoadType ? loadProfiles[prevLoadType] : null;

  return (
    <section className="section-wrapper" aria-labelledby="features-heading">
      <div className="section-header">
        <span className="tag-badge illustrative">
          <Database size={13} />
          {CONTENT.features.badge}
        </span>
        <h2 id="features-heading" className="section-title">
          {CONTENT.features.title}
        </h2>
        <p className="section-subtitle">
          {CONTENT.features.subtitle}
        </p>
      </div>

      {/* Interactive Load State Switcher */}
      <div className="features-load-switch-row full-width">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          SIMULATE LOAD VECTOR:
        </span>
        <button
          type="button"
          onClick={() => handleLoadChange('resistive')}
          className={`load-pill-btn ${activeLoadType === 'resistive' ? 'active' : ''}`}
        >
          Pure Heater (PF ≈ 1.0)
        </button>
        <button
          type="button"
          onClick={() => handleLoadChange('inductive')}
          className={`load-pill-btn ${activeLoadType === 'inductive' ? 'active' : ''}`}
        >
          Inductive Motor (PF ≈ 0.86)
        </button>
        <button
          type="button"
          onClick={() => handleLoadChange('mixed')}
          className={`load-pill-btn ${activeLoadType === 'mixed' ? 'active' : ''}`}
        >
          Mixed Superposition (AC + Fridge)
        </button>
      </div>

      {/* 3 Redesigned Clear Feature Consoles */}
      <div className="features-visual-grid full-width">
        {/* Panel A: Voltage vs Current Phase Shift */}
        <div className="domain-visual-console">
          <div className="domain-console-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--accent-cyan)" />
              <h3 className="domain-console-title">Voltage vs Current Phase</h3>
            </div>
            <span className="tag-badge illustrative">{curr.phaseLabel}</span>
          </div>

          <div className="vi-phase-svg-wrap">
            <svg viewBox="0 0 320 180" className="vi-phase-svg" aria-label="Voltage and Current sine waveforms showing physical phase relationship">
              {/* Center 0-line and grid */}
              <line x1="20" y1="90" x2="300" y2="90" stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="20" y1="20" x2="20" y2="160" stroke="var(--border-subtle)" strokeWidth="1" />

              {/* Shaded Phase Gap Area */}
              {curr.phaseDeg > 0 && (
                <path
                  d={`M ${90} 90 Q ${90 + curr.phaseDeg * 0.4} 60, ${90 + curr.phaseDeg * 0.8} 90 Z`}
                  fill="var(--accent-cyan)"
                  fillOpacity="0.2"
                />
              )}

              {/* Voltage Reference Wave (Gold/Amber) */}
              <path
                d="M 20 90 Q 55 25, 90 90 T 160 90 T 230 90 T 300 90"
                fill="none"
                stroke="var(--color-fridge)"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              {/* Current Wave (Cyan) - Phase Shifted */}
              <path
                d={
                  activeLoadType === 'resistive'
                    ? "M 20 90 Q 55 35, 90 90 T 160 90 T 230 90 T 300 90"
                    : activeLoadType === 'inductive'
                    ? "M 20 90 Q 65 32, 105 90 T 175 90 T 245 90 T 300 90"
                    : "M 20 90 Q 62 30, 98 90 T 168 90 T 238 90 T 300 90"
                }
                fill="none"
                stroke="var(--accent-cyan)"
                strokeWidth="2.5"
                style={{ transition: 'd 0.5s ease' }}
              />

              {/* Wave Legend Callouts */}
              <text x="35" y="32" fill="var(--color-fridge)" fontSize="10" fontFamily="var(--font-mono)">
                V(t) Mains Voltage
              </text>
              <text x="35" y="48" fill="var(--accent-cyan)" fontSize="10" fontFamily="var(--font-mono)">
                I(t) Load Current
              </text>
              <text x="210" y="160" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
                φ = {curr.phaseDeg}° (Illustrative)
              </text>
            </svg>
          </div>

          <p className="domain-caption">
            {activeLoadType === 'resistive'
              ? "Voltage and current cross zero at the same instant (zero reactive power, PF ≈ 1.0)."
              : activeLoadType === 'inductive'
              ? "Motor inductance pushes current peak behind voltage peak by 32°, causing reactive power flow."
              : "Composite signatures introduce non-linear harmonics and compound phase lags across cycles."}
          </p>
        </div>

        {/* Panel B: Fingerprint Radar Chart */}
        <div className="domain-visual-console">
          <div className="domain-console-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={18} color="var(--accent-cyan)" />
              <h3 className="domain-console-title">Feature Fingerprint Radar</h3>
            </div>
            <span className="tag-badge illustrative">6 Normalized Axes</span>
          </div>

          <div className="radar-svg-wrap">
            <Suspense fallback={<div style={{ width: 240, height: 240 }} />}>
              <FeaturesRadar radarValues={curr.radar} prevRadarValues={prev ? prev.radar : null} />
            </Suspense>
          </div>

          <p className="domain-caption">
            {prev ? "Faint dashed outline shows prior load state for visual comparison." : "Smoothly morphs between load types across 6 orthogonal dimensions."}
          </p>
        </div>

        {/* Panel C: Plain Language & Expandable Technical Jargon */}
        <div className="domain-visual-console">
          <div className="domain-console-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} color="var(--accent-cyan)" />
              <h3 className="domain-console-title">What This Means</h3>
            </div>
            <span className="tag-badge illustrative">Plain English</span>
          </div>

          <div className="plain-terms-content">
            <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
              {curr.title}
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
              {curr.summary}
            </p>

            {/* Expandable Technical Names Accordion */}
            <div className="tech-disclosure-card">
              <button
                type="button"
                onClick={() => setTechOpen(!techOpen)}
                className="tech-disclosure-btn"
                aria-expanded={techOpen}
              >
                <span>Technical descriptors ({curr.techItems.length} metrics)</span>
                <ChevronDown size={14} style={{ transform: techOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
              </button>

              {techOpen && (
                <div className="tech-disclosure-body">
                  {curr.techItems.map((item) => (
                    <div key={item.label} className="tech-item-row">
                      <span className="tech-item-label">{item.label}</span>
                      <span className="tech-item-val">{item.val}</span>
                    </div>
                  ))}
                  <div className="tech-disclaimer">
                    All numbers are illustrative pedagogical samples, not live telemetry.
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="domain-caption">
            Extracting multiple complementary domains is intended to help the classifier separate similar loads; this hypothesis is evaluated in Phase 9 with benchmark testing.
          </p>
        </div>
      </div>
    </section>
  );
}
