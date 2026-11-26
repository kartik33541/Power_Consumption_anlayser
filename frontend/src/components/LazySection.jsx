import { useState, useEffect, useRef } from 'react';

/**
 * LazySection
 * Reserves exact responsive height per section to prevent scroll jumps,
 * mounts 1.5 viewport heights ahead of scroll, and refreshes ScrollTrigger on mount.
 */
export default function LazySection({
  children,
  sectionKey = '',
  targetId = '',
  minHeight = '600px',
  eagerOnDesktop = false
}) {
  const [shouldRender, setShouldRender] = useState(() => {
    if (eagerOnDesktop && typeof window !== 'undefined' && window.innerWidth >= 768) {
      return true;
    }
    return false;
  });
  const containerRef = useRef(null);

  useEffect(() => {
    if (shouldRender) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: '150% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldRender]);

  // Refresh ScrollTrigger after lazy-mounted section renders into the DOM
  useEffect(() => {
    if (!shouldRender) return;
    let isCancelled = false;
    const rafId = requestAnimationFrame(() => {
      import('gsap/ScrollTrigger')
        .then(({ ScrollTrigger }) => {
          if (!isCancelled) ScrollTrigger.refresh();
        })
        .catch(() => {});
    });
    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [shouldRender]);

  return (
    <div
      ref={containerRef}
      data-section-target={targetId || undefined}
      className={sectionKey ? `lazy-section-shell lazy-${sectionKey}` : 'lazy-section-shell'}
      style={!sectionKey ? { minHeight: shouldRender ? 'auto' : minHeight } : undefined}
    >
      {shouldRender ? children : null}
    </div>
  );
}
