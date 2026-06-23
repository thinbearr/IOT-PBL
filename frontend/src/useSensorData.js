import { useState, useEffect, useRef, useCallback } from 'react';
import { generateMockReading, HOUSES } from './utils';

const HISTORY_LIMIT = 40;
const UPDATE_INTERVAL_MS = 1500;

export function useSensorData() {
  // Mode selection: true = Hardware (connect to ESP), false = Simulation
  const [isHardwareMode, setIsHardwareMode] = useState(false);

  // --- HARDWARE MODE STATE ---
  const [history, setHistory] = useState(() => {
    const h = {};
    HOUSES.forEach(house => { h[house] = []; });
    return h;
  });
  const [lastSeen, setLastSeen] = useState(() => {
    const ls = {};
    HOUSES.forEach(house => { ls[house] = 0; });
    return ls;
  });
  const [isLive, setIsLive] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionHistory, setSessionHistory] = useState(() => {
    const h = {};
    HOUSES.forEach(house => { h[house] = []; });
    return h;
  });
  const [logs, setLogs] = useState([]); // Event logs

  // --- SIMULATION LAB STATE ---
  const [simFanSpeed, setSimFanSpeed] = useState(0); // 0 = Off, 1 = Low, 2 = High
  const [simGasLevel, setSimGasLevel] = useState(150); // Live gas level
  const [simTemp, setSimTemp] = useState(25.0);
  const [simHum, setSimHum] = useState(50.0);
  const [simHistory, setSimHistory] = useState([]);
  
  // Refs
  const wsRef = useRef(null);
  const mockTimerRef = useRef(null);
  const simTimerRef = useRef(null);
  const hardwareSpikeTimeRef = useRef(null);

  const addLog = useCallback((house, message, severity = 'info') => {
    const newLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      house,
      message,
      severity // 'info', 'warning', 'success', 'error'
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  }, []);

  // --- HARDWARE MODE SIMULATION SPIKE TRIGGER ---
  // In hardware mode, if the user doesn't have real hardware running, we can trigger simulated spikes in the background mock stream
  const triggerSprayEvent = useCallback(() => {
    hardwareSpikeTimeRef.current = Date.now();
    addLog('System', '⚠️ Simulated VOC Spray Event triggered for all houses.', 'warning');
    HOUSES.forEach(house => {
      addLog(house, 'VOC concentration spike detected! Congestion Alert.', 'error');
    });
  }, [addLog]);

  // --- PROCESS HARDWARE INCOMING PACKET ---
  const processReading = useCallback((houseId, reading) => {
    let adjustedReading = { ...reading };

    // Apply transient mock logic if we aren't connected to a live web socket
    if (hardwareSpikeTimeRef.current && !isLive) {
      const elapsedSec = (Date.now() - hardwareSpikeTimeRef.current) / 1000;
      const baseline = houseId === 'Fully Ventilated' ? 180 : houseId === 'Semi-Ventilated' ? 210 : 230;
      const initialSpike = 800;
      
      let multiplier = 0;
      if (houseId === 'Fully Ventilated') {
        multiplier = Math.exp(-elapsedSec / 5.0); // Halves in 3.5s
      } else if (houseId === 'Semi-Ventilated') {
        multiplier = Math.exp(-elapsedSec / 35.0); // Halves in 24s
      } else {
        multiplier = Math.exp(-elapsedSec / 450.0); // Persists
      }

      adjustedReading.gas = Math.round(baseline + initialSpike * multiplier + (Math.random() - 0.5) * 15);
      if (adjustedReading.gas < baseline) adjustedReading.gas = baseline;
      adjustedReading.humidity = +(reading.humidity + multiplier * 12).toFixed(1);
      adjustedReading.temperature = +(reading.temperature + multiplier * 1.5).toFixed(1);
    }

    // Update last seen timestamp
    setLastSeen(prev => ({ ...prev, [houseId]: Date.now() }));

    setHistory(prev => {
      const cur = prev[houseId] || [];
      return { ...prev, [houseId]: [...cur, adjustedReading].slice(-HISTORY_LIMIT) };
    });

    if (isRecording) {
      setSessionHistory(prev => {
        const cur = prev[houseId] || [];
        return { ...prev, [houseId]: [...cur, adjustedReading] };
      });

      const warningThreshold = 400;
      const criticalThreshold = 700;

      setSessionHistory(prev => {
        const cur = prev[houseId] || [];
        const prevReading = cur[cur.length - 2];
        const prevGas = prevReading ? prevReading.gas : 0;
        const lastGas = adjustedReading.gas;

        if (prevGas < criticalThreshold && lastGas >= criticalThreshold) {
          addLog(houseId, `🚨 Critical: Gas concentration high (${lastGas} ppm). Congestion detected!`, 'error');
        } else if (prevGas >= warningThreshold && lastGas < warningThreshold) {
          addLog(houseId, `✅ Resolved: Gas levels returned to baseline (${lastGas} ppm). Congestion cleared.`, 'success');
        } else if (prevGas >= criticalThreshold && lastGas < criticalThreshold && lastGas >= warningThreshold) {
          addLog(houseId, `⚠️ Warning: Gas level dropping (${lastGas} ppm). Clearance in progress.`, 'warning');
        }

        return prev;
      });
    }

    // Process alerts
    const { temperature, humidity, gas, timestamp } = adjustedReading;
    if (gas > 700) {
      setAlerts(prev => [
        { id: Date.now() + 'G', severity: 'critical', house: houseId, metric: 'Gas', value: `${gas} ppm`, message: `Gas concentration spike!`, timestamp },
        ...prev
      ].slice(0, 30));
    }
  }, [isRecording, isLive, addLog]);

  // --- MOCK BACKGROUND DATA GENERATION (when WebSocket offline) ---
  const startMock = useCallback(() => {
    if (mockTimerRef.current) clearInterval(mockTimerRef.current);
    mockTimerRef.current = setInterval(() => {
      HOUSES.forEach(house => {
        const reading = generateMockReading(house);
        processReading(house, reading);
      });
    }, UPDATE_INTERVAL_MS);
  }, [processReading]);

  // --- CONNECT WEBSOCKET ---
  const connectWs = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;
      
      ws.onopen = () => { 
        setIsLive(true); 
        clearInterval(mockTimerRef.current); 
        addLog('System', 'Connected to live WebSocket server.', 'success');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'HISTORY') {
          const hist = { ...history };
          Object.entries(data.data || {}).forEach(([house, readings]) => {
            if (HOUSES.includes(house)) {
              hist[house] = readings.slice(-HISTORY_LIMIT);
              if (readings.length > 0) {
                setLastSeen(prev => ({ ...prev, [house]: Date.now() }));
              }
            }
          });
          setHistory(hist);
        } else if (data.type === 'NEW_READING') {
          if (HOUSES.includes(data.house_id)) {
            processReading(data.house_id, data.data);
          }
        }
      };
      
      ws.onclose = () => { 
        setIsLive(false); 
        startMock(); 
        addLog('System', 'WebSocket offline. Switched to local background generators.', 'info');
      };
      
      ws.onerror = () => { 
        setIsLive(false); 
        startMock(); 
      };
    } catch {
      setIsLive(false);
      startMock();
    }
  }, [processReading, startMock, history, addLog]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (mockTimerRef.current) clearInterval(mockTimerRef.current);
    };
  }, [connectWs]);

  // Refs to avoid interval recreation and duplicate/warp-speed ticks
  const simFanSpeedRef = useRef(simFanSpeed);
  const simTempRef = useRef(simTemp);
  const simHumRef = useRef(simHum);
  const simGasLevelRef = useRef(simGasLevel);

  useEffect(() => { simFanSpeedRef.current = simFanSpeed; }, [simFanSpeed]);
  useEffect(() => { simTempRef.current = simTemp; }, [simTemp]);
  useEffect(() => { simHumRef.current = simHum; }, [simHum]);
  useEffect(() => { simGasLevelRef.current = simGasLevel; }, [simGasLevel]);

  // --- SIMULATION LAB LOOP ---
  // Calculates real-time single graph decay physics based on Exhaust Fan Speed
  useEffect(() => {
    simTimerRef.current = setInterval(() => {
      // Read latest state values from refs
      const fanSpeed = simFanSpeedRef.current;
      const prevGas = simGasLevelRef.current;
      const prevT = simTempRef.current;
      const prevH = simHumRef.current;

      const baseline = 150;
      let decayFactor = 0.99; // Fan Off (stays high)
      if (fanSpeed === 1) decayFactor = 0.92; // Fan Low (slow decay)
      if (fanSpeed === 2) decayFactor = 0.70; // Fan High (rapid decay)
      
      const excess = prevGas - baseline;
      const newGas = Math.max(baseline, Math.round(baseline + excess * decayFactor + (Math.random() - 0.5) * 6));
      
      // Dynamic Temp/Humidity calculations depending on Fan speed and gas presence
      let targetTemp = 25.0;
      if (fanSpeed === 0) targetTemp = 27.5; // Warmer if closed
      if (fanSpeed === 2) targetTemp = 23.5; // Cooler if high fan
      const newTemp = +(prevT + (targetTemp - prevT) * 0.05 + (Math.random() - 0.5) * 0.1).toFixed(1);

      let targetHum = 50.0;
      if (fanSpeed === 0) targetHum = 58.0; // Stagnant air is humid
      if (fanSpeed === 2) targetHum = 44.0; // Circulated air is dry
      if (newGas > 500) targetHum += 1.0; // Spray injects moisture
      const newHum = +(prevH + (targetHum - prevH) * 0.05 + (Math.random() - 0.5) * 0.2).toFixed(1);

      // Update states
      setSimGasLevel(newGas);
      setSimTemp(newTemp);
      setSimHum(newHum);

      const newPoint = {
        timestamp: Date.now(),
        gas: newGas,
        temperature: newTemp,
        humidity: newHum
      };

      setSimHistory(prevHist => [...prevHist, newPoint].slice(-HISTORY_LIMIT));
    }, 1000);

    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  // Inject VOC in Simulation Lab
  const triggerSimSpray = useCallback(() => {
    setSimGasLevel(1000);
    // Add direct log
    addLog('Simulation', '💨 VOC Perfume/Smoke injected! Concentration spiked to 1000 ppm.', 'warning');
  }, [addLog]);

  const resetSim = useCallback(() => {
    setSimGasLevel(150);
    setSimFanSpeed(0);
    setSimHistory([]);
    setSimTemp(25.0);
    setSimHum(50.0);
    addLog('Simulation', '🔄 Simulation Lab state reset.', 'info');
  }, [addLog]);

  // --- RECORDING SESSION HARDWARE ACTIONS ---
  const startRecording = useCallback(() => {
    const empty = {};
    HOUSES.forEach(house => { empty[house] = []; });
    setSessionHistory(empty);
    setSessionStartTime(Date.now());
    setIsRecording(true);
    setLogs([]);
    addLog('System', '🔴 Session recording started.', 'error');
  }, [addLog]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    addLog('System', '⏹️ Session recording stopped.', 'info');
  }, [addLog]);

  const resetSession = useCallback(() => {
    const empty = {};
    HOUSES.forEach(house => { empty[house] = []; });
    setSessionHistory(empty);
    setSessionStartTime(null);
    setIsRecording(false);
    setLogs([]);
    hardwareSpikeTimeRef.current = null;
    addLog('System', '🔄 Session reset.', 'info');
  }, [addLog]);

  // --- COMPILE STATS FOR HARDWARE HOUSES ---
  const stats = {};
  HOUSES.forEach(house => {
    const sourceData = isRecording ? sessionHistory[house] : history[house];
    const gasValues = sourceData.map(r => r.gas);
    
    const current = gasValues.length > 0 ? gasValues[gasValues.length - 1] : 0;
    const peak = gasValues.length > 0 ? Math.max(...gasValues) : 0;
    const avg = gasValues.length > 0 ? Math.round(gasValues.reduce((a, b) => a + b, 0) / gasValues.length) : 0;
    const baseline = house === 'Fully Ventilated' ? 180 : house === 'Semi-Ventilated' ? 210 : 230;
    
    let clearanceRate = 100;
    let clearanceStatus = 'Cleared';
    let congestionLevel = 'None';
    
    if (peak > baseline + 80) {
      const remainingSpike = Math.max(0, current - baseline);
      const totalSpike = peak - baseline;
      clearanceRate = Math.max(0, Math.min(100, Math.round((1 - (remainingSpike / totalSpike)) * 100)));
      
      if (clearanceRate >= 80) {
        clearanceStatus = 'Cleared';
        congestionLevel = 'None';
      } else if (clearanceRate >= 35) {
        clearanceStatus = 'Clearing...';
        congestionLevel = 'Moderate';
      } else {
        clearanceStatus = 'Congested';
        congestionLevel = 'High';
      }
    }

    stats[house] = {
      current,
      peak,
      avg,
      clearanceRate,
      clearanceStatus,
      congestionLevel,
      lastReading: sourceData[sourceData.length - 1] || null,
      isOnline: (Date.now() - (lastSeen[house] || 0)) < 6000 // online check (within 6 seconds)
    };
  });

  // --- COMPILE STATS FOR SIMULATION LAB ---
  const simGasValues = simHistory.map(h => h.gas);
  const simPeak = simGasValues.length > 0 ? Math.max(...simGasValues) : simGasLevel;
  const simAvg = simGasValues.length > 0 ? Math.round(simGasValues.reduce((a, b) => a + b, 0) / simGasValues.length) : simGasLevel;
  let simClearanceRate = 100;
  let simClearanceStatus = 'Cleared';
  
  if (simPeak > 200) {
    const remainingSpike = Math.max(0, simGasLevel - 150);
    const totalSpike = simPeak - 150;
    simClearanceRate = Math.max(0, Math.min(100, Math.round((1 - (remainingSpike / totalSpike)) * 100)));
    
    if (simClearanceRate >= 80) {
      simClearanceStatus = 'Cleared';
    } else if (simClearanceRate >= 35) {
      simClearanceStatus = 'Clearing...';
    } else {
      simClearanceStatus = 'Congested (Stagnant)';
    }
  }

  return {
    history,
    latestData: stats,
    alerts,
    isLive,
    isRecording,
    sessionStartTime,
    sessionHistory,
    logs,
    triggerSprayEvent,
    startRecording,
    stopRecording,
    resetSession,

    // Mode Selector
    isHardwareMode,
    setIsHardwareMode,

    // Simulation Lab
    simFanSpeed,
    setSimFanSpeed,
    simGasLevel,
    simTemp,
    simHum,
    simHistory,
    triggerSimSpray,
    resetSim,
    simPeak,
    simAvg,
    simClearanceRate,
    simClearanceStatus
  };
}
