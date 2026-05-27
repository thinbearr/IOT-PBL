import React, { useState, useEffect } from 'react';

export default function ZoneMap({ zoneAScore }) {
  // Simulate minor fluctuations for Zone B and Zone C
  const [zoneBScore, setZoneBScore] = useState(38);
  const [zoneCScore, setZoneCScore] = useState(16);

  useEffect(() => {
    const interval = setInterval(() => {
      setZoneBScore(prev => {
        const delta = (Math.random() - 0.5) * 4;
        return Math.max(30, Math.min(50, prev + delta));
      });
      setZoneCScore(prev => {
        const delta = (Math.random() - 0.5) * 2;
        return Math.max(10, Math.min(25, prev + delta));
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const getZoneColor = (score) => {
    // Return soft background fill and stroke colors
    if (score < 30) {
      return { fill: 'rgba(16, 185, 129, 0.08)', stroke: 'var(--accent-success)', text: 'var(--accent-success)' };
    } else if (score < 70) {
      return { fill: 'rgba(245, 158, 11, 0.08)', stroke: 'var(--accent-warning)', text: 'var(--accent-warning)' };
    } else {
      return { fill: 'rgba(239, 68, 68, 0.08)', stroke: 'var(--accent-danger)', text: 'var(--accent-danger)' };
    }
  };

  const colorA = getZoneColor(zoneAScore);
  const colorB = getZoneColor(zoneBScore);
  const colorC = getZoneColor(zoneCScore);

  return (
    <div className="map-container">
      <svg className="floor-plan-svg" viewBox="0 0 320 200">
        {/* Main boundary */}
        <rect x="5" y="5" width="310" height="190" rx="6" fill="none" stroke="#e5e7eb" strokeWidth="2" strokeDasharray="4 4" />
        
        {/* Zone A: Live Sensor */}
        <g>
          <rect
            className="zone-rect"
            x="15"
            y="15"
            width="140"
            height="110"
            rx="6"
            fill={colorA.fill}
            stroke={colorA.stroke}
          />
          <text className="zone-label" x="25" y="40">Zone A</text>
          <text className="zone-sublabel" x="25" y="60">Live (Instrument)</text>
          <text x="25" y="85" fill={colorA.stroke} fontSize="14" fontWeight="bold" fontFamily="monospace">
            {Math.round(zoneAScore)} pts
          </text>
          <text x="25" y="105" fill="#9ca3af" fontSize="9">
            {zoneAScore < 30 ? 'Excellent Airflow' : zoneAScore < 70 ? 'Moderate Airflow' : 'Air Stagnant'}
          </text>
        </g>
        
        {/* Zone B: Simulated */}
        <g>
          <rect
            className="zone-rect"
            x="165"
            y="15"
            width="140"
            height="75"
            rx="6"
            fill={colorB.fill}
            stroke={colorB.stroke}
          />
          <text className="zone-label" x="175" y="35">Zone B</text>
          <text className="zone-sublabel" x="175" y="50">North Wing (Sim)</text>
          <text x="175" y="70" fill={colorB.stroke} fontSize="13" fontWeight="bold" fontFamily="monospace">
            {Math.round(zoneBScore)} pts
          </text>
        </g>
        
        {/* Zone C: Simulated */}
        <g>
          <rect
            className="zone-rect"
            x="165"
            y="100"
            width="140"
            height="85"
            rx="6"
            fill={colorC.fill}
            stroke={colorC.stroke}
          />
          <text className="zone-label" x="175" y="120">Zone C</text>
          <text className="zone-sublabel" x="175" y="135">South Lab (Sim)</text>
          <text x="175" y="158" fill={colorC.stroke} fontSize="13" fontWeight="bold" fontFamily="monospace">
            {Math.round(zoneCScore)} pts
          </text>
        </g>
        
        {/* Shared Hallway / Buffer zone */}
        <g>
          <rect
            className="zone-rect"
            x="15"
            y="135"
            width="140"
            height="50"
            rx="6"
            fill="rgba(243, 244, 246, 0.5)"
            stroke="#d1d5db"
          />
          <text className="zone-label" x="25" y="155">Corridor</text>
          <text className="zone-sublabel" x="25" y="170">Reference Zone</text>
        </g>
      </svg>
    </div>
  );
}
