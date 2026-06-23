import React from 'react';
import { motion } from 'framer-motion';
import { HOUSES, HOUSE_COLORS, HOUSE_COLORS_DIM, getStatus, STATUS_COLORS, STATUS_BG, STATUS_BORDER } from '../utils';

const ICONS = {
  temperature: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
    </svg>
  ),
  humidity: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  ),
  gas: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18"/>
      <circle cx="7" cy="6" r="1" fill="currentColor"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <circle cx="17" cy="18" r="1" fill="currentColor"/>
    </svg>
  ),
};

function MetricCard({ house, metric, value, unit, status, color, index }) {
  const s = status || 'safe';
  const barWidth = metric === 'temperature'
    ? Math.min(100, (value / 50) * 100)
    : metric === 'humidity'
    ? Math.min(100, value)
    : Math.min(100, (value / 1500) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="glass-card p-4 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
      style={{
        background: STATUS_BG[s],
        borderColor: STATUS_BORDER[s],
      }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl blur-xl"
        style={{ background: `radial-gradient(circle at 50% 50%, ${STATUS_COLORS[s]}20, transparent 70%)` }}
      />

      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">{house}</p>
          <p className="text-sm font-semibold text-slate-300 capitalize">{metric}</p>
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${STATUS_COLORS[s]}15`, color: STATUS_COLORS[s] }}
        >
          {ICONS[metric]}
        </div>
      </div>

      <div className="flex items-end gap-1 mb-3">
        <span className="text-3xl font-bold mono tabular-nums" style={{ color: STATUS_COLORS[s] }}>
          {value !== null && value !== undefined ? value : '--'}
        </span>
        <span className="text-sm text-slate-400 mb-1">{unit}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${STATUS_COLORS[s]}60, ${STATUS_COLORS[s]})` }}
        />
      </div>

      {/* Status badge */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: STATUS_COLORS[s] }} />
          <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[s] }}>
            {s.toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-slate-600 mono">{barWidth.toFixed(0)}%</span>
      </div>
    </motion.div>
  );
}

export default function OverviewCards({ latestData }) {
  const metrics = [
    { key: 'temperature', label: 'Temperature', unit: '°C' },
    { key: 'humidity',    label: 'Humidity',    unit: '%'  },
    { key: 'gas',         label: 'Gas Level',   unit: 'ppm'},
  ];

  let idx = 0;
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-4 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded" />
        Overview — Current Readings
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
        {HOUSES.map(house =>
          metrics.map(m => {
            const reading = latestData[house];
            const value = reading ? reading[m.key] : null;
            const status = getStatus(m.key, value);
            const color = HOUSE_COLORS[house];
            const card = (
              <MetricCard
                key={`${house}-${m.key}`}
                house={house.replace(' House','').replace('Fully Ventilated','Full. Vent.').replace('Semi-Ventilated','Semi-Vent.').replace('Non-Ventilated','Non-Vent.')}
                metric={m.key}
                value={value}
                unit={m.unit}
                status={status}
                color={color}
                index={idx}
              />
            );
            idx++;
            return card;
          })
        )}
      </div>
    </div>
  );
}
