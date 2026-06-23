import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { HOUSES, HOUSE_COLORS, formatTime } from '../utils';
import { motion } from 'framer-motion';

const CHART_DEFAULTS = {
  backgroundColor: 'transparent',
  textStyle: { color: '#94a3b8', fontFamily: 'Inter' },
  grid: { left: 48, right: 24, top: 40, bottom: 50, containLabel: false },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#0f172a',
    borderColor: 'rgba(99,179,237,0.2)',
    borderWidth: 1,
    textStyle: { color: '#e2e8f0', fontSize: 12 },
    axisPointer: { lineStyle: { color: 'rgba(99,179,237,0.3)' } },
  },
  legend: {
    top: 8,
    textStyle: { color: '#94a3b8', fontSize: 11 },
    itemWidth: 16,
    itemHeight: 3,
  },
};

function buildLineOption(title, metricKey, unit, history) {
  const series = HOUSES.map(house => {
    const data = (history[house] || []).map(r => [r.timestamp, r[metricKey]]);
    return {
      name: house,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: HOUSE_COLORS[house] },
      itemStyle: { color: HOUSE_COLORS[house] },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: HOUSE_COLORS[house] + '30' },
            { offset: 1, color: HOUSE_COLORS[house] + '00' },
          ],
        },
      },
      data,
    };
  });

  return {
    ...CHART_DEFAULTS,
    legend: { ...CHART_DEFAULTS.legend, data: HOUSES },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      splitLine: { show: false },
      axisLabel: {
        color: '#475569',
        fontSize: 10,
        formatter: val => formatTime(val),
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      axisLabel: { color: '#475569', fontSize: 10, formatter: v => `${v}${unit}` },
    },
    series,
  };
}

function ComparisonChart({ title, metricKey, unit, history, delay }) {
  const option = useMemo(() => buildLineOption(title, metricKey, unit, history), [history, metricKey, unit, title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-semibold text-slate-300 mb-1">{title}</h3>
      <p className="text-xs text-slate-600 mb-3">Real-time comparison across all 3 houses</p>
      <ReactECharts
        option={option}
        style={{ height: 220 }}
        opts={{ renderer: 'svg' }}
        notMerge={false}
        lazyUpdate={true}
      />
    </motion.div>
  );
}

export default function ComparisonCharts({ history }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-4 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded" />
        Real-Time Comparison
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ComparisonChart title="Temperature" metricKey="temperature" unit="°C" history={history} delay={0} />
        <ComparisonChart title="Humidity"    metricKey="humidity"    unit="%" history={history} delay={0.1} />
        <ComparisonChart title="Gas Concentration" metricKey="gas" unit=" ppm" history={history} delay={0.2} />
      </div>
    </div>
  );
}
