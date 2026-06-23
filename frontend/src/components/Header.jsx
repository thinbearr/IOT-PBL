import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function Header({ isLive, alertCount }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="glass-card border-gradient px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-4">
        <div className="relative w-12 h-12 flex-shrink-0">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 opacity-20 blur-md" />
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/30 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#63b3ed" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="#63b3ed" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="#76e4f7" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold gradient-text tracking-tight leading-tight">
            AeroSense IQ
          </h1>
          <p className="text-xs text-slate-500 font-medium">Smart Ventilation Monitoring Platform</p>
        </div>
      </div>

      {/* Center: Date & Time */}
      <div className="hidden lg:flex flex-col items-center">
        <div className="mono text-2xl font-bold text-slate-200 tabular-nums tracking-widest">{timeStr}</div>
        <div className="text-xs text-slate-500 mt-0.5">{dateStr}</div>
      </div>

      {/* Right: Status badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Live/Sim badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          isLive
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-blue-400'} animate-pulse`} />
          {isLive ? 'LIVE' : 'SIMULATION'}
        </div>

        {/* 3 nodes */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800/60 border border-slate-700/50 text-slate-300">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
          3 Nodes Active
        </div>

        {/* Alerts badge */}
        {alertCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            {alertCount} Alert{alertCount !== 1 ? 's' : ''}
          </motion.div>
        )}

        {/* System OK */}
        {alertCount === 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            System Normal
          </div>
        )}
      </div>
    </motion.header>
  );
}
