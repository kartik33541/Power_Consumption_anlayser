/**
 * NILM Signal Lab — Pipeline Stage Diagrams
 * Renders 12 dedicated, interactive animated SVG visual diagrams
 * illustrating the physical and mathematical signal transformations.
 */

import { useRef, useState, useEffect } from 'react';

export default function PipelineDiagram({ stageIndex }) {
  const wrapperRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => setIsVisible(entries[0].isIntersecting),
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Common theme-reactive colors
  const cyan = "var(--color-ac)";
  const amber = "var(--color-fridge)";
  const pink = "var(--color-fan)";
  const green = "#10b981";
  const red = "#ef4444";
  const textPrimary = "var(--text-primary)";
  const textSecondary = "var(--text-secondary)";
  const textMuted = "var(--text-muted)";
  const borderSubtle = "var(--border-subtle)";
  const gridLine = "var(--oscilloscope-grid)";

  return (
    <div ref={wrapperRef} className={`pipeline-svg-wrapper ${isVisible ? '' : 'pipeline-paused'}`} aria-hidden="true">
      {/* 01. MAINS FEED: Continuous 50Hz AC Mains Wave */}
      {stageIndex === 0 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Background Grid */}
          <line x1="50" y1="180" x2="550" y2="180" stroke={gridLine} strokeWidth="1.5" />
          <line x1="50" y1="60" x2="550" y2="60" stroke={gridLine} strokeDasharray="4 4" />
          <line x1="50" y1="300" x2="550" y2="300" stroke={gridLine} strokeDasharray="4 4" />
          <text x="50" y="45" fill={textPrimary} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">+325V Peak (+230V RMS)</text>
          <text x="50" y="205" fill={textPrimary} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">0V Ground Baseline</text>
          <text x="50" y="335" fill={textPrimary} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">-325V Peak</text>

          {/* 50 Hz Sinusoidal Wave with Wave Draw Animation */}
          <path
            d="M 50 180 Q 112.5 30, 175 180 T 300 180 T 425 180 T 550 180"
            fill="none"
            stroke={cyan}
            strokeWidth="3.5"
            strokeLinecap="round"
            className="stage-wave-flow"
          />

          {/* Live Annotation Chips */}
          <g transform="translate(300, 240)">
            <rect x="-140" y="-18" width="280" height="36" rx="18" fill="var(--bg-tertiary)" stroke={borderSubtle} />
            <circle cx="-115" cy="0" r="5" fill={green} />
            <text x="-95" y="5" fill="var(--text-primary)" fontSize="12" fontFamily="var(--font-mono)" fontWeight="600">
              SINGLE-PHASE MAINS: 230V @ 50 Hz
            </text>
          </g>
        </svg>
      )}

      {/* 02. SENSORS (CT + ZMPT): Non-invasive clamp + isolation */}
      {stageIndex === 1 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Animated Current Particles Flowing in Live Conductor */}
          <defs>
            <linearGradient id="liveWireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <pattern id="flowPattern" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 0 10 L 20 10 M 15 5 L 20 10 L 15 15" stroke="var(--color-ac)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
            </pattern>
          </defs>

          {/* Live Mains Copper Conductor Wire (Passes Through CT Clamp) */}
          <rect x="30" y="120" width="540" height="36" rx="6" fill="url(#liveWireGrad)" stroke="#334155" strokeWidth="2" />
          <g className="stage-wire-flow">
            <rect x="30" y="120" width="540" height="36" rx="6" fill="url(#flowPattern)" />
          </g>
          
          {/* Current Flow Direction Arrow & Label */}
          <text x="45" y="105" fill={textPrimary} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
            LIVE 230V MAINS CONDUCTOR
          </text>
          <text x="45" y="143" fill="#ffffff" fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
            HIGH CURRENT I(t) ➔ ➔ ➔
          </text>

          {/* SCT-013-030 Split-Core CT Clamp Enclosing the Wire */}
          <g transform="translate(200, 138)">
            {/* Magnetic Field Concentric Rings with Pulsing Scale */}
            <ellipse cx="0" cy="0" rx="46" ry="68" fill="none" stroke={amber} strokeWidth="2" strokeDasharray="5 4" className="stage-pulse-ring" />
            <ellipse cx="0" cy="0" rx="36" ry="54" fill="none" stroke={amber} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />

            {/* Split-Core Ferromagnetic Toroidal Halves */}
            <path d="M -24 -60 C -60 -60, -60 60, -24 60 L 24 60 C 60 60, 60 -60, 24 -60 Z" fill="none" stroke={amber} strokeWidth="14" strokeLinecap="round" />
            
            {/* Clamp Label Badge */}
            <rect x="-105" y="-95" width="210" height="24" rx="4" fill="var(--bg-card)" stroke={amber} strokeWidth="1.5" />
            <text x="0" y="-79" textAnchor="middle" fill={textPrimary} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
              SCT-013-030 SPLIT-CORE CT
            </text>

            {/* CT Secondary Output Lead (0-1V AC) */}
            <path d="M 0 68 L 0 115 Q 0 130, 20 130 L 70 130" fill="none" stroke={amber} strokeWidth="2.5" />
            <circle cx="70" cy="130" r="3.5" fill={amber} />
            <text x="80" y="134" fill={textPrimary} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">
              Isolated I(t) Output: 0–1V AC
            </text>
          </g>

          {/* ZMPT101B Voltage Transformer Module */}
          <g transform="translate(420, 220)">
            <rect x="-65" y="-35" width="130" height="70" rx="8" fill="var(--bg-card)" stroke="var(--color-ac)" strokeWidth="2" />
            
            {/* Isolation Barrier Line */}
            <line x1="0" y1="-30" x2="0" y2="30" stroke="var(--color-ac)" strokeWidth="1.5" strokeDasharray="4 3" />
            
            <text x="0" y="-18" textAnchor="middle" fill={textPrimary} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
              ZMPT101B
            </text>
            <text x="-32" y="15" textAnchor="middle" fill={textSecondary} fontSize="9" fontFamily="var(--font-mono)">
              230V In
            </text>
            <text x="32" y="15" textAnchor="middle" fill={textSecondary} fontSize="9" fontFamily="var(--font-mono)">
              Isolated
            </text>

            {/* Voltage Output Wire to ADC */}
            <path d="M 65 0 L 110 0" fill="none" stroke="var(--color-ac)" strokeWidth="2.5" />
            <circle cx="110" cy="0" r="3.5" fill="var(--color-ac)" />
            <text x="118" y="4" fill={textPrimary} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">
              V(t) 0–1V
            </text>
          </g>

          {/* Galvanic Safety Certification Callout */}
          <g transform="translate(300, 320)">
            <rect x="-140" y="-14" width="280" height="28" rx="14" fill="rgba(16, 185, 129, 0.15)" stroke={green} strokeWidth="1.5" />
            <text x="0" y="4" textAnchor="middle" fill={green} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
              ✓ NON-INVASIVE GALVANIC ISOLATION SAFE
            </text>
          </g>
        </svg>
      )}

      {/* 03. ADC SAMPLING: Continuous wave to discrete impulse points */}
      {stageIndex === 2 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Baseline */}
          <line x1="50" y1="180" x2="550" y2="180" stroke={gridLine} strokeWidth="1.5" />

          {/* Ghost Analog Wave */}
          <path
            d="M 50 180 Q 112.5 40, 175 180 T 300 180 T 425 180 T 550 180"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.4"
          />

          {/* Discrete Stems & Sampling Points with Subtle Elevation Animation */}
          {[
            { x: 70, y: 135 }, { x: 90, y: 95 }, { x: 112, y: 60 }, { x: 135, y: 95 }, { x: 155, y: 145 },
            { x: 175, y: 180 }, { x: 195, y: 220 }, { x: 218, y: 270 }, { x: 238, y: 300 }, { x: 260, y: 265 },
            { x: 280, y: 215 }, { x: 300, y: 180 }, { x: 322, y: 135 }, { x: 345, y: 70 }, { x: 368, y: 55 },
            { x: 390, y: 85 }, { x: 410, y: 140 }, { x: 425, y: 180 }, { x: 448, y: 230 }, { x: 470, y: 285 },
            { x: 495, y: 305 }, { x: 518, y: 255 }, { x: 540, y: 195 }
          ].map((pt, i) => (
            <g key={i} className="stage-sample-point" style={{ animationDelay: `${(i % 5) * 0.2}s` }}>
              <line x1={pt.x} y1="180" x2={pt.x} y2={pt.y} stroke={cyan} strokeWidth="1.5" opacity="0.6" />
              <circle cx={pt.x} cy={pt.y} r="4" fill={cyan} />
            </g>
          ))}

          {/* Sampling Rate Callout */}
          <g transform="translate(300, 320)">
            <rect x="-130" y="-16" width="260" height="32" rx="16" fill="var(--bg-tertiary)" stroke={borderSubtle} />
            <text x="0" y="5" textAnchor="middle" fill={textPrimary} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
              Fs = 8–10 kHz (30 kHz PLAID Standard)
            </text>
          </g>
        </svg>
      )}

      {/* 04. WINDOWING: Cycle-Aligned Partitioning (N = Fs * T) */}
      {stageIndex === 3 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Signal Stream */}
          <path
            d="M 50 180 Q 90 80, 130 180 T 210 180 T 290 180 T 370 180 T 450 180 T 530 180"
            fill="none"
            stroke={cyan}
            strokeWidth="2"
          />

          {/* Window 1 Bracket with Glowing Window Animation */}
          <g transform="translate(60, 40)">
            <rect x="0" y="0" width="200" height="260" rx="8" fill="rgba(0, 229, 255, 0.08)" stroke={cyan} strokeWidth="2" strokeDasharray="6 4" className="stage-window-bracket" />
            <text x="100" y="25" textAnchor="middle" fill={textPrimary} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
              WINDOW k (50 ms)
            </text>
            <text x="100" y="245" textAnchor="middle" fill={textSecondary} fontSize="11" fontFamily="var(--font-mono)">
              N = Fs × 0.05s
            </text>
          </g>

          {/* Window 2 (Overlapping, gently sliding) */}
          <g transform="translate(160, 60)">
            <g className="stage-window-slide">
              <rect x="0" y="0" width="200" height="240" rx="8" fill="rgba(255, 183, 3, 0.06)" stroke={amber} strokeWidth="2" strokeDasharray="4 4" />
              <text x="100" y="25" textAnchor="middle" fill={textPrimary} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
                WINDOW k+1 (50% Overlap)
              </text>
            </g>
          </g>

          {/* Verification Badge */}
          <g transform="translate(460, 100)">
            <rect x="-70" y="-14" width="140" height="28" rx="14" fill="rgba(16, 185, 129, 0.15)" stroke={green} />
            <text x="0" y="5" textAnchor="middle" fill={green} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">
              DC BIAS AUDITED
            </text>
          </g>
        </svg>
      )}

      {/* 05. EVENT DETECTION: Transient Step Change (ΔP > 30W) */}
      {stageIndex === 4 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Power Axis */}
          <line x1="50" y1="310" x2="560" y2="310" stroke={gridLine} strokeWidth="2" />
          <line x1="50" y1="310" x2="50" y2="40" stroke={gridLine} strokeWidth="2" />
          <text x="50" y="32" fill={textPrimary} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">Power P(t) [Watts]</text>
          <text x="510" y="330" fill={textMuted} fontSize="11" fontFamily="var(--font-mono)">Time [s]</text>

          {/* Baseline Step Change Power Curve with Inrush Rise Animation */}
          <path
            d="M 50 280 L 190 280 L 210 100 L 560 100"
            fill="none"
            stroke={amber}
            strokeWidth="4"
            strokeLinecap="round"
            className="stage-step-rise"
          />

          {/* Threshold Line & Label */}
          <line x1="160" y1="230" x2="350" y2="230" stroke={red} strokeWidth="2" strokeDasharray="5 4" />
          <text x="360" y="234" fill={red} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
            Threshold ΔP &gt; 30 W
          </text>

          {/* Delta Marker */}
          <line x1="200" y1="280" x2="200" y2="100" stroke={cyan} strokeWidth="2" strokeDasharray="3 3" />
          <text x="215" y="170" fill={textPrimary} fontSize="13" fontFamily="var(--font-mono)" fontWeight="700">
            ΔP = +1,240 W (Inrush Step)
          </text>

          {/* Event Trigger Flag */}
          <g transform="translate(420, 70)">
            <rect x="-90" y="-18" width="180" height="36" rx="8" fill="rgba(239, 68, 68, 0.2)" stroke={red} strokeWidth="2" />
            <text x="0" y="6" textAnchor="middle" fill={red} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
              ⚡ EVENT TRIGGERED
            </text>
          </g>
        </svg>
      )}

      {/* 06. VMD ON CURRENT: Wave decomposing into K band-limited modes */}
      {stageIndex === 5 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Composite Top Wave */}
          <path d="M 50 60 Q 85 20, 120 60 T 190 60 T 260 60 T 330 60 T 400 60 T 470 60 T 540 60" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" />
          <text x="55" y="45" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)">Raw Window I(t)</text>

          {/* Mode 1: 50Hz Fundamental with Mode Vibration Animation */}
          <g transform="translate(0, 70)">
            <g className="stage-mode-vibrate">
              <path d="M 50 70 Q 172.5 10, 295 70 T 540 70" fill="none" stroke={cyan} strokeWidth="2.5" />
              <text x="550" y="74" fill={cyan} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">u₁(t): 50 Hz</text>
            </g>
          </g>

          {/* Mode 2: 150Hz 3rd Harmonic */}
          <g transform="translate(0, 140)">
            <g className="stage-mode-vibrate" style={{ animationDelay: '0.4s' }}>
              <path d="M 50 70 Q 90 35, 130 70 T 210 70 T 290 70 T 370 70 T 450 70 T 530 70" fill="none" stroke={amber} strokeWidth="2.5" />
              <text x="550" y="74" fill={amber} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">u₂(t): 150 Hz</text>
            </g>
          </g>

          {/* Mode 3: 250Hz 5th Harmonic */}
          <g transform="translate(0, 210)">
            <g className="stage-mode-vibrate" style={{ animationDelay: '0.8s' }}>
              <path d="M 50 70 Q 75 45, 100 70 T 150 70 T 200 70 T 250 70 T 300 70 T 350 70 T 400 70 T 450 70 T 500 70 T 540 70" fill="none" stroke={pink} strokeWidth="2.5" />
              <text x="550" y="74" fill={pink} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">u₃(t): 250 Hz</text>
            </g>
          </g>

          <text x="300" y="340" textAnchor="middle" fill={textMuted} fontSize="11" fontFamily="var(--font-mono)">
            Penalty α = 2000 • K = 3–7 Intrinsic Modes
          </text>
        </svg>
      )}

      {/* 07. SEMANTIC MODE ORDERING: Unordered modes slide into sorted column order */}
      {stageIndex === 6 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Input Unordered Modes (visible swap into sorted positions) */}
          <g transform="translate(40, 75)">
            <text x="0" y="-12" fill={textMuted} fontSize="11" fontFamily="var(--font-mono)">Raw Modes (Unordered):</text>
            <g className="stage-sort-card stage-sort-250">
              <rect x="0" y="0" width="140" height="36" rx="6" fill="var(--bg-tertiary)" stroke={pink} strokeWidth="1.5" />
              <text x="70" y="22" textAnchor="middle" fill={pink} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">Mode B: 250 Hz</text>
            </g>

            <g className="stage-sort-card stage-sort-50">
              <rect x="0" y="55" width="140" height="36" rx="6" fill="var(--bg-tertiary)" stroke={cyan} strokeWidth="1.5" />
              <text x="70" y="77" textAnchor="middle" fill={cyan} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">Mode A: 50 Hz</text>
            </g>

            <g className="stage-sort-card stage-sort-150">
              <rect x="0" y="110" width="140" height="36" rx="6" fill="var(--bg-tertiary)" stroke={amber} strokeWidth="1.5" />
              <text x="70" y="132" textAnchor="middle" fill={amber} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">Mode C: 150 Hz</text>
            </g>
          </g>

          {/* Sorter Funnel */}
          <g transform="translate(230, 125)">
            <polygon points="0,0 85,35 85,75 0,110" fill="rgba(0, 229, 255, 0.12)" stroke={cyan} strokeWidth="2" className="stage-pulse-ring" />
            <text x="42" y="60" textAnchor="middle" fill={cyan} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
              SORT (ω)
            </text>
          </g>

          {/* Output Canonical Vector */}
          <g transform="translate(365, 75)">
            <text x="0" y="-12" fill={cyan} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">Sorted Vector Columns:</text>
            <g className="stage-sort-out" style={{ animationDelay: '0s' }}>
              <rect x="0" y="0" width="190" height="36" rx="6" fill="rgba(0, 229, 255, 0.15)" stroke={cyan} strokeWidth="2" />
              <text x="95" y="22" textAnchor="middle" fill={cyan} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
                Col 0: Mode A (ω₁ = 50 Hz)
              </text>
            </g>

            <g className="stage-sort-out" style={{ animationDelay: '0.25s' }}>
              <rect x="0" y="55" width="190" height="36" rx="6" fill="rgba(255, 183, 3, 0.15)" stroke={amber} strokeWidth="2" />
              <text x="95" y="77" textAnchor="middle" fill={amber} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
                Col 1: Mode C (ω₂ = 150 Hz)
              </text>
            </g>

            <g className="stage-sort-out" style={{ animationDelay: '0.5s' }}>
              <rect x="0" y="110" width="190" height="36" rx="6" fill="rgba(255, 77, 141, 0.15)" stroke={pink} strokeWidth="2" />
              <text x="95" y="132" textAnchor="middle" fill={pink} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
                Col 2: Mode B (ω₃ = 250 Hz)
              </text>
            </g>
          </g>

          <text x="300" y="305" textAnchor="middle" fill={green} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
            ✓ DETERMINISTIC CANONICAL COLUMN ORDERING (ω₁ &lt; ω₂ &lt; ... &lt; ω_K)
          </text>
        </svg>
      )}

      {/* 08. MULTI-DOMAIN FEATURES: Time + Spectral + Electrical bars */}
      {stageIndex === 7 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* 3 Domain Groups */}
          <g transform="translate(60, 60)">
            <rect x="0" y="0" width="140" height="220" rx="8" fill="var(--bg-tertiary)" stroke={borderSubtle} />
            <text x="70" y="25" textAnchor="middle" fill={cyan} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">TIME DOMAIN</text>
            <rect x="20" y="50" width="80" height="12" rx="3" fill={cyan} className="stage-bar-grow" />
            <text x="20" y="78" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">RMS / Var</text>
            <rect x="20" y="95" width="95" height="12" rx="3" fill={cyan} className="stage-bar-grow" />
            <text x="20" y="123" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">Peak-to-Peak</text>
            <rect x="20" y="140" width="60" height="12" rx="3" fill={cyan} className="stage-bar-grow" />
            <text x="20" y="168" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">Crest / Skew</text>
          </g>

          <g transform="translate(230, 60)">
            <rect x="0" y="0" width="140" height="220" rx="8" fill="var(--bg-tertiary)" stroke={borderSubtle} />
            <text x="70" y="25" textAnchor="middle" fill={amber} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">SPECTRAL (VMD)</text>
            <rect x="20" y="50" width="90" height="12" rx="3" fill={amber} className="stage-bar-grow" style={{ animationDelay: '0.2s' }} />
            <text x="20" y="78" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">Mode Freq ω_k</text>
            <rect x="20" y="95" width="70" height="12" rx="3" fill={amber} className="stage-bar-grow" style={{ animationDelay: '0.4s' }} />
            <text x="20" y="123" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">Spectral Spread</text>
            <rect x="20" y="140" width="85" height="12" rx="3" fill={amber} className="stage-bar-grow" style={{ animationDelay: '0.6s' }} />
            <text x="20" y="168" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">Harmonic THD</text>
          </g>

          <g transform="translate(400, 60)">
            <rect x="0" y="0" width="140" height="220" rx="8" fill="var(--bg-tertiary)" stroke={borderSubtle} />
            <text x="70" y="25" textAnchor="middle" fill={pink} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">ELECTRICAL (V-I)</text>
            <rect x="20" y="50" width="100" height="12" rx="3" fill={pink} className="stage-bar-grow" style={{ animationDelay: '0.3s' }} />
            <text x="20" y="78" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">Active P (W)</text>
            <rect x="20" y="95" width="65" height="12" rx="3" fill={pink} className="stage-bar-grow" style={{ animationDelay: '0.5s' }} />
            <text x="20" y="123" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">Reactive Q (var)</text>
            <rect x="20" y="140" width="80" height="12" rx="3" fill={pink} className="stage-bar-grow" style={{ animationDelay: '0.7s' }} />
            <text x="20" y="168" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">Power Factor (PF)</text>
          </g>

          <text x="300" y="320" textAnchor="middle" fill={cyan} fontSize="12" fontFamily="var(--font-mono)" fontWeight="600">
            TOTAL: 40 DISCRIMINATIVE PHYSICAL DESCRIPTORS
          </text>
        </svg>
      )}

      {/* 09. FEATURE SELECTION: Pearson filter r > 0.95 pruning */}
      {stageIndex === 8 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Candidate feature flow */}
          <g transform="translate(60, 60)">
            <text x="0" y="20" fill="var(--text-muted)" fontSize="12" fontFamily="var(--font-mono)">Candidate Features (50+)</text>
            {[
              { name: "P_active", col: green, pass: true },
              { name: "S_apparent", col: red, pass: false, reason: "r=0.98 with P" },
              { name: "u1_RMS", col: green, pass: true },
              { name: "u1_Var", col: red, pass: false, reason: "collinear r=0.99" },
              { name: "u2_THD", col: green, pass: true },
              { name: "PowerFactor", col: green, pass: true }
            ].map((f, idx) => (
              <g key={idx} transform={`translate(0, ${40 + idx * 36})`}>
                <g className={f.pass ? '' : 'stage-prune-fade'}>
                  <rect x="0" y="0" width="220" height="28" rx="5" fill={f.pass ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.1)"} stroke={f.col} strokeWidth="1.2" />
                  <text x="12" y="18" fill="var(--text-primary)" fontSize="11" fontFamily="var(--font-mono)">{f.name}</text>
                  <text x="210" y="18" textAnchor="end" fill={f.col} fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">
                    {f.pass ? "KEEP" : "PRUNE (r>0.95)"}
                  </text>
                </g>
              </g>
            ))}
          </g>

          {/* Fusion Arrow */}
          <g transform="translate(320, 160)">
            <path d="M 0 0 L 50 0 M 40 -10 L 50 0 L 40 10" fill="none" stroke={cyan} strokeWidth="2.5" strokeLinecap="round" />
          </g>

          {/* Output Clean Vector with Evaluated Badge */}
          <g transform="translate(390, 100)">
            <g className="stage-pulse-ring">
              <rect x="0" y="0" width="160" height="140" rx="8" fill="var(--bg-tertiary)" stroke={cyan} strokeWidth="2" />
              <text x="80" y="28" textAnchor="middle" fill={cyan} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">features_v1.json</text>
              <text x="20" y="60" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">• 40 Features</text>
              <text x="20" y="85" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">• Zero Collinearity</text>
              <text x="20" y="110" fill={amber} fontSize="11" fontFamily="var(--font-mono)" fontWeight="600">Phase gate: pending</text>
            </g>
          </g>
        </svg>
      )}

      {/* 10. MULTI-LABEL MODEL: Random Forest Tree Ensemble */}
      {stageIndex === 9 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Input Vector */}
          <g transform="translate(60, 140)">
            <rect x="0" y="0" width="80" height="60" rx="6" fill="var(--bg-tertiary)" stroke={cyan} />
            <text x="40" y="35" textAnchor="middle" fill={cyan} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">VECTOR X</text>
          </g>

          {/* Decision Tree Diagram */}
          <g transform="translate(190, 70)">
            {/* Root */}
            <circle cx="110" cy="30" r="14" fill="var(--bg-tertiary)" stroke={cyan} strokeWidth="2" />
            <text x="110" y="34" textAnchor="middle" fill={cyan} fontSize="10" fontFamily="var(--font-mono)">P &gt; 40W</text>

            <line x1="100" y1="42" x2="60" y2="90" stroke={borderSubtle} strokeWidth="1.5" />
            <line x1="120" y1="42" x2="160" y2="90" stroke={borderSubtle} strokeWidth="1.5" />

            {/* Level 2 */}
            <circle cx="60" cy="100" r="12" fill="var(--bg-tertiary)" stroke={amber} strokeWidth="2" />
            <text x="60" y="104" textAnchor="middle" fill={amber} fontSize="9" fontFamily="var(--font-mono)">PF &lt; 0.7</text>

            <circle cx="160" cy="100" r="12" fill="var(--bg-tertiary)" stroke={amber} strokeWidth="2" />
            <text x="160" y="104" textAnchor="middle" fill={amber} fontSize="9" fontFamily="var(--font-mono)">u3_THD</text>

            {/* Leaves */}
            <line x1="50" y1="110" x2="30" y2="155" stroke={borderSubtle} strokeWidth="1.2" />
            <line x1="70" y1="110" x2="90" y2="155" stroke={borderSubtle} strokeWidth="1.2" />
            <line x1="150" y1="110" x2="130" y2="155" stroke={borderSubtle} strokeWidth="1.2" />
            <line x1="170" y1="110" x2="190" y2="155" stroke={borderSubtle} strokeWidth="1.2" />

            <rect x="15" y="155" width="30" height="18" rx="3" fill="rgba(16, 185, 129, 0.2)" stroke={green} />
            <rect x="75" y="155" width="30" height="18" rx="3" fill="rgba(16, 185, 129, 0.2)" stroke={green} />
            <rect x="115" y="155" width="30" height="18" rx="3" fill="rgba(16, 185, 129, 0.2)" stroke={green} />
            <rect x="175" y="155" width="30" height="18" rx="3" fill="rgba(16, 185, 129, 0.2)" stroke={green} />
          </g>

          {/* Signal Dots Traveling from Vector X into Independent Sigmoids */}
          <circle cx="140" cy="170" r="4" fill={cyan} className="stage-dot-route stage-dot-1" />
          <circle cx="140" cy="170" r="4" fill={amber} className="stage-dot-route stage-dot-2" />
          <circle cx="140" cy="170" r="4" fill={pink} className="stage-dot-route stage-dot-3" />

          {/* Independent Multi-Label Probabilities */}
          <g transform="translate(440, 80)">
            <text x="0" y="15" fill={textMuted} fontSize="11" fontFamily="var(--font-mono)">Independent Sigmoids</text>

            <text x="0" y="45" fill={cyan} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">AC: P=0.92</text>
            <rect x="0" y="52" width="110" height="8" rx="3" fill="rgba(0, 229, 255, 0.2)" />
            <rect x="0" y="52" width="101" height="8" rx="3" fill={cyan} className="stage-sigmoid-fill" style={{ animationDelay: '0s' }} />

            <text x="0" y="85" fill={amber} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">Fridge: P=0.88</text>
            <rect x="0" y="92" width="110" height="8" rx="3" fill="rgba(255, 183, 3, 0.2)" />
            <rect x="0" y="92" width="97" height="8" rx="3" fill={amber} className="stage-sigmoid-fill" style={{ animationDelay: '0.6s' }} />

            <text x="0" y="125" fill={pink} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">Fan: P=0.12</text>
            <rect x="0" y="132" width="110" height="8" rx="3" fill="rgba(255, 77, 141, 0.2)" />
            <rect x="0" y="132" width="13" height="8" rx="3" fill={pink} className="stage-sigmoid-fill" style={{ animationDelay: '1.2s' }} />
          </g>

          <text x="300" y="320" textAnchor="middle" fill={textMuted} fontSize="11" fontFamily="var(--font-mono)">
            NOT Softmax • Simultaneous Multi-Label Inference
          </text>
        </svg>
      )}

      {/* 11. STATE TRACKING & HYSTERESIS: Temporal smoothing over windows */}
      {stageIndex === 10 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* Raw Probabilities (Noisy Spike) */}
          <text x="60" y="70" fill={red} fontSize="11" fontFamily="var(--font-mono)">Raw Window Predictions (Flickering Spikes)</text>
          <path d="M 60 120 L 160 120 L 170 80 L 180 120 L 280 120 L 300 80 L 480 80 L 500 120 L 540 120" fill="none" stroke={red} strokeWidth="2" strokeDasharray="3 3" />

          {/* Temporal Hysteresis Filter Arrow */}
          <g transform="translate(300, 160)">
            <rect x="-100" y="-14" width="200" height="28" rx="14" fill="var(--bg-tertiary)" stroke={borderSubtle} />
            <text x="0" y="4" textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">
              Temporal Debounce (3 Windows)
            </text>
          </g>

          {/* Clean State Output with Stable Transition Animation */}
          <text x="60" y="225" fill={green} fontSize="11" fontFamily="var(--font-mono)">Debounced Stable Appliance State</text>
          <path d="M 60 270 L 290 270 L 290 230 L 490 230 L 490 270 L 540 270" fill="none" stroke={green} strokeWidth="3.5" strokeLinecap="round" className="stage-step-rise" />

          <text x="390" y="220" textAnchor="middle" fill={green} fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
            SOLID STATE: ON
          </text>
        </svg>
      )}

      {/* 12. ACTIONABLE DASHBOARD: Final Intelligence Tiers */}
      {stageIndex === 11 && (
        <svg viewBox="0 0 600 360" className="pipeline-diagram-svg">
          {/* 3 Appliance Glow Cards with Subtle Active Glow Animation */}
          <g transform="translate(60, 60)" className="stage-card-glow">
            {/* Card 1: AC */}
            <rect x="0" y="0" width="140" height="190" rx="10" fill="var(--bg-tertiary)" stroke={cyan} strokeWidth="2" />
            <circle cx="70" cy="50" r="22" fill="rgba(0, 229, 255, 0.15)" />
            <text x="70" y="56" textAnchor="middle" fill={cyan} fontSize="18">❄️</text>
            <text x="70" y="95" textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="700">AC Unit</text>
            <rect x="35" y="110" width="70" height="22" rx="11" fill="rgba(0, 229, 255, 0.2)" />
            <text x="70" y="125" textAnchor="middle" fill={cyan} fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">RUNNING</text>
            <text x="70" y="155" textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">1,240 W</text>
          </g>

          <g transform="translate(230, 60)" className="stage-card-glow" style={{ animationDelay: '0.8s' }}>
            {/* Card 2: Fridge */}
            <rect x="0" y="0" width="140" height="190" rx="10" fill="var(--bg-tertiary)" stroke={amber} strokeWidth="2" />
            <circle cx="70" cy="50" r="22" fill="rgba(255, 183, 3, 0.15)" />
            <text x="70" y="56" textAnchor="middle" fill={amber} fontSize="18">🧊</text>
            <text x="70" y="95" textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="700">Fridge</text>
            <rect x="35" y="110" width="70" height="22" rx="11" fill="rgba(255, 183, 3, 0.2)" />
            <text x="70" y="125" textAnchor="middle" fill={amber} fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">CYCLE ON</text>
            <text x="70" y="155" textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-mono)">185 W</text>
          </g>

          <g transform="translate(400, 60)">
            {/* Card 3: Fan */}
            <rect x="0" y="0" width="140" height="190" rx="10" fill="var(--bg-tertiary)" stroke={borderSubtle} strokeWidth="1.5" opacity="0.6" />
            <circle cx="70" cy="50" r="22" fill="var(--bg-primary)" />
            <text x="70" y="56" textAnchor="middle" fill={textMuted} fontSize="18">💨</text>
            <text x="70" y="95" textAnchor="middle" fill={textMuted} fontSize="13" fontWeight="700">Ceiling Fan</text>
            <rect x="40" y="110" width="60" height="22" rx="11" fill="var(--bg-primary)" />
            <text x="70" y="125" textAnchor="middle" fill={textMuted} fontSize="10" fontFamily="var(--font-mono)">OFF</text>
            <text x="70" y="155" textAnchor="middle" fill={textMuted} fontSize="11" fontFamily="var(--font-mono)">0 W</text>
          </g>

          {/* Intelligence Badge */}
          <g transform="translate(300, 290)">
            <rect x="-140" y="-15" width="280" height="30" rx="15" fill="rgba(16, 185, 129, 0.15)" stroke={green} />
            <text x="0" y="5" textAnchor="middle" fill={green} fontSize="11" fontFamily="var(--font-mono)" fontWeight="700">
              4 INTELLIGENCE TIERS OPERATIONAL
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
