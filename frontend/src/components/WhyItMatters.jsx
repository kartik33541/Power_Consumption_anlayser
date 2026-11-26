import { useRef } from 'react';
import { HelpCircle } from 'lucide-react';
import { CONTENT } from '../data/content';
import { useTiltCard } from '../lib/motion';

function VisualSceneCard({ card, imageSrc }) {
  const cardRef = useRef(null);
  useTiltCard(cardRef, 6);

  return (
    <article ref={cardRef} className="why-card visual-scene-card">
      <div className="why-card-image-box">
        <img
          src={imageSrc}
          alt={card.imageAlt}
          className="why-card-image"
          loading="lazy"
        />
        <div className="scene-status-chip">
          {card.context}
        </div>
      </div>

      <div className="why-card-body">
        <div className="why-card-stat-row">
          <div className="why-card-stat">{card.stat}</div>
          <div className="why-card-stat-sub">{card.statSub}</div>
        </div>

        <h3 className="why-card-title">{card.title}</h3>
        <p className="why-card-caption">{card.description}</p>
      </div>
    </article>
  );
}

export default function WhyItMatters() {
  const images = [
    '/media/bill-inspection.webp',
    '/media/empty-room-ac.webp',
    '/media/mains-panel.webp'
  ];

  return (
    <section className="section-wrapper" aria-labelledby="why-it-matters-heading">
      <div className="section-header">
        <span className="tag-badge illustrative">
          <HelpCircle size={13} />
          {CONTENT.whyItMatters.badge}
        </span>
        <h2 id="why-it-matters-heading" className="section-title">
          {CONTENT.whyItMatters.title}
        </h2>
        <p className="section-subtitle">
          {CONTENT.whyItMatters.subtitle}
        </p>
      </div>

      {/* 3 Full-Width Illustrated Scene Cards */}
      <div className="why-cards-grid full-width">
        {CONTENT.whyItMatters.cards.map((card, idx) => (
          <VisualSceneCard
            key={card.id}
            card={card}
            imageSrc={images[idx]}
          />
        ))}
      </div>
    </section>
  );
}
