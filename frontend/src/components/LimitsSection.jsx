import { useRef } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { CONTENT } from '../data/content';
import { useTiltCard } from '../lib/motion';

function TiltLimitCard({ item }) {
  const cardRef = useRef(null);
  useTiltCard(cardRef, 5);

  return (
    <div ref={cardRef} className="limit-card">
      <h3 className="limit-card-title">
        <AlertTriangle size={16} />
        {item.title}
      </h3>
      <p className="limit-card-detail">
        {item.detail}
      </p>
    </div>
  );
}

export default function LimitsSection() {
  return (
    <section className="section-wrapper" aria-labelledby="limits-heading">
      <div className="section-header">
        <span className="tag-badge illustrative">
          <ShieldAlert size={13} />
          {CONTENT.limits.badge}
        </span>
        <h2 id="limits-heading" className="section-title">
          {CONTENT.limits.title}
        </h2>
        <p className="section-subtitle">
          {CONTENT.limits.subtitle}
        </p>
      </div>

      {/* 5 Boundary Cards with 3D Tilt */}
      <div className="limits-cards-grid">
        {CONTENT.limits.items.map((item) => (
          <TiltLimitCard key={item.title} item={item} />
        ))}
      </div>

      {/* Scientific Rigor Contract */}
      <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-md)' }}>
        Scientific Rigor: Avoid vs. Say Instead Wording Contract
      </h3>

      {/* Unified Responsive Scientific Rigor Representation */}
      <div className="wording-table-desktop">
        <div className="wording-table-wrapper">
          <table className="wording-table">
            <thead>
              <tr>
                <th style={{ width: '45%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                    <XCircle size={14} /> DO NOT CLAIM (AVOID)
                  </span>
                </th>
                <th style={{ width: '55%' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                    <CheckCircle size={14} /> ACCURATE FORMULATION (SAY INSTEAD)
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {CONTENT.limits.wordingTable.map((row, idx) => (
                <tr key={idx}>
                  <td className="avoid-text">
                    "{row.avoid}"
                  </td>
                  <td className="say-instead-text">
                    {row.sayInstead}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
