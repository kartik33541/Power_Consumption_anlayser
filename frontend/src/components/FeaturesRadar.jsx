export default function FeaturesRadar({ radarValues, prevRadarValues }) {
  const radarAxes = ["Size", "Peak", "Shape", "Power Factor", "Harmonics", "Spread"];
  const centerX = 120;
  const centerY = 120;
  const radius = 80;

  const getCoordinates = (values) => {
    return values.map((val, i) => {
      const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
      const r = val * radius;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const currPoints = getCoordinates(radarValues);
  const prevPoints = prevRadarValues ? getCoordinates(prevRadarValues) : null;

  return (
    <svg viewBox="0 0 240 240" className="radar-svg" aria-label="Radar chart displaying 6 physical feature axes">
      {[0.25, 0.5, 0.75, 1.0].map((ring) => (
        <circle
          key={ring}
          cx={centerX}
          cy={centerY}
          r={radius * ring}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="1"
          strokeDasharray={ring < 1.0 ? "2 2" : "none"}
        />
      ))}

      {radarAxes.map((axis, i) => {
        const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
        const x2 = centerX + radius * Math.cos(angle);
        const y2 = centerY + radius * Math.sin(angle);
        const labelX = centerX + (radius + 16) * Math.cos(angle);
        const labelY = centerY + (radius + 16) * Math.sin(angle);
        return (
          <g key={axis}>
            <line x1={centerX} y1={centerY} x2={x2} y2={y2} stroke="var(--border-subtle)" strokeWidth="1" />
            <text
              x={labelX}
              y={labelY + 3}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="8.5"
              fontFamily="var(--font-mono)"
            >
              {axis}
            </text>
          </g>
        );
      })}

      {prevPoints && (
        <polygon
          points={prevPoints}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          opacity="0.35"
        />
      )}

      <polygon
        points={currPoints}
        fill="var(--accent-cyan)"
        fillOpacity="0.25"
        stroke="var(--accent-cyan)"
        strokeWidth="2"
        style={{ transition: 'all 0.4s ease' }}
      />

      {radarValues.map((val, i) => {
        const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
        const cx = centerX + val * radius * Math.cos(angle);
        const cy = centerY + val * radius * Math.sin(angle);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r="3.5"
            fill="var(--accent-cyan)"
            stroke="var(--bg-secondary)"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}
