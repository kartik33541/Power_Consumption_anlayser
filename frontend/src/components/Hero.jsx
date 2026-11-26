import { useRef, useState, useEffect } from 'react';
import { CONTENT } from '../data/content';
import { HERO_POSTER_URL } from '../data/heroMedia';
import HeroPanel from './HeroPanel';

const isReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Hero() {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [loadVideo, setLoadVideo] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [panelReady, setPanelReady] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < 768 || isReducedMotion();
  });

  // Gate video: never load on <768px, Save-Data, or prefers-reduced-motion.
  // On desktop, mount video strictly after first paint.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 768 || (navigator.connection && navigator.connection.saveData) || isReducedMotion()) {
      setPanelReady(true);
      return;
    }

    let loadTimer;
    let fallbackPanelTimer;
    const rafId = requestAnimationFrame(() => {
      loadTimer = setTimeout(() => {
        setLoadVideo(true);
      }, 400);
      // Fallback ensures panel always enters even if video buffers slowly
      fallbackPanelTimer = setTimeout(() => {
        setPanelReady(true);
      }, 1400);
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (loadTimer) clearTimeout(loadTimer);
      if (fallbackPanelTimer) clearTimeout(fallbackPanelTimer);
    };
  }, []);

  // Pause hero video when hero section scrolls out of view; ensure muted autoplay on desktop
  useEffect(() => {
    if (!loadVideo || !containerRef.current || !videoRef.current) return;
    const videoEl = videoRef.current;
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.play().catch(() => {});

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          } else {
            videoEl.pause();
          }
        });
      },
      { threshold: 0.05 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loadVideo]);

  const handleVideoReady = () => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
    setVideoVisible(true);
    setPanelReady(true);
  };

  const headlineWords = CONTENT.hero.headline.split(' ');

  return (
    <section
      ref={containerRef}
      className="hero-section"
      id="overview"
    >
      {/* Static Full-Bleed Media Box (No transform/width animation ever) */}
      <div className="hero-media-layer-wrapper" aria-hidden="true">
        <img
          src={HERO_POSTER_URL}
          alt=""
          className={`hero-poster-img ${videoVisible ? 'is-hidden' : ''}`}
          fetchpriority="high"
          loading="eager"
          decoding="async"
        />
        {loadVideo && (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onCanPlay={handleVideoReady}
            onPlaying={handleVideoReady}
            className={`hero-media-video ${videoVisible ? 'is-ready' : ''}`}
            aria-hidden="true"
          >
            <source src="/media/hero-bg.mp4" type="video/mp4" />
          </video>
        )}
        <div className="hero-media-overlay" />
        <div className="hero-media-bottom-fade" />
      </div>

      <div className="hero-content">
        <div className="hero-tagline">
          {CONTENT.hero.tagline}
        </div>

        <h1 className="hero-headline">
          {headlineWords.map((word, idx) => (
            <span key={idx} className="hero-word" style={{ marginRight: '0.28em' }}>
              {word}
            </span>
          ))}
        </h1>

        <p className="hero-subheadline">
          {CONTENT.hero.subheadline}
        </p>

        {/* Interactive Reference Hero Panel */}
        <HeroPanel videoReady={panelReady} />
      </div>
    </section>
  );
}
