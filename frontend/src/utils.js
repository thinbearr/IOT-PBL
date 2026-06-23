// Shared mock data generator and WebSocket hook
export const HOUSES = ['Fully Ventilated', 'Semi-Ventilated', 'Non-Ventilated'];

export const HOUSE_COLORS = {
  'Fully Ventilated': '#34d399',
  'Semi-Ventilated': '#f59e0b',
  'Non-Ventilated': '#ef4444',
};

export const HOUSE_COLORS_DIM = {
  'Fully Ventilated': 'rgba(52,211,153,0.15)',
  'Semi-Ventilated': 'rgba(245,158,11,0.15)',
  'Non-Ventilated': 'rgba(239,68,68,0.15)',
};

export const THRESHOLDS = {
  temperature: { warning: 35, critical: 40 },
  humidity: { warning: 75, critical: 85 },
  gas: { warning: 700, critical: 1000 },
};

export function getStatus(type, value) {
  const t = THRESHOLDS[type];
  if (!t || value === undefined || value === null) return 'safe';
  if (value >= t.critical) return 'critical';
  if (value >= t.warning) return 'warning';
  return 'safe';
}

export const STATUS_COLORS = {
  safe: '#34d399',
  warning: '#f59e0b',
  critical: '#ef4444',
};

export const STATUS_BG = {
  safe: 'rgba(52,211,153,0.1)',
  warning: 'rgba(245,158,11,0.1)',
  critical: 'rgba(239,68,68,0.1)',
};

export const STATUS_BORDER = {
  safe: 'rgba(52,211,153,0.3)',
  warning: 'rgba(245,158,11,0.3)',
  critical: 'rgba(239,68,68,0.3)',
};

export const STATUS_LABELS = {
  safe: 'Safe',
  warning: 'Warning',
  critical: 'Critical',
};

// Generate realistic mock data for simulation
export function generateMockReading(house) {
  const base = {
    'Fully Ventilated':    { tempBase: 27, humBase: 55, gasBase: 280 },
    'Semi-Ventilated':     { tempBase: 33, humBase: 70, gasBase: 600 },
    'Non-Ventilated':      { tempBase: 39, humBase: 82, gasBase: 950 },
  };
  const b = base[house] || base['Fully Ventilated'];
  return {
    temperature: +(b.tempBase + (Math.random() - 0.4) * 4).toFixed(1),
    humidity:    +(b.humBase  + (Math.random() - 0.4) * 6).toFixed(1),
    gas:         Math.round(b.gasBase   + (Math.random() - 0.4) * 120),
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
