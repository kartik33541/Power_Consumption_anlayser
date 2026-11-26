import { useRef, useEffect } from 'react';

const isReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function LivingBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isReducedMotion()) return;

    // Layer 2 runs on desktop (>= 768px); mobile uses Layer 1 CSS mesh for 90+ perf
    if (window.innerWidth < 768) return;

    let isCancelled = false;
    let animId = null;
    let idleHandle = null;
    let fallbackTimer = null;
    let observer = null;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let currentMood = 'default'; // 'default' | 'problem' | 'superposition' | 'vmd' | 'model'
    let isTabVisible = !document.hidden;
    let slowFrameStreak = 0;
    let degradedMode = false;
    let lastFrameTime = 0;
    let mo = null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      // Half-resolution buffer scaled to 100vw x 100vh via CSS (4x fewer pixels, zero rectangular seam)
      width = Math.max(320, Math.floor(window.innerWidth * 0.5));
      height = Math.max(240, Math.floor(window.innerHeight * 0.5));
      canvas.width = width;
      canvas.height = height;
    };

    const getTheme = () => document.documentElement.getAttribute('data-theme') || 'dark';

    // 60 slow drifting particles
    const particles = Array.from({ length: 60 }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.22 - 0.08,
      r: 1.2 + (i % 3) * 0.7,
      hueIdx: i % 3
    }));

    const initLayer2 = () => {
      if (isCancelled) return;
      resize();
      window.addEventListener('resize', resize, { passive: true });

      const onVisibility = () => {
        isTabVisible = !document.hidden;
        if (isTabVisible && !animId && slowFrameStreak < 4) {
          lastFrameTime = 0;
          animId = requestAnimationFrame(render);
        }
      };
      document.addEventListener('visibilitychange', onVisibility);

      // Section mood detection
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.id || '';
              if (id.includes('why') || id.includes('limits')) currentMood = 'problem';
              else if (id.includes('problem')) currentMood = 'superposition';
              else if (id.includes('vmd') || id.includes('pipeline')) currentMood = 'vmd';
              else if (id.includes('model') || id.includes('features') || id.includes('tracker')) currentMood = 'model';
              else currentMood = 'default';
            }
          });
        },
        { threshold: 0.2 }
      );

      const observeSections = (root = document) => {
        root.querySelectorAll('section[id], h2[id]').forEach((el) => {
          if (!el.dataset.bgObserved) {
            el.dataset.bgObserved = '1';
            observer.observe(el);
          }
        });
      };
      observeSections();

      mo = new MutationObserver(() => observeSections());
      mo.observe(document.body, { childList: true, subtree: true });

      const render = (now) => {
        if (!isTabVisible || isCancelled) {
          animId = null;
          return;
        }

        // 30 fps normal, 15 fps if adaptive governor detects slow frames (never kills canvas)
        const minInterval = degradedMode ? 1000 / 15 : 1000 / 30;
        if (lastFrameTime && now - lastFrameTime < minInterval) {
          animId = requestAnimationFrame(render);
          return;
        }

        const frameStart = performance.now();
        lastFrameTime = now;
        const t = now * 0.001;
        const isLight = getTheme() === 'light';

        ctx.clearRect(0, 0, width, height);

        const palette = isLight
          ? ['rgba(0, 104, 120, ', 'rgba(146, 64, 14, ', 'rgba(159, 18, 57, ']
          : ['rgba(0, 229, 255, ', 'rgba(255, 183, 3, ', 'rgba(255, 77, 141, '];

        // 1. Mood-specific background layer
        if (currentMood === 'problem') {
          // Faint animated grid with slow light sweep
          ctx.strokeStyle = isLight ? 'rgba(0, 104, 120, 0.05)' : 'rgba(0, 229, 255, 0.05)';
          ctx.lineWidth = 1;
          const step = 64;
          ctx.beginPath();
          for (let x = 0; x < width; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
          }
          for (let y = 0; y < height; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
          }
          ctx.stroke();

          const sweepX = ((t * 60) % (width + 400)) - 200;
          const grad = ctx.createLinearGradient(sweepX - 150, 0, sweepX + 150, 0);
          grad.addColorStop(0, 'rgba(0, 229, 255, 0)');
          grad.addColorStop(0.5, isLight ? 'rgba(0, 104, 120, 0.06)' : 'rgba(0, 229, 255, 0.08)');
          grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(sweepX - 150, 0, 300, height);
        } else if (currentMood === 'vmd') {
          // Rising spectrum bars
          const barCount = 24;
          const barW = width / barCount;
          for (let i = 0; i < barCount; i++) {
            const hRatio = 0.08 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 0.55));
            const bh = height * hRatio;
            ctx.fillStyle = palette[i % 3] + (isLight ? '0.045)' : '0.06)');
            ctx.fillRect(i * barW + 4, height - bh, barW - 8, bh);
          }
        }

        // 2. Three faint flowing sine ribbons (always gentle, stronger in superposition)
        const ribbonAlpha = currentMood === 'superposition' ? (isLight ? 0.14 : 0.18) : (isLight ? 0.08 : 0.11);
        for (let r = 0; r < 3; r++) {
          ctx.strokeStyle = palette[r] + ribbonAlpha + ')';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          const baseY = height * (0.28 + r * 0.22);
          for (let x = 0; x <= width; x += 24) {
            const y = baseY + Math.sin(x * 0.004 + t * (0.4 + r * 0.15) + r * 2) * (34 + r * 10);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // 3. 60 slow drifting particles (+ faint node network in model mood)
        const pAlpha = isLight ? 0.24 : 0.34;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.fillStyle = palette[p.hueIdx] + pAlpha + ')';
          const sz = Math.max(1.5, p.r);
          ctx.fillRect(p.x, p.y, sz, sz);

          if (!degradedMode && currentMood === 'model' && i < 36) {
            for (let j = i + 1; j < 36; j++) {
              const q = particles[j];
              const dx = p.x - q.x;
              const dy = p.y - q.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 3600) {
                ctx.strokeStyle = palette[0] + (isLight ? '0.07)' : '0.09)');
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.stroke();
              }
            }
          }
        }

        const elapsed = performance.now() - frameStart;
        if (elapsed > 32) {
          slowFrameStreak++;
          if (slowFrameStreak >= 4) {
            // Adaptive governor: step down to 15fps without network lines, never blank canvas
            degradedMode = true;
          }
        } else {
          slowFrameStreak = 0;
          if (degradedMode && elapsed < 12) degradedMode = false;
        }

        animId = requestAnimationFrame(render);
      };

      animId = requestAnimationFrame(render);

      return () => {
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVisibility);
        if (mo) mo.disconnect();
      };
    };

    let cleanupLayer2 = null;
    const rafId = requestAnimationFrame(() => {
      fallbackTimer = setTimeout(() => {
        cleanupLayer2 = initLayer2();
      }, 150);
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafId);
      if (idleHandle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (animId) cancelAnimationFrame(animId);
      if (observer) observer.disconnect();
      if (cleanupLayer2) cleanupLayer2();
    };
  }, []);

  return (
    <div className="living-bg-root" aria-hidden="true">
      {/* Layer 1: Always-on pre-blurred CSS radial gradient mesh (no filter: blur) */}
      <div className="living-mesh-layer">
        <div className="living-blob b1" />
        <div className="living-blob b2" />
        <div className="living-blob b3" />
        <div className="living-blob b4" />
      </div>

      {/* Layer 2: Lightweight 2D Canvas (particles, ribbons, section moods) */}
      <canvas ref={canvasRef} className="living-ambient-canvas" />
    </div>
  );
}
