import { useState, useRef } from 'react';
import { Sliders, Zap } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { CONTENT } from '../data/content';
import { synthesizeAggregateSignal } from '../lib/signalMath';
import { useSharedCanvas, getThemeColors, isReducedMotion } from '../lib/motion';

gsap.registerPlugin(ScrollTrigger);

export default function TheProblem() {
  const [acOn, setAcOn] = useState(true);
  const [fridgeOn, setFridgeOn] = useState(true);
  const [fanOn, setFanOn] = useState(true);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const splitRef = useRef(0);

  // Scroll-driven decomposition: aggregate wave visibly separates into 3 appliance lanes as user scrolls
  useGSAP(() => {
    if (isReducedMotion()) return;

    ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top 70%',
      end: 'bottom 30%',
      scrub: true,
      onUpdate: (self) => {
        splitRef.current = self.progress;
      }
    });
  }, { scope: containerRef });

  // 4-lane oscilloscope canvas driven by shared ticker
  useSharedCanvas(canvasRef, (ctx, width, height, time) => {
    const colors = getThemeColors();
    const gridColor = colors.oscilloscopeGrid;
    const mainsColor = colors.mainsColor;
    const acColor = colors.acColor;
    const fridgeColor = colors.fridgeColor;
    const fanColor = colors.fanColor;
    const textPrimary = colors.textPrimary || '#f8fafc';
    const textMuted = colors.textMuted || '#64748b';

    // Slowed down time: real mains is 50 Hz.
    // 50 Hz * 0.01 = 0.5 Hz -> one cycle takes 2.0 seconds.
    const slowedTime = time * 0.01;

    // Show at least 3 full cycles across the screen width at any viewport
    const numPoints = Math.max(120, Math.floor(width / 2.5));
    const { acPoints, fridgePoints, fanPoints, sumPoints } = synthesizeAggregateSignal({
      acOn,
      fridgeOn,
      fanOn,
      timeOffset: slowedTime,
      numPoints,
      cycles: 3.2
    });

    const split = splitRef.current; // 0 = fully aggregate, 1 = fully separated 4 lanes
    const laneHeight = height / 4;

    // Background horizontal baseline grids
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= 4; i++) {
      const y = laneHeight * (i - 0.5);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    if (split < 0.1) {
      // 1. Single Entangled Aggregate Waveform
      const centerY = height / 2;
      // Fixed normalization: sum peak is ~10.2A; normalized so it never exceeds 40% of canvas height
      const scaleY = (height * 0.38) / 10.5;

      ctx.strokeStyle = mainsColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      sumPoints.forEach((pt, i) => {
        const px = pt.x * width;
        const py = centerY - pt.y * scaleY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Top corner badge label (well clear of waveforms)
      ctx.fillStyle = textPrimary;
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText("ENTANGLED AGGREGATE MAINS CURRENT x(t) = Σ I_i(t) + n(t)", 16, 26);
      ctx.fillStyle = textMuted;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText("↓ Scroll down to separate into physical appliance contributions", 16, 44);

    } else {
      // 2. Visibly Split into 4 distinct physical lanes
      // Each lane is strictly normalized to stay within its laneHeight (max amplitude <= 35% of laneHeight)
      const lanes = [
        { name: "AC Current I_ac(t) — Inductive Motor (~7.9A pk)", points: acPoints, color: acColor, active: acOn, maxPk: 8.5 },
        { name: "Fridge Current I_fridge(t) — Cyclic Compressor (~2.0A pk)", points: fridgePoints, color: fridgeColor, active: fridgeOn, maxPk: 2.5 },
        { name: "Fan Current I_fan(t) — Low-Order Harmonic (~0.5A pk)", points: fanPoints, color: fanColor, active: fanOn, maxPk: 0.8 },
        { name: "Aggregate Mains x(t) = Σ I(t) + n(t) (~10.2A pk)", points: sumPoints, color: mainsColor, active: true, maxPk: 11.0, isSum: true }
      ];

      lanes.forEach((lane, idx) => {
        // Interpolate baseline center position from aggregate center (height/2) to dedicated lane
        const targetCenterY = laneHeight * idx + laneHeight / 2;
        const aggregateCenterY = height / 2;
        const currentCenterY = aggregateCenterY + (targetCenterY - aggregateCenterY) * split;

        // Channel label above the baseline to never overlap the waveform
        ctx.fillStyle = lane.active ? lane.color : textMuted;
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText(lane.name, 16, Math.max(16, currentCenterY - (laneHeight * 0.36)));

        if (!lane.active) {
          ctx.strokeStyle = textMuted;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(16, currentCenterY);
          ctx.lineTo(width - 16, currentCenterY);
          ctx.stroke();
          ctx.setLineDash([]);
          return;
        }

        // Fixed channel scale: exactly laneHeight * 0.32 / maxPk (never dependent on scroll progress)
        const laneScaleY = (laneHeight * 0.34) / lane.maxPk;

        ctx.strokeStyle = lane.color;
        ctx.lineWidth = lane.isSum ? 2.6 : 2.0;
        ctx.beginPath();
        lane.points.forEach((pt, i) => {
          const px = pt.x * width;
          const py = currentCenterY - pt.y * laneScaleY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
    }
  }, [acOn, fridgeOn, fanOn]);

  return (
    <section ref={containerRef} className="section-wrapper" aria-labelledby="the-problem-heading">
      <div className="section-header">
        <span className="tag-badge illustrative">
          <Sliders size={13} />
          {CONTENT.theProblem.badge}
        </span>
        <h2 id="the-problem-heading" className="section-title">
          {CONTENT.theProblem.title}
        </h2>
        <p className="section-subtitle">
          {CONTENT.theProblem.subtitle}
        </p>
      </div>

      {/* Interactive Appliance Hardware Switches */}
      <div className="appliance-toggles-row full-width">
        <button
          type="button"
          onClick={() => setAcOn(!acOn)}
          className={`appliance-toggle-btn ${acOn ? 'active-ac' : 'inactive'}`}
          aria-pressed={acOn}
        >
          <span className="toggle-indicator-dot" />
          <Zap size={15} />
          <span>Air Conditioner (6.2A)</span>
          <span className="toggle-state-badge">{acOn ? 'ON' : 'OFF'}</span>
        </button>

        <button
          type="button"
          onClick={() => setFridgeOn(!fridgeOn)}
          className={`appliance-toggle-btn ${fridgeOn ? 'active-fridge' : 'inactive'}`}
          aria-pressed={fridgeOn}
        >
          <span className="toggle-indicator-dot" />
          <Zap size={15} />
          <span>Refrigerator (1.1A)</span>
          <span className="toggle-state-badge">{fridgeOn ? 'ON' : 'OFF'}</span>
        </button>

        <button
          type="button"
          onClick={() => setFanOn(!fanOn)}
          className={`appliance-toggle-btn ${fanOn ? 'active-fan' : 'inactive'}`}
          aria-pressed={fanOn}
        >
          <span className="toggle-indicator-dot" />
          <Zap size={15} />
          <span>Ceiling Fan (0.35A)</span>
          <span className="toggle-state-badge">{fanOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Live Oscilloscope Display */}
      <div className="problem-interactive-box full-width">
        <div className="oscilloscope-header">
          <span className="oscilloscope-title">
            MULTI-CHANNEL CURRENT SUPERPOSITION • SCROLL TO DECOMPOSE
          </span>
          <span className="tag-badge illustrative" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Slowed down for viewing, real mains is 50 cycles per second</span>
            <span>•</span>
            <span>Fs ≈ 8–10 kHz</span>
          </span>
        </div>

        <canvas
          ref={canvasRef}
          className="oscilloscope-canvas"
          aria-label="Interactive multi-channel current superposition oscilloscope"
        />

        <p className="section-caption-note">
          Formula: <code style={{ color: 'var(--accent-cyan)' }}>x(t) = AC(t) + Fridge(t) + Fan(t) + noise(t)</code>. All downstream appliances share the 230V mains bus; current waveforms superimpose additively.
        </p>
      </div>
    </section>
  );
}
