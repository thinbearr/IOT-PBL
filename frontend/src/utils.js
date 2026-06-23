// Shared mock data generator and WebSocket hook
export const HOUSES = ['Fully Ventilated', 'Semi-Ventilated', 'Closed'];

export const HOUSE_COLORS = {
  'Fully Ventilated': '#0df2b8', // Mint-Cyan
  'Semi-Ventilated': '#0d9488',  // Teal 600
  'Closed': '#475569',           // Slate 600
};

export const HOUSE_COLORS_DIM = {
  'Fully Ventilated': 'rgba(13, 242, 184, 0.15)',
  'Semi-Ventilated': 'rgba(13, 148, 136, 0.15)',
  'Closed': 'rgba(71, 85, 105, 0.15)',
};

export const THRESHOLDS = {
  temperature: { warning: 35, critical: 40 },
  humidity: { warning: 75, critical: 85 },
  gas: { warning: 400, critical: 700 }, // MQ2 VOC threshold warning/critical
};

export function getStatus(type, value) {
  const t = THRESHOLDS[type];
  if (!t || value === undefined || value === null) return 'safe';
  if (value >= t.critical) return 'critical';
  if (value >= t.warning) return 'warning';
  return 'safe';
}

export const STATUS_COLORS = {
  safe: '#0d9488',       // Teal (Safe)
  warning: '#d97706',    // Amber (Warning)
  critical: '#e11d48',   // Rose (Critical)
};

export const STATUS_BG = {
  safe: 'rgba(13, 148, 136, 0.08)',
  warning: 'rgba(217, 119, 6, 0.08)',
  critical: 'rgba(225, 29, 72, 0.08)',
};

export const STATUS_BORDER = {
  safe: 'rgba(13, 148, 136, 0.25)',
  warning: 'rgba(217, 119, 6, 0.25)',
  critical: 'rgba(225, 29, 72, 0.25)',
};

export const STATUS_LABELS = {
  safe: 'Safe',
  warning: 'Warning',
  critical: 'Critical',
};

// Generate realistic mock data for simulation
export function generateMockReading(house) {
  const base = {
    'Fully Ventilated':    { tempBase: 24.2, humBase: 48, gasBase: 180 },
    'Semi-Ventilated':     { tempBase: 26.5, humBase: 52, gasBase: 210 },
    'Closed':              { tempBase: 28.0, humBase: 55, gasBase: 230 },
  };
  const b = base[house] || base['Fully Ventilated'];
  return {
    temperature: +(b.tempBase + (Math.random() - 0.5) * 1.5).toFixed(1),
    humidity:    +(b.humBase  + (Math.random() - 0.5) * 2).toFixed(1),
    gas:         Math.round(b.gasBase   + (Math.random() - 0.5) * 20),
    timestamp:   Date.now(),
  };
}

export function buildInitialHistory(house, count = 30) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const r = generateMockReading(house);
    r.timestamp = now - (count - i) * 5000;
    return r;
  });
}

export function formatTime(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function formatDateTime(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
}
