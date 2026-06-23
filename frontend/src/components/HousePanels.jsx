import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { HOUSE_COLORS, getStatus, STATUS_COLORS, STATUS_BG, STATUS_BORDER } from '../utils';
import { formatTime } from '../utils';

function GaugeChart({ value, max, label, unit, status, color }) {
  const pct = Math.min(100, value ? (value / max) * 100 : 0);
  const option = {
    backgroundColor: 'transparent',
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0, max,
      radius: '90%',
      center: ['50%', '60%'],
      pointer: {
        length: '55%',
        width: 4,
        itemStyle: { color },
      },
      progress: {
        show: true,
        width: 8,
        itemStyle: { color },
      },
      axisLine: { lineStyle: { width: 8, color: [[1, 'rgba(255,255,255,0.04)']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        formatter: `{value}${unit}`,
        fontSize: 18,
        fontWeight: 'bold',
        color,
        offsetCenter: [0, '15%'],
        fontFamily: 'JetBrains Mono',
      },
      title: { show: false },
      data: [{ value: value || 0 }],
    }],
  };
  return <ReactECharts option={option} style={{ height: 120 }} opts={{ renderer: 'svg' }} />;
}

function MiniLineChart({ data, metricKey, color }) {
  const points = data.map(r => [r.timestamp, r[metricKey]]);
  const option = {
    backgroundColor: 'transparent',
    grid: { left: 0, right: 0, top: 4, bottom: 4 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1.5, color },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: color + '40' }, { offset: 1, color: color + '00' }]
        },
      },
      data: points,
    }],
  };
  return <ReactECharts option={option} style={{ height: 50 }} opts={{ renderer: 'svg' }} notMerge={false} lazyUpdate />;
}

export default function HousePanels({ history, latestData }) {
  const houses = ['Fully Ventilated', 'Semi-Ventilated', 'Non-Ventilated'];

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-4 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded" />
        Individual House Monitoring
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {houses.map((house, hi) => {
          const reading = latestData[house] || {};
          const houseHistory = history[house] || [];
          const color = HOUSE_COLORS[house];
          const tempStatus = getStatus('temperature', reading.temperature);
          const overallWorst = [
            getStatus('temperature', reading.temperature),
            getStatus('humidity', reading.humidity),
            getStatus('gas', reading.gas),
          ].reduce((a, b) => {
            const rank = { safe: 0, warning: 1, critical: 2 };
            return rank[a] >= rank[b] ? a : b;
          }, 'safe');

          const statusColor = STATUS_COLORS[overallWorst];

          return (
            <motion.div
              key={house}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: hi * 0.15, duration: 0.5 }}
              className="glass-card p-5 relative overflow-hidden"
              style={{ borderColor: `${color}25` }}
            >
              {/* Header bar */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: statusColor }} />
                    <h3 className="text-sm font-bold text-slate-200">{house}</h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 ml-4">
                    {houseHistory.length > 0 ? `Last: ${formatTime(houseHistory[houseHistory.length-1]?.timestamp)}` : 'No data'}
                  </p>
                </div>
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{ background: STATUS_BG[overallWorst], color: statusColor, border: `1px solid ${STATUS_BORDER[overallWorst]}` }}
                >
                  {overallWorst.toUpperCase()}
                </span>
              </div>

              {/* Metric rows */}
              {[
                { key: 'temperature', label: 'Temp', unit: '°C', max: 50 },
                { key: 'humidity',    label: 'Hum',  unit: '%',  max: 100 },
                { key: 'gas',         label: 'Gas',  unit: ' ppm', max: 1500 },
              ].map(m => {
                const val = reading[m.key];
                const st = getStatus(m.key, val);
                const sc = STATUS_COLORS[st];
                const pct = val ? Math.min(100, (val / m.max) * 100) : 0;
                return (
                  <div key={m.key} className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{m.label}</span>
                      <span className="mono font-bold" style={{ color: sc }}>{val ?? '--'}{m.unit}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${sc}80, ${sc})` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Mini sparkline */}
              {houseHistory.length > 3 && (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <p className="text-xs text-slate-600 mb-1">Temperature trend</p>
                  <MiniLineChart data={houseHistory.slice(-20)} metricKey="temperature" color={color} />
                </div>
              )}

              {/* Decorative corner */}
              <div className="absolute top-0 right-0 w-16 h-16 opacity-5 pointer-events-none"
                style={{ background: `radial-gradient(circle at 100% 0%, ${color}, transparent)` }} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
