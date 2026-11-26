import { useState, useRef, useEffect } from 'react';
import { HERO_PANEL_CONFIG } from '../data/heroPanelConfig';

export default function HeroPanel({ videoReady }) {
  const [activeMap, setActiveMap] = useState(() => {
    const initial = {};
    HERO_PANEL_CONFIG.appliances.forEach((a) => {
      initial[a.id] = a.defaultOn;
    });
    return initial;
  });

  // Animated display numbers for smooth count-up / count-down
  const activeAppliances = HERO_PANEL_CONFIG.appliances.filter((a) => activeMap[a.id]);
  const targetWatts = activeAppliances.reduce((sum, a) => sum + a.watts, 0);
  const targetPf =
    targetWatts > 0
      ? activeAppliances.reduce((sum, a) => sum + a.watts * a.pf, 0) / targetWatts
      : 1.0;
  const targetCostHr = (targetWatts / 1000) * HERO_PANEL_CONFIG.exampleTariffInrPerKwh;

  const [displayWatts, setDisplayWatts] = useState(targetWatts);
  const [displayPf, setDisplayPf] = useState(targetPf);
  const [displayCost, setDisplayCost] = useState(targetCostHr);
  const displayRef = useRef({ watts: targetWatts, pf: targetPf, cost: targetCostHr });

  const panelRef = useRef(null);
  const canvasRef = useRef(null);
  const activeMapRef = useRef(activeMap);
  activeMapRef.current = activeMap;
  const ampAnimRef = useRef(null);
  if (!ampAnimRef.current) {
    ampAnimRef.current = {};
    HERO_PANEL_CONFIG.appliances.forEach((a) => {
      ampAnimRef.current[a.id] = { current: a.defaultOn ? 1 : 0, from: a.defaultOn ? 1 : 0, to: a.defaultOn ? 1 : 0, startMs: 0 };
    });
  }

  // Trigger 1.2s easeInOut amplitude transition when an appliance toggles
  useEffect(() => {
    const now = performance.now();
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    HERO_PANEL_CONFIG.appliances.forEach((a) => {
      const targetAmp = activeMap[a.id] ? 1 : 0;
      const entry = ampAnimRef.current[a.id];
      if (entry.to !== targetAmp) {
        entry.from = reduced ? targetAmp : entry.current;
        entry.to = targetAmp;
        entry.startMs = now;
        if (reduced) entry.current = targetAmp;
      }
    });
  }, [activeMap]);

  // Smooth number count-up / count-down over ~0.9s (easeInOut) when loads toggle
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      displayRef.current = { watts: targetWatts, pf: targetPf, cost: targetCostHr };
      setDisplayWatts(targetWatts);
      setDisplayPf(targetPf);
      setDisplayCost(targetCostHr);
      return;
    }

    const startWatts = displayRef.current.watts;
    const startPf = displayRef.current.pf;
    const startCost = displayRef.current.cost;
    const startTime = performance.now();
    const duration = 900;
    let rafId;

    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const tick = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = easeInOut(p);
      const nextW = Math.round(startWatts + (targetWatts - startWatts) * eased);
      const nextPf = startPf + (targetPf - startPf) * eased;
      const nextC = startCost + (targetCostHr - startCost) * eased;
      displayRef.current = { watts: nextW, pf: nextPf, cost: nextC };
      setDisplayWatts(nextW);
      setDisplayPf(nextPf);
      setDisplayCost(nextC);
      if (p < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetWatts, targetPf, targetCostHr]);

  // Canvas 2D waveform rendering (time-based, 60 fps on desktop with quality governor, paused offscreen/hidden)
  useEffect(() => {
    const panel = panelRef.current;
    const canvas = canvasRef.current;
    if (!panel || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animId = null;
    let isInView = true;
    let isTabVisible = !document.hidden;
    let lastFrameTime = 0;
    let slowFrameStreak = 0;
    let lowQualityMode = false;
    const startTime = performance.now();

    const WAVE_SCROLL_PX_PER_SEC = 34; // Reference 40-42 px/s at 1124px scaled to 920px
    const WAVE_PERIOD_PX = 190; // 190 / 34 = 5.59s per cycle (>= 4s)

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = Math.max(280, Math.floor(rect.width));
      height = Math.max(180, Math.floor(rect.height));
      dpr = lowQualityMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    const io = new IntersectionObserver(
      (entries) => {
        isInView = entries[0].isIntersecting;
        if (isInView && isTabVisible && !animId && !reducedMotion) {
          lastFrameTime = 0;
          animId = requestAnimationFrame(loop);
        }
      },
      { threshold: 0.05 }
    );
    io.observe(panel);

    const onVisibility = () => {
      isTabVisible = !document.hidden;
      if (isInView && isTabVisible && !animId && !reducedMotion) {
        lastFrameTime = 0;
        animId = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Individual wave evaluator (time-based: 34 px/s, 190 px spatial period => 5.59s cycle)
    const evalWave = (charType, xPx, timeSec) => {
      const phase = ((xPx - timeSec * WAVE_SCROLL_PX_PER_SEC) / WAVE_PERIOD_PX) * Math.PI * 2;
      if (charType === 'large') {
        return Math.sin(phase) * 0.95 + Math.sin(phase * 3) * 0.14;
      }
      if (charType === 'periodic') {
        return Math.sin(phase * 1.2 + 0.5) * 0.45 + Math.sin(phase * 2.4) * 0.12;
      }
      if (charType === 'steady') {
        return Math.sin(phase + 1.1) * 0.35;
      }
      // irregular (Cooler)
      return Math.sin(phase * 1.1 + 2.0) * 0.52 + Math.sin(phase * 2.7) * 0.22 + Math.cos(phase * 4.1) * 0.10;
    };

    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const strokeLayered = (pts, colorHex, alpha, coreW) => {
      if (pts.length < 2) return;
      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
      };

      ctx.save();
      ctx.strokeStyle = colorHex;
      ctx.globalAlpha = alpha * 0.18;
      ctx.lineWidth = coreW * 3.6;
      trace();
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.42;
      ctx.lineWidth = coreW * 1.9;
      trace();
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.lineWidth = coreW;
      trace();
      ctx.stroke();
      ctx.restore();
    };

    const drawFrame = (nowMs) => {
      const elapsedSec = (nowMs - startTime) / 1000;
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Wave ease-in over first 1.2s after panel enters
      const waveEase = reducedMotion ? 1 : Math.min(1, elapsedSec / 1.2);
      const isStacked = width < 640;
      const active = activeMapRef.current;

      // Update per-appliance 1.2s easeInOut amplitude factors
      const ampFactors = {};
      HERO_PANEL_CONFIG.appliances.forEach((app) => {
        const entry = ampAnimRef.current[app.id];
        if (reducedMotion) {
          entry.current = entry.to;
        } else {
          const p = Math.min(1, (nowMs - entry.startMs) / 1200);
          entry.current = entry.from + (entry.to - entry.from) * easeInOut(p);
        }
        ampFactors[app.id] = entry.current;
      });

      // Layout geometry matching reference: Left 36% signatures | Center 16% VMD node | Right 48% aggregate
      const leftEnd = isStacked ? width * 0.92 : width * 0.35;
      const vmdX = isStacked ? width * 0.50 : width * 0.455;
      const vmdY = isStacked ? height * 0.46 : height * 0.50;
      const rightStart = isStacked ? width * 0.06 : width * 0.54;
      const rightEnd = isStacked ? width * 0.94 : width - 12;

      const sigTop = isStacked ? 26 : 36;
      const sigHeight = isStacked ? height * 0.28 : height - 56;
      const trackSpacing = sigHeight / 4;

      const aggTop = isStacked ? height * 0.69 : 36;
      const aggHeight = isStacked ? height * 0.28 : height - 52;
      const aggMidY = aggTop + aggHeight * 0.5;

      // 1. Right-side Grid Background for Aggregate Wave
      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gridStep = 28;
      for (let gx = rightStart; gx <= rightEnd; gx += gridStep) {
        ctx.moveTo(gx, aggTop);
        ctx.lineTo(gx, aggTop + aggHeight);
      }
      for (let gy = aggTop; gy <= aggTop + aggHeight; gy += gridStep) {
        ctx.moveTo(rightStart, gy);
        ctx.lineTo(rightEnd, gy);
      }
      ctx.stroke();

      // Zero baseline on aggregate chart
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.moveTo(rightStart, aggMidY);
      ctx.lineTo(rightEnd, aggMidY);
      ctx.stroke();
      ctx.restore();

      // Use additive glow on dark mode, clean source-over on light mode for crisp contrast
      ctx.globalCompositeOperation = isLight ? 'source-over' : 'lighter';

      // 2. Draw 4 Appliance Mini-Waves + Curved Connecting Lines + Traveling Dots into VMD Node
      const leftStart = isStacked ? 62 : 68;
      HERO_PANEL_CONFIG.appliances.forEach((app, idx) => {
        const isOn = !!active[app.id];
        const ampFactor = ampFactors[app.id] ?? (isOn ? 1 : 0);
        const color = isLight ? app.lightColor : app.darkColor;
        const trackY = sigTop + trackSpacing * (idx + 0.55);
        const amp = (isStacked ? 8 : 11) * waveEase * ampFactor;

        // Mini-wave points
        const pts = [];
        for (let x = leftStart; x <= leftEnd; x += 4) {
          const y = ampFactor > 0.01 ? trackY + evalWave(app.character, x, elapsedSec) * amp : trackY;
          pts.push({ x, y });
        }

        if (ampFactor > 0.02) {
          strokeLayered(pts, color, 0.35 + 0.60 * ampFactor, 1.8);
        } else {
          ctx.save();
          ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.14)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(leftStart, trackY);
          ctx.lineTo(leftEnd, trackY);
          ctx.stroke();
          ctx.restore();
        }

        // Curved connector from wave end to VMD circle (desktop layout)
        if (!isStacked) {
          const cx1 = leftEnd + (vmdX - leftEnd) * 0.5;
          const cy1 = trackY;
          const cx2 = leftEnd + (vmdX - leftEnd) * 0.5;
          const cy2 = vmdY;

          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.14 + 0.46 * ampFactor;
          ctx.lineWidth = 1.0 + 0.6 * ampFactor;
          ctx.beginPath();
          ctx.moveTo(leftEnd, trackY);
          ctx.bezierCurveTo(cx1, cy1, cx2, cy2, vmdX - 20, vmdY);
          ctx.stroke();

          // Slow traveling dot along bezier when active (~5.5s per trip)
          if (ampFactor > 0.1 && !reducedMotion) {
            const dotT = ((elapsedSec / 5.5 + idx * 0.25) % 1);
            const mt = 1 - dotT;
            const dx =
              mt * mt * mt * leftEnd +
              3 * mt * mt * dotT * cx1 +
              3 * mt * dotT * dotT * cx2 +
              dotT * dotT * dotT * (vmdX - 20);
            const dy =
              mt * mt * mt * trackY +
              3 * mt * mt * dotT * cy1 +
              3 * mt * dotT * dotT * cy2 +
              dotT * dotT * dotT * vmdY;
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(dx, dy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });

      // Horizontal connector from VMD node to Aggregate chart (desktop)
      const aggColor = isLight ? '#006878' : '#00e5ff';
      if (!isStacked) {
        ctx.save();
        ctx.strokeStyle = aggColor;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(vmdX + 20, vmdY);
        ctx.lineTo(rightStart, aggMidY);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Draw Large Aggregate Wave (sum of eased appliance waves)
      const aggPts = [];
      const aggScale = (isStacked ? 18 : 28) * waveEase;
      let totalActiveAmp = 0;
      HERO_PANEL_CONFIG.appliances.forEach((app) => {
        totalActiveAmp += ampFactors[app.id] || 0;
      });
      for (let x = rightStart; x <= rightEnd; x += 3) {
        let sum = 0;
        HERO_PANEL_CONFIG.appliances.forEach((app) => {
          const af = ampFactors[app.id] || 0;
          if (af > 0.005) {
            sum += evalWave(app.character, x, elapsedSec) * af;
          }
        });
        // Add tiny illustrative noise ripple when any load is active
        const noise = totalActiveAmp > 0.05 ? Math.sin(x * 0.23 + elapsedSec * 1.4) * 0.03 * Math.min(1, totalActiveAmp) : 0;
        aggPts.push({ x, y: aggMidY + (sum + noise) * aggScale });
      }

      if (totalActiveAmp > 0.02) {
        strokeLayered(aggPts, aggColor, 0.98, 2.3);
      } else {
        ctx.save();
        ctx.strokeStyle = aggColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rightStart, aggMidY);
        ctx.lineTo(rightEnd, aggMidY);
        ctx.stroke();
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
    };

    const loop = (now) => {
      if (!isInView || !isTabVisible) {
        animId = null;
        return;
      }
      const minInterval = lowQualityMode || window.innerWidth < 768 ? 1000 / 30 : 1000 / 60;
      if (now - lastFrameTime >= minInterval - 1) {
        const frameStart = performance.now();
        lastFrameTime = now;
        drawFrame(now);
        const frameCost = performance.now() - frameStart;
        if (!lowQualityMode && frameCost > 16.5) {
          slowFrameStreak++;
          if (slowFrameStreak >= 4) {
            lowQualityMode = true;
            resize();
          }
        } else {
          slowFrameStreak = 0;
        }
      }
      animId = requestAnimationFrame(loop);
    };

    if (reducedMotion) {
      drawFrame(startTime + 1500);
    } else {
      animId = requestAnimationFrame(loop);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const toggleAppliance = (id) => {
    setActiveMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeCount = activeAppliances.length;

  return (
    <div
      ref={panelRef}
      className={`hero-panel ${videoReady ? 'panel-entered' : ''}`}
      role="region"
      aria-label="Interactive NILM mains disaggregation demonstration panel"
    >
      {/* Header Row */}
      <div className="hp-header">
        <div className="hp-header-left">
          <span className="hp-live-dot" aria-hidden="true" />
          <span className="hp-mains-title">{HERO_PANEL_CONFIG.mainsLabel}</span>
        </div>

        <div className="hp-header-right">
          <div className="hp-stat">
            <span className="hp-stat-label">LOAD</span>
            <span className="hp-stat-val cyan">{displayWatts.toLocaleString()} W</span>
          </div>
          <span className="hp-divider" aria-hidden="true">|</span>
          <div className="hp-stat">
            <span className="hp-stat-label">PF</span>
            <span className="hp-stat-val green">{displayPf.toFixed(2)}</span>
          </div>
          <span className="hp-divider" aria-hidden="true">|</span>
          <div className="hp-stat">
            <span className="hp-stat-label">EST.</span>
            <span className="hp-stat-val">₹{displayCost.toFixed(2)}/hr</span>
          </div>
          <span className="hp-demo-chip">{HERO_PANEL_CONFIG.demoChip}</span>
        </div>
      </div>

      {/* Main Chart Area (Canvas + HTML Overlays) */}
      <div className="hp-chart-area">
        <canvas ref={canvasRef} className="hp-canvas" />

        {/* Left Overlay Labels */}
        <span className="hp-badge-left">{`APPLIANCE SIGNATURES`}</span>
        <div className="hp-sig-labels" aria-hidden="true">
          {HERO_PANEL_CONFIG.appliances.map((app) => (
            <span
              key={app.id}
              className={`hp-sig-name ${activeMap[app.id] ? 'on' : 'off'}`}
              style={{ '--app-dark': app.darkColor, '--app-light': app.lightColor }}
            >
              {app.name.toUpperCase()}
            </span>
          ))}
        </div>

        {/* Center VMD Node Overlay */}
        <div className="hp-vmd-hub" aria-hidden="true">
          <div className="hp-vmd-circle">{HERO_PANEL_CONFIG.vmdNodeLabel}</div>
          <div className="hp-vmd-caption">{HERO_PANEL_CONFIG.sensorCaption}</div>
        </div>

        {/* Right Aggregate Badge */}
        <span className="hp-badge-right">{HERO_PANEL_CONFIG.aggregateBadge}</span>
      </div>

      {/* Bottom Interactive Toggles */}
      <div className="hp-bottom">
        <div className="hp-bottom-bar">
          <span className="hp-toggle-prompt">{HERO_PANEL_CONFIG.togglePrompt}</span>
          <span className="hp-tariff-note">{HERO_PANEL_CONFIG.tariffLabel} · Illustrative</span>
          <span className="hp-active-count">{activeCount} / {HERO_PANEL_CONFIG.appliances.length} Active</span>
        </div>

        <div className="hp-toggle-grid">
          {HERO_PANEL_CONFIG.appliances.map((app) => {
            const isOn = !!activeMap[app.id];
            return (
              <button
                key={app.id}
                type="button"
                aria-pressed={isOn}
                onClick={() => toggleAppliance(app.id)}
                className={`hp-toggle-card ${isOn ? 'is-on' : 'is-off'}`}
                style={{ '--app-dark': app.darkColor, '--app-light': app.lightColor }}
              >
                <div className="hp-card-top">
                  <span className="hp-card-name">
                    <span className="hp-card-dot" aria-hidden="true" />
                    {app.name}
                  </span>
                  <span className={`hp-state-pill ${isOn ? 'on' : 'off'}`}>
                    {isOn ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="hp-card-bottom">
                  <span className="hp-card-watts">{isOn ? `${app.watts.toLocaleString()}W` : '0 W'}</span>
                  <span className="hp-card-type">{app.loadType}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
