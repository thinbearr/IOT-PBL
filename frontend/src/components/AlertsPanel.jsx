import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateTime } from '../utils';

const SEV_CONFIG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', label: 'CRITICAL' },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', label: 'WARNING' },
};

function AlertItem({ alert, isNew }) {
  const cfg = SEV_CONFIG[alert.severity] || SEV_CONFIG.warning;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-start gap-3 p-3 rounded-xl border"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${cfg.color}15` }}>
          {alert.severity === 'critical' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-xs text-slate-500">•</span>
          <span className="text-xs text-slate-400 font-medium truncate">{alert.house}</span>
        </div>
        <p className="text-sm text-slate-300">{alert.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-600 mono font-medium">{alert.metric}: {alert.value}</span>
          <span className="text-xs text-slate-700">•</span>
          <span className="text-xs text-slate-600">{formatDateTime(alert.timestamp)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function AlertsPanel({ alerts }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount  = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-4 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded" />
        Alert Management
      </h2>
      <div className="glass-card p-5">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="text-2xl font-black mono text-red-400">{criticalCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Critical</div>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="text-2xl font-black mono text-amber-400">{warningCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Warnings</div>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.15)' }}>
            <div className="text-2xl font-black mono text-blue-400">{alerts.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Total</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {['all', 'critical', 'warning'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`nav-tab capitalize ${filter === f ? 'active' : ''}`}>
              {f === 'all' ? 'All Alerts' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Alert list */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          <AnimatePresence>
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-slate-600">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-sm">No {filter === 'all' ? '' : filter} alerts</div>
              </motion.div>
            ) : (
              filtered.slice(0, 20).map((alert, i) => (
                <AlertItem key={alert.id || i} alert={alert} />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
