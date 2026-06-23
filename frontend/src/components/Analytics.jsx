import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { HOUSES, HOUSE_COLORS } from '../utils';

function Stat({ label, value, unit, color }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs text-slate-600 uppercase tracking-wider mb-1">{label}</span>
      <span className="text-xl font-black mono" style={{ color }}>{value !== null && value !== undefined ? `${value}${unit}` : '--'}</span>
    </div>
  );
}

function TrendBadge({ trend }) {
  if (trend === null) return null;
  const up = trend > 0.1;
  const down = trend < -0.1;
  return (
    <span className={`text-xs font-semibold flex items-center gap-0.5 ${up ? 'text-red-400' : down ? 'text-emerald-400' : 'text-slate-500'}`}>
      {up ? '↑' : down ? '↓' : '→'} {Math.abs(trend).toFixed(1)}
    </span>
  );
}

export default function Analytics({ history, latestData }) {
  const stats = useMemo(() => {
    const results = {};
    ['temperature', 'humidity', 'gas'].forEach(metric => {
      results[metric] = {};
      HOUSES.forEach(house => {
        const data = (history[house] || []).map(r => r[metric]).filter(v => v !== undefined && v !== null);
        if (data.length === 0) { results[metric][house] = { avg: null, max: null, min: null, trend: null }; return; }
        const avg = +(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1);
        const max = Math.max(...data);
        const min = Math.min(...data);
        const recent = data.slice(-5);
        const older = data.slice(-10, -5);
        const trend = recent.length > 0 && older.length > 0
          ? +((recent.reduce((a,b)=>a+b,0)/recent.length) - (older.reduce((a,b)=>a+b,0)/older.length)).toFixed(1)
          : null;
        results[metric][house] = { avg, max, min, trend };
      });
    });
    return results;
  }, [history]);

  const METRICS = [
    { key: 'temperature', label: 'Temperature', unit: '°C' },
    { key: 'humidity',    label: 'Humidity',    unit: '%'  },
    { key: 'gas',         label: 'Gas Level',   unit: ' ppm'},
  ];

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-4 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded" />
        Analytics Summary
      </h2>
      <div className="space-y-4">
        {METRICS.map((m, mi) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: mi * 0.1 }}
            className="glass-card p-5"
          >
            <h3 className="text-sm font-semibold text-slate-300 mb-4">{m.label} Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {HOUSES.map(house => {
                const s = stats[m.key]?.[house] || {};
                const color = HOUSE_COLORS[house];
                return (
                  <div key={house} className="p-4 rounded-xl" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold" style={{ color }}>{house}</span>
                      <TrendBadge trend={s.trend} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Stat label="Avg" value={s.avg} unit={m.unit} color={color} />
                      <Stat label="Max" value={s.max} unit={m.unit} color="#ef4444" />
                      <Stat label="Min" value={s.min} unit={m.unit} color="#34d399" />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
