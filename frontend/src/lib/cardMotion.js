import { useEffect } from 'react';

const CARD_SELECTOR = [
  '.why-card',
  '.vmd-mode-card',
  '.domain-visual-console',
  '.model-card',
  '.limit-card',
  '.phase-matrix-card',
  '.timeline-phase-card',
  '.boundary-card',
  '.wording-table-card',
  '.vmd-console-card',
  '.superposition-card'
].join(', ');

const OBSERVE_SELECTOR = `${CARD_SELECTOR}, .section-title, .section-wrapper`;

/**
 * Shared, low-overhead card & grid motion controller.
 * - One rAF-throttled pointermove listener (fine pointers only) setting --ptr-x / --ptr-y.
 * - One IntersectionObserver for staggered card entrances, heading accent lines, bar fills, and count-ups.
 * - Zero per-frame JS per card; transform & opacity only.
 */
export function useCardMotion() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Shared IntersectionObserver for one-shot entrance & count-up
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add('in-view');

          // Count-up numbers inside newly activated cards (if any [data-count])
          const counters = el.querySelectorAll('[data-count]');
          counters.forEach((node) => {
            if (node.dataset.counted) return;
            node.dataset.counted = '1';
            const target = parseFloat(node.dataset.count);
            const suffix = node.dataset.suffix || '';
            const decimals = (node.dataset.count.split('.')[1] || '').length;
            if (reduced || Number.isNaN(target)) {
              node.textContent = target.toFixed(decimals) + suffix;
              return;
            }
            const start = performance.now();
            const dur = 650;
            const step = (now) => {
              const p = Math.min(1, (now - start) / dur);
              const eased = 1 - Math.pow(1 - p, 3);
              node.textContent = (target * eased).toFixed(decimals) + suffix;
              if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          });

          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const registerElements = (root = document) => {
      const targets = root.querySelectorAll(OBSERVE_SELECTOR);
      targets.forEach((el, idx) => {
        if (el.dataset.motionBound) return;
        el.dataset.motionBound = '1';
        if (reduced) {
          el.classList.add('in-view');
          return;
        }
        // Assign stagger index within parent grid
        if (el.matches(CARD_SELECTOR)) {
          const parent = el.parentElement;
          const siblings = parent ? [...parent.children].filter((c) => c.matches(CARD_SELECTOR)) : [];
          const colIdx = Math.max(0, siblings.indexOf(el));
          el.style.setProperty('--stagger-delay', `${Math.min(colIdx, 8) * 55}ms`);
          el.style.setProperty('--stagger-rot', colIdx % 2 === 0 ? '-0.65deg' : '0.65deg');
        }
        io.observe(el);
      });
    };

    registerElements();

    // Watch for LazySection mounts
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            registerElements(node);
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // 2. Shared rAF-throttled pointer spotlight (fine pointers only)
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    let rafPending = false;
    let lastEvent = null;
    let activeCard = null;

    const updatePointer = () => {
      rafPending = false;
      if (!lastEvent) return;
      const card = lastEvent.target?.closest?.(CARD_SELECTOR);
      if (activeCard && activeCard !== card) {
        activeCard.classList.remove('ptr-active');
      }
      if (card) {
        const rect = card.getBoundingClientRect();
        const x = lastEvent.clientX - rect.left;
        const y = lastEvent.clientY - rect.top;
        card.style.setProperty('--ptr-x', `${x}px`);
        card.style.setProperty('--ptr-y', `${y}px`);
        card.classList.add('ptr-active');
        activeCard = card;
      } else {
        activeCard = null;
      }
    };

    const onPointerMove = (e) => {
      lastEvent = e;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(updatePointer);
      }
    };

    if (isFinePointer && !reduced) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }

    return () => {
      io.disconnect();
      mo.disconnect();
      if (isFinePointer) {
        window.removeEventListener('pointermove', onPointerMove);
      }
    };
  }, []);
}
