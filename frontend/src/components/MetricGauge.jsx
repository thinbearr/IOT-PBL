import React from 'react';

export default function MetricGauge({ score }) {
  // Gauge configuration
  const radius = 45;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Determine color based on score
  let strokeColor = 'var(--accent-success)';
  if (score >= 30 && score < 70) {
    strokeColor = 'var(--accent-warning)';
  } else if (score >= 70) {
    strokeColor = 'var(--accent-danger)';
  }

  return (
    <div className="gauge-container">
      <svg className="gauge-svg" width="120" height="120" viewBox="0 0 100 100">
        {/* Background track */}
        <circle
          className="gauge-bg"
          cx="50"
          cy="50"
          r={radius}
          strokeWidth={strokeWidth}
        />
        {/* Dynamic color fill track */}
        <circle
          className="gauge-fill"
          cx="50"
          cy="50"
          r={radius}
          strokeWidth={strokeWidth}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="gauge-text-overlay">
        <span className="gauge-score">{Math.round(score)}</span>
        <span className="gauge-label">Score</span>
      </div>
    </div>
  );
}
