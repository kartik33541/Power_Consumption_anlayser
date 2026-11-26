import { GitBranch, CheckCircle2, Clock, Lock } from 'lucide-react';
import { CONTENT } from '../data/content';
import { PHASES_DATA } from '../data/phases';

export default function ProgressTracker() {
  return (
    <section className="section-wrapper" aria-labelledby="tracker-heading">
      <div className="section-header">
        <span className="tag-badge illustrative">
          <GitBranch size={13} />
          {CONTENT.tracker.badge}
        </span>
        <h2 id="tracker-heading" className="section-title">
          {CONTENT.tracker.title}
        </h2>
        <p className="section-subtitle">
          {CONTENT.tracker.subtitle}
        </p>
      </div>

      {/* Desktop 18-Phase Visual Roadmap Matrix (Full Width 3-Column Grid) */}
      <div className="phases-desktop-grid full-width">
        {PHASES_DATA.map((item) => {
          const isPassed = item.status === 'passed';
          const isCurrent = item.status === 'current';
          const isLocked = item.status === 'locked';

          return (
            <article 
              key={item.phase} 
              className={`phase-matrix-card ${isCurrent ? 'current-active' : ''} ${isPassed ? 'passed' : ''}`}
            >
              <div className="phase-card-top-row">
                <span className="phase-card-num-badge">
                  PHASE {String(item.phase).padStart(2, '0')}
                </span>

                {isPassed && (
                  <span className="phase-chip passed">
                    <svg className="phase-ring" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
                      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="44" strokeDashoffset="0" />
                    </svg>
                    <CheckCircle2 size={12} /> PASSED
                  </span>
                )}
                {isCurrent && (
                  <span className="phase-chip current">
                    <svg className="phase-ring" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
                      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="44" strokeDashoffset="20" />
                    </svg>
                    <Clock size={12} /> IN PROGRESS
                  </span>
                )}
                {isLocked && (
                  <span className="phase-chip locked">
                    <svg className="phase-ring" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
                    </svg>
                    <Lock size={12} /> LOCKED
                  </span>
                )}
              </div>

              <h3 className="phase-card-title">
                {item.title}
              </h3>

              <p className="phase-card-summary">
                {item.summary}
              </p>

              <div className="phase-card-gate">
                <span className="gate-label">GATE:</span>
                <span className="gate-text">{item.passGate}</span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Mobile Vertical Flow (< 768px) */}
      <div className="phases-mobile-timeline">
        <div className="timeline-vertical-track">
          <div className="timeline-line-stem" />

          {PHASES_DATA.map((item) => {
            const isPassed = item.status === 'passed';
            const isCurrent = item.status === 'current';
            const isLocked = item.status === 'locked';

            return (
              <div key={item.phase} className="timeline-phase-node">
                <div className={`timeline-phase-marker ${item.status}`} />
                <div className={`timeline-phase-card ${isCurrent ? 'current-active' : ''}`}>
                  <div className="timeline-phase-header">
                    <span className="phase-card-num-badge">
                      PHASE {String(item.phase).padStart(2, '0')}
                    </span>
                    {isPassed && <span className="phase-chip passed"><CheckCircle2 size={12} /> PASSED</span>}
                    {isCurrent && <span className="phase-chip current"><Clock size={12} /> CURRENT</span>}
                    {isLocked && <span className="phase-chip locked"><Lock size={12} /> LOCKED</span>}
                  </div>
                  <h3 className="timeline-phase-title">{item.title}</h3>
                  <p className="phase-card-summary">{item.summary}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tracker-footer-note">
        * {CONTENT.tracker.note}
      </div>
    </section>
  );
}
