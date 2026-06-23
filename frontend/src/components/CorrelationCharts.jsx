import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { HOUSES, HOUSE_COLORS } from '../utils';

const CHART_BASE = {
  backgroundColor: 'transparent',
  tooltip: {
    trigger: 'item',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(99,179,237,0.2)',
    textStyle: { color: '#e2e8f0', fontSize: 11 },
  },
  legend: {
    show: true,
    bottom: 4,
    textStyle: { color: '#64748b', fontSize: 10 },
    itemWidth: 10,
    itemHeight: 10,
  },
};

function ScatterChart({ title, xKey, yKey, xLabel, yLabel, history, delay }) {
  const series = useMemo(() =>
    HOUSES.map(house => ({
      name: house,
      type: 'scatter',
      symbolSize: 6,
      itemStyle: { color: HOUSE_COLORS[house], opacity: 0.75 },
      data: (history[house] || []).map(r => [r[xKey], r[yKey]]),
    })),
  [history, xKey, yKey]);

  const option = {
    ...CHART_BASE,
    grid: { left: 48, right: 16, top: 16, bottom: 52 },
    xAxis: {
      name: xLabel,
      nameLocation: 'middle',
      nameGap: 22,
      nameTextStyle: { color: '#475569', fontSize: 10 },
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      axisLabel: { color: '#475569', fontSize: 9 },
    },
    yAxis: {
      name: yLabel,
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: '#475569', fontSize: 10 },
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
      axisLabel: { color: '#475569', fontSize: 9 },
    },
    series,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <ReactECharts option={option} style={{ height: 220 }} opts={{ renderer: 'svg' }} notMerge={false} lazyUpdate />
    </motion.div>
  );
}

export default function CorrelationCharts({ history }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-4 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded" />
        Correlation Analysis
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScatterChart title="Temperature vs Gas" xKey="temperature" yKey="gas" xLabel="Temp (°C)" yLabel="Gas (ppm)" history={history} delay={0} />
        <ScatterChart title="Humidity vs Gas"    xKey="humidity"    yKey="gas" xLabel="Hum (%)"   yLabel="Gas (ppm)" history={history} delay={0.1} />
        <ScatterChart title="Temperature vs Humidity" xKey="temperature" yKey="humidity" xLabel="Temp (°C)" yLabel="Hum (%)" history={history} delay={0.2} />
      </div>
    </div>
  );
}
