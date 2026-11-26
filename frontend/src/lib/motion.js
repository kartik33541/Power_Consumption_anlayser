import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * NILM Signal Lab — Unified Motion Design System
 * Ensures all timings, easings, and scroll behaviors follow a singular physical contract.
 */
export const MOTION_TOKENS = {
  duration: {
    instant: 0.15,
    fast: 0.25,
    normal: 0.45,
    slow: 0.8,
    deliberate: 1.2
  },
  ease: {
    expoOut: "power4.out",
    backOut: "back.out(1.5)",
    smooth: "power2.out",
    cinematic: "cubic-bezier(0.16, 1, 0.3, 1)",
    bounce: "elastic.out(1, 0.4)"
  },
  stagger: {
    words: 0.05,
    cards: 0.12,
    features: 0.04
  }
};

/**
 * Checks if user requested reduced motion
 */
export function isReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Shared Canvas Manager
 * Replaces uncoordinated window.requestAnimationFrame loops with ONE unified gsap.ticker.
 * Automatically gates each canvas via IntersectionObserver so offscreen canvases do ZERO work.
 */
class CanvasTickerRegistry {
  constructor() {
    this.renderers = new Map();
    this.intersectionObserver = null;
    this.resizeObserver = null;
    this.tickerActive = false;
    this.tickHandler = this.onTick.bind(this);
  }

  initObservers() {
    if (typeof window === 'undefined') return;

    if (!this.intersectionObserver) {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const id = entry.target.dataset.nilmCanvasId;
          const record = this.renderers.get(id);
          if (record) {
            record.isVisible = entry.isIntersecting;
          }
        });
      }, {
        rootMargin: '120px 0px 120px 0px',
        threshold: 0.01
      });
    }

    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const id = entry.target.dataset.nilmCanvasId;
          const record = this.renderers.get(id);
          if (record && entry.contentRect) {
            const w = Math.floor(entry.contentRect.width);
            const h = Math.floor(entry.contentRect.height);
            if (w > 0 && h > 0) {
              record.width = w;
              record.height = h;
              record.needsResize = true;
            }
          }
        });
      });
    }
  }

  register(id, canvasEl, renderFn) {
    if (!canvasEl) return;
    this.initObservers();

    canvasEl.dataset.nilmCanvasId = id;
    const initialWidth = canvasEl.clientWidth || 300;
    const initialHeight = canvasEl.clientHeight || 150;

    const record = {
      canvas: canvasEl,
      renderFn,
      isVisible: false, // Initially false until IntersectionObserver verifies onscreen
      width: initialWidth,
      height: initialHeight,
      needsResize: true,
      time: 0
    };

    this.renderers.set(id, record);
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(canvasEl);
    }
    if (this.resizeObserver) {
      this.resizeObserver.observe(canvasEl);
    }

    if (!this.tickerActive && this.renderers.size > 0) {
      gsap.ticker.add(this.tickHandler);
      this.tickerActive = true;
    }
  }

  unregister(id) {
    const record = this.renderers.get(id);
    if (record && record.canvas) {
      if (this.intersectionObserver) this.intersectionObserver.unobserve(record.canvas);
      if (this.resizeObserver) this.resizeObserver.unobserve(record.canvas);
    }
    this.renderers.delete(id);

    if (this.renderers.size === 0 && this.tickerActive) {
      gsap.ticker.remove(this.tickHandler);
      this.tickerActive = false;
    }
  }

  onTick(time, deltaTime) {
    const dtSeconds = Math.min(deltaTime / 1000, 0.1);

    this.renderers.forEach((record) => {
      if (!record.isVisible) return; // Skip offscreen canvas entirely

      record.time += dtSeconds;
      const canvas = record.canvas;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = record.width;
      const displayHeight = record.height;

      if (record.needsResize || canvas.width !== Math.floor(displayWidth * dpr) || canvas.height !== Math.floor(displayHeight * dpr)) {
        canvas.width = Math.floor(displayWidth * dpr);
        canvas.height = Math.floor(displayHeight * dpr);
        record.needsResize = false;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      try {
        record.renderFn(ctx, displayWidth, displayHeight, record.time, dpr);
      } catch (e) {
        console.error(`Canvas renderer error on ${canvas.dataset.nilmCanvasId}:`, e);
      }

      ctx.restore();
    });
  }
}

export const sharedCanvasTicker = new CanvasTickerRegistry();

/**
 * Cached Theme Color Tokens
 * Prevents calling expensive getComputedStyle inside 60fps canvas tick loops.
 */
let cachedThemeColors = null;
let currentTheme = null;

export function getThemeColors() {
  if (typeof window === 'undefined') return {};
  const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';

  if (!cachedThemeColors || currentTheme !== activeTheme) {
    currentTheme = activeTheme;
    const s = getComputedStyle(document.documentElement);
    cachedThemeColors = {
      oscilloscopeGrid: s.getPropertyValue('--oscilloscope-grid').trim() || (activeTheme === 'dark' ? 'rgba(0, 229, 255, 0.08)' : 'rgba(2, 132, 199, 0.12)'),
      mainsColor: s.getPropertyValue('--color-mains').trim() || (activeTheme === 'dark' ? '#f1f5f9' : '#0f172a'),
      acColor: s.getPropertyValue('--color-ac').trim() || (activeTheme === 'dark' ? '#00e5ff' : '#0284c7'),
      fridgeColor: s.getPropertyValue('--color-fridge').trim() || (activeTheme === 'dark' ? '#ffb703' : '#d97706'),
      fanColor: s.getPropertyValue('--color-fan').trim() || (activeTheme === 'dark' ? '#ff4d8d' : '#db2777'),
      imf1: s.getPropertyValue('--color-imf1').trim() || (activeTheme === 'dark' ? '#00e5ff' : '#0284c7'),
      imf2: s.getPropertyValue('--color-imf2').trim() || (activeTheme === 'dark' ? '#ffb703' : '#d97706'),
      imf3: s.getPropertyValue('--color-imf3').trim() || (activeTheme === 'dark' ? '#ff4d8d' : '#db2777'),
      textPrimary: s.getPropertyValue('--text-primary').trim() || (activeTheme === 'dark' ? '#f8fafc' : '#0f172a'),
      textSecondary: s.getPropertyValue('--text-secondary').trim() || (activeTheme === 'dark' ? '#94a3b8' : '#475569'),
      textMuted: s.getPropertyValue('--text-muted').trim() || (activeTheme === 'dark' ? '#64748b' : '#64748b'),
      bgInput: s.getPropertyValue('--bg-input').trim() || (activeTheme === 'dark' ? '#0a101d' : '#f1f5f9')
    };
  }
  return cachedThemeColors;
}

/**
 * Hook to attach a canvas to the shared ticker with IntersectionObserver gating
 */
export function useSharedCanvas(canvasRef, renderFn, deps = []) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const id = `canvas_${Math.random().toString(36).substring(2, 9)}`;
    sharedCanvasTicker.register(id, canvas, renderFn);

    return () => {
      sharedCanvasTicker.unregister(id);
    };
  }, deps);
}

/**
 * Magnetic Element Hook (pulls element subtly toward pointer)
 * Strictly restricted to devices with fine pointing device (mouse) to prevent mobile touch anomalies.
 */
export function useMagnetic(ref, strength = 0.28) {
  useEffect(() => {
    if (isReducedMotion()) return;
    if (typeof window === 'undefined') return;
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!hasFinePointer) return;

    const el = ref.current;
    if (!el) return;

    const onPointerMove = (e) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) * strength;
      const dy = (e.clientY - centerY) * strength;

      gsap.to(el, {
        x: dx,
        y: dy,
        duration: 0.25,
        ease: 'power3.out'
      });
    };

    const onPointerLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'power3.out'
      });
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);

    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      gsap.killTweensOf(el);
    };
  }, [strength]);
}

/**
 * 3D Tilt Card Hook
 * Strictly restricted to desktop screens with fine pointer.
 */
export function useTiltCard(ref, maxTilt = 8) {
  useEffect(() => {
    if (isReducedMotion() || window.innerWidth < 768) return;
    if (typeof window === 'undefined') return;
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!hasFinePointer) return;

    const el = ref.current;
    if (!el) return;

    const onPointerMove = (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;

      gsap.to(el, {
        rotateX: -py * maxTilt,
        rotateY: px * maxTilt,
        transformPerspective: 1000,
        duration: 0.3,
        ease: 'power3.out'
      });
    };

    const onPointerLeave = () => {
      gsap.to(el, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.45,
        ease: 'power3.out'
      });
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);

    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
      gsap.killTweensOf(el);
    };
  }, [maxTilt]);
}
