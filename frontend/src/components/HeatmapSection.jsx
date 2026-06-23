import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { HOUSES, getStatus } from '../utils';

const RISK_COLORS = ['#34d399', '#f59e0b', '#ef4444'];

function getRiskScore(latestData, house) {
  const r = latestData[house];
  if (!r) return 0;
  const t = getStatus('temperature', r.temperature);
  const h = getStatus('humidity', r.humidity);
  const g = getStatus('gas', r.gas);
  const rank = { safe: 0, warning: 1, critical: 2 };
  return rank[t] + rank[h] + rank[g];  // 0-6
}

function getRiskLabel(score) {
  if (score >= 4) return 'HIGH RISK';
  if (score >= 2) return 'MODERATE';
  return 'LOW RISK';
}

function getRiskColor(score) {
  if (score >= 4) return '#ef4444';
  if (score >= 2) return '#f59e0b';
  return '#34d399';
}

export default function HeatmapSection({ latestData, history }) {
  const houseRisks = useMemo(() =>
    HOUSES.map(house => {
      const score = getRiskScore(latestData, house);
      return { house, score, label: getRiskLabel(score), color: getRiskColor(score) };
    }),
  [latestData]);

  // Risk over time bar chart for each house
  const riskHistoryOption = useMemo(() => {
    const series = HOUSES.map(house => ({
      name: house,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2 },
      data: (history[house] || []).map(r => {
        const t = getStatus('temperature', r.temperature);
        const h = getStatus('humidity', r.humidity);
        const g = getStatus('gas', r.gas);
        const rank = { safe: 0, warning: 1, critical: 2 };
        return [r.timestamp, rank[t] + rank[h] + rank[g]];
      }),
    }));

    return {
      backgroundColor: 'transparent',
      legend: {
        top: 8,
        textStyle: { color: '#64748b', fontSize: 10 },
        itemWidth: 16, itemHeight: 3,
      },
      grid: { left: 32, right: 16, top: 36, bottom: 36 },
      xAxis: { type: 'time', axisLabel: { color: '#475569', fontSize: 9 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }, splitLine: { show: false } },
      yAxis: {
        type: 'value', min: 0, max: 6,
        axisLabel: { color: '#475569', fontSize: 9,
          formatter: v => ['Low','','Mod','','','High'][v] || '' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
        axisLine: { show: false },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(99,179,237,0.2)',
        textStyle: { color: '#e2e8f0', fontSize: 11 },
      },
      visualMap: {
        show: false,
        min: 0, max: 6,
        inRange: { color: ['#34d399', '#f59e0b', '#ef4444'] },
      },
      series,
    };
  }, [history]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-4 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded" />
        Environmental Risk Heatmap
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Risk cards */}
        {houseRisks.map(({ house, score, label, color }, i) => (
          <motion.div
            key={house}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5 relative overflow-hidden"
            style={{ borderColor: `${color}30` }}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(circle at 50% 0%, ${color}, transparent 70%)` }} />
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{house}</p>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-black mono" style={{ color }}>{score}</span>
              <span className="text-xs text-slate-500 mb-1.5">/ 6 risk score</span>
            </div>
            {/* Risk bar */}
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
              <motion.div
                animate={{ width: `${(score / 6) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, #34d39960, ${color})` }}
              />
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
              {label}
            </span>
            {/* Dot grid visualization */}
            <div className="mt-3 grid grid-cols-3 gap-1">
              {Array.from({ length: 6 }, (_, di) => (
                <div key={di} className="h-2 rounded-sm"
                  style={{ background: di < score ? color : 'rgba(255,255,255,0.05)' }} />
              ))}
            </div>
          </motion.div>
        ))}

        {/* Risk over time chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5 lg:col-span-1"
        >
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Risk Over Time</h3>
          <p className="text-xs text-slate-600 mb-2">Composite risk score trend</p>
          <ReactECharts option={riskHistoryOption} style={{ height: 160 }} opts={{ renderer: 'svg' }} notMerge={false} lazyUpdate />
        </motion.div>
      </div>
    </div>
  );
}
