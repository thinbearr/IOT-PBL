import React from 'react';

export default function ChartComponent({ data, activeMode }) {
  // SVG Dimensions
  const width = 800;
  const height = 320;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  if (!data || data.length === 0) {
    return (
      <div className="graph-wrapper" style={{ display: 'flex', alignItems: 'center', justify: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Waiting for data stream...</p>
      </div>
    );
  }

  // Find min/max values for scaling
  const allGasValues = data.map(d => d.comp_gas).concat(data.map(d => d.baseline));
  
  // Also include decay fit curve points if available to ensure they fit on screen
  let fitPoints = [];
  const latestData = data[data.length - 1];
  if (latestData && latestData.decay_fit_curve) {
    fitPoints = latestData.decay_fit_curve;
    allGasValues.push(...fitPoints.map(p => p.value));
  }

  let minGas = Math.min(...allGasValues);
  let maxGas = Math.max(...allGasValues);
  
  // Padding for min/max
  const gasRange = maxGas - minGas;
  minGas = Math.max(0, minGas - (gasRange * 0.1 || 10));
  maxGas = maxGas + (gasRange * 0.15 || 50);

  // X scaling (based on timestamps)
  const startTime = data[0].timestamp;
  const endTime = data[data.length - 1].timestamp;
  const timeRange = endTime - startTime || 1.0;

  const getX = (ts) => {
    return paddingLeft + ((ts - startTime) / timeRange) * chartWidth;
  };

  const getY = (val) => {
    return paddingTop + chartHeight - ((val - minGas) / (maxGas - minGas)) * chartHeight;
  };

  // Build VOC Line path
  const vocPoints = data.map(d => `${getX(d.timestamp)},${getY(d.comp_gas)}`).join(' ');
  
  // Build Baseline Line path
  const baselinePoints = data.map(d => `${getX(d.timestamp)},${getY(d.baseline)}`).join(' ');

  // Identify decay region for background highlighting
  // Find continuous spans of DECAYING state
  const decayRegions = [];
  let currentRegion = null;

  for (let i = 0; i < data.length; i++) {
    if (data[i].state === 'DECAYING') {
      if (!currentRegion) {
        currentRegion = { start: data[i].timestamp, end: data[i].timestamp };
      } else {
        currentRegion.end = data[i].timestamp;
      }
    } else {
      if (currentRegion) {
        decayRegions.push(currentRegion);
        currentRegion = null;
      }
    }
  }
  if (currentRegion) {
    decayRegions.push(currentRegion);
  }

  // Find injection markers
  const injections = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].last_event === 'INJECTION_START') {
      injections.push(data[i]);
    }
  }

  // Draw exponential fit overlay path
  let fitPath = '';
  if (fitPoints && fitPoints.length > 0) {
    // We only plot points that fall within our X time boundary
    const plottedFitPoints = fitPoints
      .filter(p => p.timestamp >= startTime && p.timestamp <= endTime)
      .map(p => `${getX(p.timestamp)},${getY(p.value)}`);
    
    if (plottedFitPoints.length > 0) {
      fitPath = `M ${plottedFitPoints.join(' L ')}`;
    }
  }

  // Generate Y-axis gridlines & ticks
  const yTicksCount = 5;
  const yTicks = [];
  for (let i = 0; i < yTicksCount; i++) {
    const val = minGas + (i / (yTicksCount - 1)) * (maxGas - minGas);
    yTicks.push(val);
  }

  // Generate X-axis ticks (intervals of 10s or 30s)
  const xTicks = [];
  const xTickCount = 4;
  for (let i = 0; i < xTickCount; i++) {
    const ts = startTime + (i / (xTickCount - 1)) * timeRange;
    xTicks.push(ts);
  }

  const formatTime = (ts) => {
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="graph-wrapper">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {/* Soft grid lines */}
        {yTicks.map((val, idx) => (
          <g key={`y-grid-${idx}`}>
            <line
              x1={paddingLeft}
              y1={getY(val)}
              x2={width - paddingRight}
              y2={getY(val)}
              stroke="#f1f3f5"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 10}
              y={getY(val) + 4}
              fill="var(--text-secondary)"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
            >
              {Math.round(val)}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {xTicks.map((ts, idx) => (
          <g key={`x-grid-${idx}`}>
            <text
              x={getX(ts)}
              y={height - paddingBottom + 18}
              fill="var(--text-muted)"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {formatTime(ts)}
            </text>
          </g>
        ))}

        {/* Highlighted Decay Regions */}
        {decayRegions.map((region, idx) => {
          const xStart = getX(region.start);
          const xEnd = getX(region.end);
          const widthDecay = xEnd - xStart;
          if (widthDecay <= 0) return null;
          return (
            <rect
              key={`decay-rect-${idx}`}
              x={xStart}
              y={paddingTop}
              width={widthDecay}
              height={chartHeight}
              fill="rgba(245, 158, 11, 0.05)"
              stroke="rgba(245, 158, 11, 0.15)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          );
        })}

        {/* Injection Event Markers */}
        {injections.map((inj, idx) => {
          const x = getX(inj.timestamp);
          return (
            <g key={`injection-marker-${idx}`}>
              <line
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={height - paddingBottom}
                stroke="var(--accent-primary)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <rect
                x={x - 30}
                y={paddingTop - 18}
                width="60"
                height="15"
                rx="3"
                fill="#eff6ff"
                stroke="#bfdbfe"
                strokeWidth="0.5"
              />
              <text
                x={x}
                y={paddingTop - 7}
                fill="var(--accent-primary)"
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
              >
                INJECTION
              </text>
            </g>
          );
        })}

        {/* Baseline Line (Dashed) */}
        <polyline
          fill="none"
          stroke="#9ca3af"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          points={baselinePoints}
        />

        {/* Exponential Decay Fitting Overlay Curve */}
        {fitPath && (
          <path
            fill="none"
            stroke="var(--accent-danger)"
            strokeWidth="2"
            strokeDasharray="1 1"
            d={fitPath}
          />
        )}

        {/* Raw/Compensated VOC Concentration Line */}
        <polyline
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="2"
          points={vocPoints}
        />
        
        {/* Draw dots on the actual data points */}
        {data.map((d, idx) => {
          if (idx % 3 !== 0 && idx !== data.length - 1) return null; // reduce visual noise
          return (
            <circle
              key={`dot-${idx}`}
              cx={getX(d.timestamp)}
              cy={getY(d.comp_gas)}
              r="2"
              fill="var(--text-primary)"
            />
          );
        })}

        {/* Chart Frame */}
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="#e5e7eb"
          strokeWidth="1.5"
        />
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          stroke="#e5e7eb"
          strokeWidth="1.5"
        />
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '3px', backgroundColor: 'var(--text-primary)' }}></span>
          Compensated VOC Gas
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '3px', borderTop: '2px dashed #9ca3af' }}></span>
          Rolling Baseline (Clean Air)
        </div>
        {fitPath && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '3px', borderTop: '2px dotted var(--accent-danger)' }}></span>
            Exponential Fit Overlay ($\tau$ Fit)
          </div>
        )}
        {decayRegions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '10px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)' }}></span>
            Analyzed Decay Window
          </div>
        )}
      </div>
    </div>
  );
}
