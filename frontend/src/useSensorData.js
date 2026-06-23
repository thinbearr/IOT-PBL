import { useState, useEffect, useRef, useCallback } from 'react';
import { generateMockReading, buildInitialHistory, HOUSES } from './utils';

const HISTORY_LIMIT = 50;
const MOCK_INTERVAL_MS = 3000;

export function useSensorData() {
  const [history, setHistory] = useState(() => {
    const h = {};
    HOUSES.forEach(house => { h[house] = buildInitialHistory(house, 30); });
    return h;
  });
  const [alerts, setAlerts] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const wsRef = useRef(null);
  const mockTimerRef = useRef(null);

  const processReading = useCallback((houseId, reading) => {
    setHistory(prev => {
      const cur = prev[houseId] || [];
      return { ...prev, [houseId]: [...cur, reading].slice(-HISTORY_LIMIT) };
    });

    // Generate alerts
    const newAlerts = [];
    const { temperature, humidity, gas, timestamp } = reading;
    if (temperature > 40)  newAlerts.push({ id: Date.now() + 'T', severity: 'critical', house: houseId, metric: 'Temperature', value: `${temperature}°C`, message: `High temperature detected`, timestamp });
    else if (temperature > 35) newAlerts.push({ id: Date.now() + 'Tw', severity: 'warning', house: houseId, metric: 'Temperature', value: `${temperature}°C`, message: `Elevated temperature`, timestamp });
    if (humidity > 85)  newAlerts.push({ id: Date.now() + 'H', severity: 'critical', house: houseId, metric: 'Humidity', value: `${humidity}%`, message: `Critical humidity level`, timestamp });
    else if (humidity > 75) newAlerts.push({ id: Date.now() + 'Hw', severity: 'warning', house: houseId, metric: 'Humidity', value: `${humidity}%`, message: `High humidity detected`, timestamp });
    if (gas > 1000) newAlerts.push({ id: Date.now() + 'G', severity: 'critical', house: houseId, metric: 'Gas', value: `${gas} ppm`, message: `Gas leakage detected!`, timestamp });
    else if (gas > 700) newAlerts.push({ id: Date.now() + 'Gw', severity: 'warning', house: houseId, metric: 'Gas', value: `${gas} ppm`, message: `Gas level elevated`, timestamp });

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
    }
  }, []);

  const startMock = useCallback(() => {
    if (mockTimerRef.current) clearInterval(mockTimerRef.current);
    mockTimerRef.current = setInterval(() => {
      HOUSES.forEach(house => {
        const reading = generateMockReading(house);
        processReading(house, reading);
      });
    }, MOCK_INTERVAL_MS);
  }, [processReading]);

  const connectWs = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;
      ws.onopen = () => { setIsLive(true); clearInterval(mockTimerRef.current); };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'HISTORY') {
          Object.entries(data.data || {}).forEach(([house, readings]) => {
            readings.forEach(r => processReading(house, r));
          });
        } else if (data.type === 'NEW_READING') {
          processReading(data.house_id, data.data);
        }
      };
      ws.onclose = () => { setIsLive(false); startMock(); };
      ws.onerror  = () => { setIsLive(false); startMock(); };
    } catch {
      setIsLive(false);
      startMock();
    }
  }, [processReading, startMock]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (mockTimerRef.current) clearInterval(mockTimerRef.current);
    };
  }, [connectWs]);

  const latestData = {};
  HOUSES.forEach(house => {
    const h = history[house] || [];
    latestData[house] = h.length > 0 ? h[h.length - 1] : null;
  });

  return { history, latestData, alerts, isLive };
}
