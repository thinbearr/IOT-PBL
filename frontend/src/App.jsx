import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSensorData } from './useSensorData';

import Header         from './components/Header';
import OverviewCards  from './components/OverviewCards';
import ComparisonCharts from './components/ComparisonCharts';
import HousePanels    from './components/HousePanels';
import CorrelationCharts from './components/CorrelationCharts';
import HeatmapSection from './components/HeatmapSection';
import AlertsPanel    from './components/AlertsPanel';
import Analytics      from './components/Analytics';
import ExportOptions  from './components/ExportOptions';

const TABS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'comparison',   label: 'Comparison' },
  { id: 'houses',       label: 'House Panels' },
  { id: 'correlation',  label: 'Correlation' },
  { id: 'heatmap',      label: 'Risk Heatmap' },
  { id: 'alerts',       label: 'Alerts' },
  { id: 'analytics',    label: 'Analytics' },
  { id: 'export',       label: 'Export' },
];

export default function App() {
  const { history, latestData, alerts, isLive } = useSensorData();
  const [activeTab, setActiveTab] = useState('overview');

  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="min-h-screen grid-bg" style={{ background: '#050d1a' }}>
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #63b3ed, transparent)' }} />
        <div className="absolute top-1/3 -right-40 w-80 h-80 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #34d399, transparent)' }} />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
      </div>

      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <Header isLive={isLive} alertCount={criticalAlerts} />

        {/* Navigation tabs */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card px-4 py-3 overflow-x-auto"
        >
          <div className="flex gap-1 min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
                {tab.id === 'alerts' && alerts.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 font-bold">
                    {alerts.filter(a => a.severity === 'critical').length || alerts.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 pb-12"
          >
            {activeTab === 'overview' && (
              <>
                <OverviewCards latestData={latestData} />
                <ComparisonCharts history={history} />
              </>
            )}
            {activeTab === 'comparison'  && <ComparisonCharts history={history} />}
            {activeTab === 'houses'      && <HousePanels history={history} latestData={latestData} />}
            {activeTab === 'correlation' && <CorrelationCharts history={history} />}
            {activeTab === 'heatmap'     && <HeatmapSection latestData={latestData} history={history} />}
            {activeTab === 'alerts'      && <AlertsPanel alerts={alerts} />}
            {activeTab === 'analytics'   && <Analytics history={history} latestData={latestData} />}
            {activeTab === 'export'      && <ExportOptions history={history} latestData={latestData} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
