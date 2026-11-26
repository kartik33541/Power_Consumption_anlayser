import { useState, useRef } from 'react';
import { Trees, Sliders } from 'lucide-react';
import { CONTENT } from '../data/content';
import { useMagnetic } from '../lib/motion';

function ScenarioButton({ sc, active, onClick }) {
  const btnRef = useRef(null);
  useMagnetic(btnRef, 0.2);

  return (
    <button
      ref={btnRef}
      type="button"
      className={`model-scenario-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {sc.label}
    </button>
  );
}

export default function ModelSection() {
  const [selectedScenario, setSelectedScenario] = useState(CONTENT.model.scenarios[1]); // AC+Fridge default
  const [threshold, setThreshold] = useState(0.50);

  // Check which appliances cross the threshold
  const isAcActive = selectedScenario.probs.ac >= threshold;
  const isFridgeActive = selectedScenario.probs.fridge >= threshold;
  const isFanActive = selectedScenario.probs.fan >= threshold;

  return (
    <section className="section-wrapper" aria-labelledby="model-heading">
      <div className="section-header">
        <span className="tag-badge illustrative">
          <Trees size={13} />
          {CONTENT.model.badge}
        </span>
        <h2 id="model-heading" className="section-title">
          {CONTENT.model.title}
        </h2>
        <p className="section-subtitle">
          {CONTENT.model.subtitle}
        </p>
      </div>

      {/* Scenario Picker Buttons */}
      <div className="model-scenarios-row full-width">
        {CONTENT.model.scenarios.map((sc) => (
          <ScenarioButton
            key={sc.id}
            sc={sc}
            active={selectedScenario.id === sc.id}
            onClick={() => setSelectedScenario(sc)}
          />
        ))}
      </div>

      {/* Interactive Threshold Control Bar */}
      <div className="threshold-slider-container full-width">
        <div className="threshold-label-row">
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={16} color="var(--accent-cyan)" />
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
              DECISION THRESHOLD (τ): <span style={{ color: 'var(--accent-cyan)' }}>{threshold.toFixed(2)}</span>
            </strong>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Default τ = 0.50 • Drag to test sensitivity
          </span>
        </div>

        <input
          type="range"
          min="0.10"
          max="0.90"
          step="0.05"
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="nilm-slider"
          aria-label="Model decision threshold slider"
        />
      </div>

      {/* Interactive Light-Up Appliance Cards Grid */}
      <div className="model-appliances-glow-grid full-width">
        {/* 1. AC Card */}
        <div className={`appliance-glow-card ${isAcActive ? 'glow-ac' : 'inactive'}`}>
          <div className="appliance-icon-halo">
            <span className="appliance-emoji">❄️</span>
          </div>
          <div className="appliance-card-info">
            <h3 className="appliance-card-title">Air Conditioner</h3>
            <span className="appliance-prob-badge">
              P = {selectedScenario.probs.ac.toFixed(2)}
            </span>
          </div>
          <div className={`appliance-state-pill ${isAcActive ? 'active-ac' : 'off'}`}>
            {isAcActive ? 'CLASSIFIED ON' : 'OFF'}
          </div>
        </div>

        {/* 2. Fridge Card */}
        <div className={`appliance-glow-card ${isFridgeActive ? 'glow-fridge' : 'inactive'}`}>
          <div className="appliance-icon-halo">
            <span className="appliance-emoji">🧊</span>
          </div>
          <div className="appliance-card-info">
            <h3 className="appliance-card-title">Refrigerator</h3>
            <span className="appliance-prob-badge">
              P = {selectedScenario.probs.fridge.toFixed(2)}
            </span>
          </div>
          <div className={`appliance-state-pill ${isFridgeActive ? 'active-fridge' : 'off'}`}>
            {isFridgeActive ? 'CLASSIFIED ON' : 'OFF'}
          </div>
        </div>

        {/* 3. Fan Card */}
        <div className={`appliance-glow-card ${isFanActive ? 'glow-fan' : 'inactive'}`}>
          <div className="appliance-icon-halo">
            <span className="appliance-emoji">💨</span>
          </div>
          <div className="appliance-card-info">
            <h3 className="appliance-card-title">Ceiling Fan</h3>
            <span className="appliance-prob-badge">
              P = {selectedScenario.probs.fan.toFixed(2)}
            </span>
          </div>
          <div className={`appliance-state-pill ${isFanActive ? 'active-fan' : 'off'}`}>
            {isFanActive ? 'CLASSIFIED ON' : 'OFF'}
          </div>
        </div>
      </div>

      {/* Probability Bars & Forest Explanation */}
      <div className="model-display-grid full-width">
        <div className="abstract-forest-box">
          <div className="forest-icon-bubble">
            <Trees size={36} color="var(--accent-cyan)" />
          </div>
          <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-xs)' }}>
            Random Forest Ensemble
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {CONTENT.model.abstractForestNote}
          </p>
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <span className="tag-badge illustrative">
              Binary Relevance Architecture
            </span>
          </div>
        </div>

        {/* Probability Bars with Dynamic Threshold Marker */}
        <div className="probability-bars-column">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              INDEPENDENT ACTIVATION PROBABILITIES
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
              Threshold marker at {(threshold * 100).toFixed(0)}%
            </span>
          </div>

          {[
            { id: "ac", name: "Air Conditioner (Inverter / Compressor)", p: selectedScenario.probs.ac, col: "var(--color-ac)" },
            { id: "fridge", name: "Refrigerator (Duty-Cycle Motor)", p: selectedScenario.probs.fridge, col: "var(--color-fridge)" },
            { id: "fan", name: "Ceiling Fan (Induction Motor)", p: selectedScenario.probs.fan, col: "var(--color-fan)" }
          ].map((bar) => {
            const isOver = bar.p >= threshold;
            return (
              <div key={bar.id} className="prob-bar-container">
                <div className="prob-bar-header">
                  <span className="prob-bar-title">{bar.name}</span>
                  <span className="prob-bar-value" style={{ color: isOver ? bar.col : 'var(--text-muted)' }}>
                    {bar.p.toFixed(2)} {isOver ? '✓' : ''}
                  </span>
                </div>

                <div className="prob-bar-track">
                  {/* Dynamic Threshold Marker Line */}
                  <div 
                    className="prob-threshold-marker" 
                    style={{ left: `${threshold * 100}%` }} 
                    title={`Threshold = ${threshold}`}
                  />

                  {/* Filled Probability Bar */}
                  <div 
                    className="prob-bar-fill"
                    style={{ 
                      width: `${bar.p * 100}%`,
                      backgroundColor: isOver ? bar.col : 'var(--border-strong)',
                      boxShadow: isOver ? `0 0 12px ${bar.col}` : 'none'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
