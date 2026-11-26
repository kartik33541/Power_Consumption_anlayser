import { useState, useRef, useEffect } from 'react';
import { Layers, AlertTriangle } from 'lucide-react';
import { CONTENT } from '../data/content';
import { runVMD } from '../lib/vmd';
import { useSharedCanvas, getThemeColors, isReducedMotion } from '../lib/motion';

const MODE_COLORS = [
  '#00e5ff',
  '#ffb703',
  '#ff4d8d',
  '#fb923c',
  '#a855f7',
  '#34d399',
  '#38bdf8',
  '#f43f5e',
];

const LIGHT_MODE_COLORS = [
  '#006878',
  '#b45309',
  '#be185d',
  '#c2410c',
  '#7e22ce',
  '#047857',
  '#0369a1',
  '#be123c',
];

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function VmdSection() {
  const defaultK = CONTENT.vmd.parameters.kDefault;
  const defaultAlpha = CONTENT.vmd.parameters.alpha;

  const [k, setK] = useState(defaultK);
  const [alpha, setAlpha] = useState(defaultAlpha);
  const [isComputing, setIsComputing] = useState(false);

  const cacheRef = useRef(null);
  if (!cacheRef.current) {
    cacheRef.current = new Map();
    const initial = runVMD({ K: defaultK, alpha: defaultAlpha });
    cacheRef.current.set(`${defaultK}:${defaultAlpha}`, initial);
  }

  const [vmdResult, setVmdResult] = useState(() => cacheRef.current.get(`${defaultK}:${defaultAlpha}`));
  const spectrumCanvasRef = useRef(null);
  const workerRef = useRef(null);
  const reqIdRef = useRef(0);
  const morphRef = useRef({
    fromModes: vmdResult.modes,
    toModes: vmdResult.modes,
    startMs: 0,
  });

  // Initialize Web Worker once
  useEffect(() => {
    if (typeof Worker === 'undefined') return undefined;
    try {
      workerRef.current = new Worker(new URL('../workers/vmdWorker.js', import.meta.url), {
        type: 'module',
      });
    } catch {
      workerRef.current = null;
    }
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Debounced (150ms) worker execution with cache and >150ms computing indicator
  useEffect(() => {
    const key = `${k}:${alpha}`;
    const applyResult = (nextRes) => {
      morphRef.current = {
        fromModes: morphRef.current.toModes,
        toModes: nextRes.modes,
        startMs: performance.now(),
      };
      setVmdResult(nextRes);
      setIsComputing(false);
    };

    if (cacheRef.current.has(key)) {
      applyResult(cacheRef.current.get(key));
      return undefined;
    }

    const reqId = ++reqIdRef.current;
    let slowTimer = null;

    const debounceTimer = setTimeout(() => {
      if (workerRef.current) {
        slowTimer = setTimeout(() => {
          if (reqId === reqIdRef.current) setIsComputing(true);
        }, 150);

        const onMsg = (e) => {
          if (e.data.id !== reqId) return;
          workerRef.current?.removeEventListener('message', onMsg);
          if (slowTimer) clearTimeout(slowTimer);
          if (e.data.ok && reqId === reqIdRef.current) {
            cacheRef.current.set(key, e.data.result);
            applyResult(e.data.result);
          }
        };
        workerRef.current.addEventListener('message', onMsg);
        workerRef.current.postMessage({ id: reqId, K: k, alpha });
      } else {
        const res = runVMD({ K: k, alpha });
        cacheRef.current.set(key, res);
        if (reqId === reqIdRef.current) applyResult(res);
      }
    }, 150);

    return () => {
      clearTimeout(debounceTimer);
      if (slowTimer) clearTimeout(slowTimer);
    };
  }, [k, alpha]);

  // Refresh ScrollTrigger when VMD card grid height changes with K
  useEffect(() => {
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      import('gsap/ScrollTrigger')
        .then(({ ScrollTrigger }) => {
          if (!cancelled) ScrollTrigger.refresh();
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [vmdResult.K]);

  // Dynamic Spectrum drawn via shared ticker with 0.6s curve morph
  useSharedCanvas(spectrumCanvasRef, (ctx, width, height) => {
    const colors = getThemeColors();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const palette = isLight ? LIGHT_MODE_COLORS : MODE_COLORS;
    const gridColor = colors.oscilloscopeGrid;

    // 1. Axis & Grid (0 .. 400 Hz for fs=1000 Hz synthetic signal)
    const maxFreq = 400;
    const padLeft = 42;
    const padRight = 22;
    const baseLineY = height - 30;
    const plotWidth = width - padLeft - padRight;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, baseLineY);
    ctx.lineTo(width - padRight, baseLineY);
    ctx.stroke();

    for (let f = 0; f <= maxFreq; f += 50) {
      const px = padLeft + (f / maxFreq) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(px, baseLineY);
      ctx.lineTo(px, baseLineY + 6);
      ctx.stroke();
      ctx.fillStyle = colors.textMuted || '#94a3b8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${f}Hz`, px, height - 10);
    }

    // 2. Interpolate modes over 0.6s
    const { fromModes, toModes, startMs } = morphRef.current;
    const reduced = isReducedMotion();
    const rawP = reduced || !startMs ? 1 : Math.min(1, (performance.now() - startMs) / 600);
    const p = easeInOut(rawP);

    const drawCount = toModes.length;
    const maxPeakPx = height - 62;

    for (let i = 0; i < drawCount; i++) {
      const target = toModes[i];
      const prev = fromModes[i] || {
        centerFrequency: target.centerFrequency,
        bandwidth: target.bandwidth,
        energyShare: 0,
      };

      const fc = prev.centerFrequency + (target.centerFrequency - prev.centerFrequency) * p;
      const bw = prev.bandwidth + (target.bandwidth - prev.bandwidth) * p;
      const share = prev.energyShare + (target.energyShare - prev.energyShare) * p;

      const centerPx = padLeft + (Math.min(maxFreq, Math.max(0, fc)) / maxFreq) * plotWidth;
      const bandWidthPx = Math.max(12, (bw / maxFreq) * plotWidth * 3.2);
      const peakHeight = Math.max(8, maxPeakPx * (share / 100));
      const color = palette[i % palette.length];

      // Gaussian band-limited mode curve
      ctx.beginPath();
      ctx.moveTo(centerPx - bandWidthPx, baseLineY);
      for (let x = -bandWidthPx; x <= bandWidthPx; x += 2) {
        const norm = x / (bandWidthPx / 2.3);
        const y = Math.exp(-0.5 * norm * norm) * peakHeight;
        ctx.lineTo(centerPx + x, baseLineY - y);
      }
      ctx.lineTo(centerPx + bandWidthPx, baseLineY);
      ctx.fillStyle = `${color}28`;
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Center frequency marker
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(centerPx, baseLineY);
      ctx.lineTo(centerPx, baseLineY - peakHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`u_${target.modeIndex} (${fc.toFixed(0)}Hz)`, centerPx, Math.max(16, baseLineY - peakHeight - 6));
    }
  }, [vmdResult]);

  const isLightTheme =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light';
  const cardPalette = isLightTheme ? LIGHT_MODE_COLORS : MODE_COLORS;

  return (
    <section className="section-wrapper" aria-labelledby="vmd-heading">
      <div className="section-header">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span className="tag-badge evaluating">
            <AlertTriangle size={13} />
            {CONTENT.vmd.evaluationBadge}
          </span>
          <span className="tag-badge illustrative">
            <Layers size={13} />
            {CONTENT.vmd.badge}
          </span>
        </div>

        <h2 id="vmd-heading" className="section-title">
          {CONTENT.vmd.title}
        </h2>
        <p className="section-subtitle">
          {CONTENT.vmd.subtitle}
        </p>
      </div>

      <div className="problem-interactive-box">
        {/* Interactive Controls (44px Accessible Targets) */}
        <div className="vmd-control-panel">
          <div className="slider-group">
            <label htmlFor="k-slider" style={{ fontWeight: 600 }}>
              Number of Modes (K): <strong style={{ color: 'var(--accent-cyan)' }}>{k}</strong>
            </label>
            <input
              id="k-slider"
              type="range"
              min={CONTENT.vmd.parameters.kMin}
              max={CONTENT.vmd.parameters.kMax}
              value={k}
              onChange={(e) => setK(parseInt(e.target.value, 10))}
              className="slider-input"
              aria-label="Adjust number of VMD decomposed modes K"
            />
          </div>

          <div className="slider-group">
            <label htmlFor="alpha-slider" style={{ fontWeight: 600 }}>
              Penalty α: <strong style={{ color: 'var(--accent-cyan)' }}>{alpha}</strong>
            </label>
            <input
              id="alpha-slider"
              type="range"
              min={500}
              max={5000}
              step={250}
              value={alpha}
              onChange={(e) => setAlpha(parseInt(e.target.value, 10))}
              className="slider-input"
              aria-label="Adjust VMD bandwidth penalty alpha"
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-md)', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              Recon SNR: <strong id="vmd-recon-snr" style={{ color: '#10b981' }}>{vmdResult.reconSnrDb.toFixed(1)} dB</strong>
            </span>
            {isComputing && (
              <span className="tag-badge evaluating" role="status">
                Computing VMD...
              </span>
            )}
          </div>

          <span className="tag-badge illustrative" style={{ marginLeft: 'auto' }}>
            Sorted: ω₁ &lt; ω₂ &lt; ... &lt; ω_K
          </span>
        </div>

        {/* Dynamic Spectrum Canvas */}
        <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '12px', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-xl)' }}>
          <canvas
            ref={spectrumCanvasRef}
            style={{ width: '100%', height: '240px', display: 'block' }}
            aria-label="Interactive frequency spectrum showing band-limited VMD mode distributions around center frequencies"
          />
        </div>

        {/* Real VMD Mode Breakdown */}
        <h3 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-sm)' }}>
          Mode Sub-Band Decomposition &amp; Synthetic Component Energy Projection:
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
          {CONTENT.vmd.disclaimer}
        </p>

        <div className="vmd-modes-grid">
          {vmdResult.modes.map((mode, idx) => {
            const modeColor = cardPalette[idx % cardPalette.length];
            const shares = mode.componentShares;
            const totalComp = shares.grid + shares.compressor + shares.fan || 1;
            const gridBar = (shares.grid / totalComp) * 100;
            const compBar = (shares.compressor / totalComp) * 100;
            const fanBar = (shares.fan / totalComp) * 100;

            return (
              <div
                key={`mode-${mode.modeIndex}`}
                className="vmd-mode-card vmd-card-enter"
                style={{
                  borderTop: `3px solid ${modeColor}`,
                  animationDelay: `${(idx % 8) * 60}ms`,
                }}
              >
                <div className="vmd-mode-header">
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: modeColor, display: 'inline-block' }} />
                    Mode u_{mode.modeIndex}
                  </strong>
                  <span className="tag-badge illustrative">{mode.centerFrequency} Hz</span>
                </div>

                <div className="vmd-mode-metrics">
                  <span>Energy: <strong>{mode.energyShare}%</strong></span>
                  <span>BW: <strong>{mode.bandwidth} Hz</strong></span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '4px' }}>
                  Share of each synthetic component inside this mode:
                </div>

                <div className="stacked-contribution-bar" role="progressbar" aria-label={`Mode ${mode.modeIndex} component energy share`}>
                  <div
                    className="contrib-segment"
                    style={{ width: `${gridBar}%`, background: 'var(--color-ac)' }}
                    title={`50 Hz grid: ${shares.grid}%`}
                  />
                  <div
                    className="contrib-segment"
                    style={{ width: `${compBar}%`, background: 'var(--color-fridge)' }}
                    title={`~150 Hz compressor-like: ${shares.compressor}%`}
                  />
                  <div
                    className="contrib-segment"
                    style={{ width: `${fanBar}%`, background: 'var(--color-fan)' }}
                    title={`~250 Hz fan-like: ${shares.fan}%`}
                  />
                </div>

                <div className="contrib-legend">
                  <span style={{ color: 'var(--color-ac)' }}>50Hz grid: {shares.grid}%</span>
                  <span style={{ color: 'var(--color-fridge)' }}>Compressor-like: {shares.compressor}%</span>
                  <span style={{ color: 'var(--color-fan)' }}>Fan-like: {shares.fan}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'var(--space-md)' }}>
          If K is larger than the number of real components, VMD splits a component or captures noise. K=3 matches this synthetic signal.
        </p>

        {/* Formal Retention Decision Box */}
        <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-md)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #f59e0b', fontSize: '0.875rem' }}>
          <strong>Phase 10 Retention Rule:</strong> {CONTENT.vmd.retentionRule.keepCondition} <em>{CONTENT.vmd.retentionRule.dropCondition}</em>
        </div>
      </div>
    </section>
  );
}
