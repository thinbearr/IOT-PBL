import React from 'react';
import { motion } from 'framer-motion';
import { HOUSES, formatDateTime } from '../utils';

function downloadCSV(history) {
  const rows = [['House', 'Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Gas (ppm)']];
  HOUSES.forEach(house => {
    (history[house] || []).forEach(r => {
      rows.push([house, formatDateTime(r.timestamp), r.temperature, r.humidity, r.gas]);
    });
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'aerosense_data.csv'; a.click();
  URL.revokeObjectURL(url);
}

async function downloadExcel(history) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  HOUSES.forEach(house => {
    const rows = (history[house] || []).map(r => ({
      House: house,
      Timestamp: formatDateTime(r.timestamp),
      'Temperature (°C)': r.temperature,
      'Humidity (%)': r.humidity,
      'Gas (ppm)': r.gas,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, house.substring(0, 31));
  });
  XLSX.writeFile(wb, 'aerosense_data.xlsx');
}

async function downloadPDF(history, latestData) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(18);
  doc.setTextColor(30, 100, 200);
  doc.text('AeroSense IQ — Environmental Monitoring Report', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  // Summary table
  const summaryRows = HOUSES.map(house => {
    const r = latestData[house] || {};
    return [house, r.temperature ?? '--', r.humidity ?? '--', r.gas ?? '--'];
  });
  autoTable(doc, {
    head: [['House', 'Temperature (°C)', 'Humidity (%)', 'Gas (ppm)']],
    body: summaryRows,
    startY: 35,
    theme: 'striped',
    headStyles: { fillColor: [30, 100, 200] },
  });

  // Data tables per house
  HOUSES.forEach(house => {
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(30, 100, 200);
    doc.text(`${house} — Historical Data`, 14, 20);
    const rows = (history[house] || []).map(r => [
      formatDateTime(r.timestamp), r.temperature, r.humidity, r.gas
    ]);
    autoTable(doc, {
      head: [['Timestamp', 'Temperature (°C)', 'Humidity (%)', 'Gas (ppm)']],
      body: rows,
      startY: 28,
      theme: 'striped',
      headStyles: { fillColor: [30, 100, 200] },
    });
  });

  doc.save('aerosense_report.pdf');
}

const BTN_STYLES = [
  { label: 'Export CSV',   icon: '📄', action: (h, l) => downloadCSV(h),         color: 'rgba(52,211,153,' },
  { label: 'Export Excel', icon: '📊', action: (h, l) => downloadExcel(h),        color: 'rgba(99,179,237,' },
  { label: 'Export PDF',   icon: '📑', action: (h, l) => downloadPDF(h, l),       color: 'rgba(245,158,11,' },
];

export default function ExportOptions({ history, latestData }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-4 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded" />
        Export Options
      </h2>
      <div className="glass-card p-5">
        <p className="text-xs text-slate-500 mb-4">Download all historical sensor data for offline analysis.</p>
        <div className="flex flex-wrap gap-3">
          {BTN_STYLES.map((b, i) => (
            <motion.button
              key={b.label}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => b.action(history, latestData)}
              className="btn-glass text-sm font-semibold px-5 py-2.5 rounded-xl"
              style={{ borderColor: `${b.color}0.3)`, color: '#e2e8f0' }}
            >
              <span>{b.icon}</span>
              {b.label}
            </motion.button>
          ))}
        </div>
        <p className="text-xs text-slate-700 mt-4">
          Data includes {Object.values(history).reduce((a, h) => a + h.length, 0)} total readings across {HOUSES.length} houses.
        </p>
      </div>
    </div>
  );
}
