import { useRef, useState, lazy, Suspense } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { GitCommit, AlertOctagon, CheckCircle2, ArrowRight } from 'lucide-react';
import { CONTENT } from '../data/content';
import { isReducedMotion } from '../lib/motion';

const PipelineDiagram = lazy(() => import('./PipelineDiagrams'));

gsap.registerPlugin(ScrollTrigger);

export default function Pipeline() {
  const containerRef = useRef(null);
  const pinRef = useRef(null);
  const [activeStage, setActiveStage] = useState(0);

  // Desktop vertical scroll-driven story with smooth pinning
  useGSAP(() => {
    if (isReducedMotion()) return;

    const mm = gsap.matchMedia();

    // Desktop & Tablet (>= 768px): Single pinned stage advancing 12 steps on vertical scroll
    mm.add("(min-width: 768px)", () => {
      const container = containerRef.current;
      const pinStage = pinRef.current;
      if (!container || !pinStage) return;

      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: "bottom bottom",
        pin: pinStage,
        pinSpacing: false, // Prevents layout jumps
        anticipatePin: 1,
        scrub: 0.8, // Smooth scrub matching native Lenis
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const totalStages = CONTENT.pipeline.cards.length;
          // Calculate step index (0 to 11) smoothly based on vertical scroll depth
          const nextIndex = Math.min(Math.floor(self.progress * totalStages), totalStages - 1);
          setActiveStage(nextIndex);
        }
      });
    });

    // Mobile (< 768px): Clean unpinned vertical stack
    mm.add("(max-width: 767px)", () => {
      // Natural vertical scroll flow; no pinning
    });

    return () => mm.revert();
  }, { scope: containerRef });

  const currentCard = CONTENT.pipeline.cards[activeStage] || CONTENT.pipeline.cards[0];
  const stages = CONTENT.pipeline.cards;

  // Jump to specific stage on progress rail dot click
  const scrollToStage = (index) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const startY = rect.top + scrollTop;
    const totalHeight = containerRef.current.offsetHeight - window.innerHeight;
    const targetY = startY + (index / (stages.length - 1)) * totalHeight;

    window.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });
  };

  return (
    <section 
      ref={containerRef} 
      className="pipeline-scroll-container" 
      aria-labelledby="pipeline-heading"
    >
      {/* Desktop Pinned Full-Viewport Stage */}
      <div ref={pinRef} className="pipeline-pinned-stage">
        <div className="pipeline-header-mini">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="tag-badge illustrative">
              <GitCommit size={13} />
              {CONTENT.pipeline.badge}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              STAGE {currentCard.step} OF 12
            </span>
          </div>

          <h2 id="pipeline-heading" className="pipeline-title-mini">
            {CONTENT.pipeline.title}
          </h2>
        </div>

        {/* Desktop 3-Column Layout: Diagram (55%) | Active Narrative Card (40%) | Progress Rail */}
        <div className="pipeline-stage-layout">
          {/* 1. Large Animated Diagram Viewport */}
          <div className="pipeline-diagram-frame">
            <div className="diagram-step-badge">
              <span>{currentCard.step}</span>
              <span>{currentCard.name}</span>
            </div>
            
            <Suspense fallback={<div className="pipeline-svg-wrapper" style={{ minHeight: '280px' }} />}>
              <PipelineDiagram stageIndex={activeStage} />
            </Suspense>
          </div>

          {/* 2. Active Stage Narrative Card (Crossfades per step) */}
          <div className="pipeline-narrative-frame" key={currentCard.step}>
            <div className="narrative-step-pill">
              STAGE {currentCard.step} • {currentCard.name}
            </div>

            <div className="narrative-io-box">
              <div className="narrative-io-row">
                <span className="narrative-label">INPUT</span>
                <span className="narrative-val">{currentCard.input}</span>
              </div>
              <div className="narrative-arrow">
                <ArrowRight size={14} color="var(--accent-cyan)" />
              </div>
              <div className="narrative-io-row">
                <span className="narrative-label">OUTPUT</span>
                <span className="narrative-val code">{currentCard.output}</span>
              </div>
            </div>

            <div className="narrative-problem-box">
              <span className="narrative-label">PHYSICAL CHALLENGE</span>
              <p>{currentCard.problem}</p>
            </div>

            <div className="narrative-solves-box">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span className="narrative-label green">WHAT THIS STAGE SOLVES</span>
                  <p>{currentCard.solves}</p>
                </div>
              </div>
            </div>

            <div className="narrative-not-solves-box">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <AlertOctagon size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span className="narrative-label red">WHAT IT DOES NOT SOLVE</span>
                  <p>{currentCard.doesNotSolve}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Vertical Progress Rail */}
          <nav className="pipeline-progress-rail" aria-label="Pipeline stages navigation">
            <div className="progress-rail-track" />
            {stages.map((st, idx) => {
              const isActive = idx === activeStage;
              const isPassed = idx < activeStage;
              return (
                <button
                  key={st.step}
                  type="button"
                  onClick={() => scrollToStage(idx)}
                  className={`rail-dot-btn ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`}
                  title={`Jump to Stage ${st.step}: ${st.name}`}
                  aria-label={`Jump to Stage ${st.step}: ${st.name}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="rail-dot-inner" />
                  <span className="rail-dot-tooltip">{st.step}. {st.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Stacked Flow (< 768px): All 12 Stages Stacked Vertically with Diagram & Text */}
      <div className="pipeline-mobile-stack">
        <div className="section-header" style={{ padding: '0 var(--space-md)' }}>
          <span className="tag-badge illustrative">
            <GitCommit size={13} />
            {CONTENT.pipeline.badge}
          </span>
          <h2 className="section-title">
            {CONTENT.pipeline.title}
          </h2>
          <p className="section-subtitle">
            {CONTENT.pipeline.subtitle}
          </p>
        </div>

        {stages.map((st, idx) => (
          <article key={st.step} className="pipeline-mobile-card">
            <div className="mobile-card-header">
              <span className="mobile-step-num">{st.step}</span>
              <h3 className="mobile-step-title">{st.name}</h3>
            </div>

            {/* Stage Diagram */}
            <div className="pipeline-diagram-frame mobile">
              <Suspense fallback={<div className="pipeline-svg-wrapper" style={{ minHeight: '220px' }} />}>
                <PipelineDiagram stageIndex={idx} />
              </Suspense>
            </div>

            {/* Stage Content */}
            <div className="narrative-io-box">
              <div className="narrative-io-row">
                <span className="narrative-label">INPUT</span>
                <span className="narrative-val">{st.input}</span>
              </div>
              <div className="narrative-io-row">
                <span className="narrative-label">OUTPUT</span>
                <span className="narrative-val code">{st.output}</span>
              </div>
            </div>

            <div className="narrative-problem-box">
              <span className="narrative-label">PHYSICAL CHALLENGE</span>
              <p>{st.problem}</p>
            </div>

            <div className="narrative-solves-box">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span className="narrative-label green">WHAT THIS STAGE SOLVES</span>
                  <p>{st.solves}</p>
                </div>
              </div>
            </div>

            <div className="narrative-not-solves-box">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <AlertOctagon size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span className="narrative-label red">WHAT IT DOES NOT SOLVE</span>
                  <p>{st.doesNotSolve}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
