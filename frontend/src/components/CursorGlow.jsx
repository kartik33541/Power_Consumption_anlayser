import { useEffect, useRef } from 'react';

export default function CursorGlow() {
  const glowRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const el = glowRef.current;
    if (!el) return;

    let rafId = null;
    let targetX = -500;
    let targetY = -500;

    const render = () => {
      if (el) {
        el.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      rafId = null;
    };

    const handlePointerMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (el.style.opacity !== '0.65') {
        el.style.opacity = '0.65';
      }
      if (!rafId) {
        rafId = requestAnimationFrame(render);
      }
    };

    const handleMouseLeave = () => {
      if (el) el.style.opacity = '0';
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div 
      ref={glowRef}
      className="cursor-glow"
      style={{
        transform: 'translate3d(-500px, -500px, 0)',
        opacity: 0,
        willChange: 'transform, opacity'
      }}
      aria-hidden="true"
    />
  );
}
