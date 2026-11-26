import { useEffect } from 'react';

/**
 * High-performance Lenis integration
 * Dynamically imported so Lenis & GSAP stay out of first-load critical JS.
 */
export function useLenis() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let isCancelled = false;
    let lenis = null;
    let gsapRef = null;
    let updateTicker = null;

    Promise.all([
      import('lenis'),
      import('gsap'),
      import('gsap/ScrollTrigger')
    ]).then(([{ default: Lenis }, { default: gsap }, { ScrollTrigger }]) => {
      if (isCancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      gsapRef = gsap;

      lenis = new Lenis({
        lerp: 0.075,
        duration: 1.2,
        easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.0,
        infinite: false,
        autoResize: true
      });

      window.lenis = lenis;

      lenis.on('scroll', () => {
        ScrollTrigger.update();
      });

      updateTicker = (time) => {
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(updateTicker);
      gsap.ticker.lagSmoothing(0);

      const triggerRefresh = () => {
        ScrollTrigger.refresh();
      };

      if (document.readyState === 'complete') {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(triggerRefresh);
        } else {
          setTimeout(triggerRefresh, 200);
        }
      } else {
        window.addEventListener('load', () => {
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(triggerRefresh);
          } else {
            setTimeout(triggerRefresh, 200);
          }
        }, { once: true });
      }
    });

    return () => {
      isCancelled = true;
      if (gsapRef && updateTicker) {
        gsapRef.ticker.remove(updateTicker);
      }
      if (lenis) {
        lenis.destroy();
      }
    };
  }, []);
}
