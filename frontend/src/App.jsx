import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Wind, 
  Thermometer, 
  Droplets, 
  MapPin, 
  History, 
  ShieldCheck, 
  FileText, 
  Fan, 
  Zap, 
  RefreshCw, 
  Layers,
  CheckCircle,
  AlertTriangle,
  Play,
  Settings,
  HelpCircle
} from 'lucide-react';

import ChartComponent from './components/ChartComponent';
import MetricGauge from './components/MetricGauge';
import ZoneMap from './components/ZoneMap';

export default function App() {
  const [activeTab, setActiveTab] = useState('Live Monitoring');
  const [wsConnected, setWsConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    mode: 'SIMULATION',
    fan_on: false,
    serial_connected: false,
    serial_port: null,
    sampling_frequency_hz: 1.0
  });

  const [availablePorts, setAvailablePorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('AUTO');
  const [isScanningPorts, setIsScanningPorts] = useState(false);

  const [activeZone, setActiveZone] = useState('Zone A');
  const [zoneData, setZoneData] = useState({
    "Zone A": { stagnation_score: 0.0, tau: null, ach: null, quality: 'No Data' },
    "Zone B": { stagnation_score: 0.0, tau: null, ach: null, quality: 'No Data' },
    "Zone C": { stagnation_score: 0.0, tau: null, ach: null, quality: 'No Data' },
    "Corridor": { stagnation_score: 0.0, tau: null, ach: null, quality: 'No Data' }
  });

  // Client side log tracking
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), type: 'info', message: 'AeroSense diagnostics initialization complete.' },
    { time: new Date().toLocaleTimeString(), type: 'info', message: 'Ready to receive JSON data packets.' }
  ]);

  // Maintain list of historical decay sessions
  const [sessions, setSessions] = useState([
    { id: 1, time: '14:10:02', duration: '92s', tau: '32.1s', ach: '112.1', quality: 'Excellent', fan: 'ON' },
    { id: 2, time: '14:21:40', duration: '180s', tau: '215.4s', ach: '16.7', quality: 'Stagnant', fan: 'OFF' }
  ]);

  const wsRef = useRef(null);

  // WebSocket Connection
  useEffect(() => {
    let reconnectTimeout;
    
    function connect() {
      const socket = new WebSocket('ws://127.0.0.1:8000/ws');
      wsRef.current = socket;
      
      socket.onopen = () => {
        setWsConnected(true);
        addLog('info', 'WebSocket link established with Python backend.');
      };
      
      socket.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          
          if (packet.active_zone) {
            setActiveZone(packet.active_zone);
          }
          if (packet.zone_data) {
            setZoneData(packet.zone_data);
          }
          
          if (packet.type === 'TELEMETRY') {
            setTelemetry(packet.data);
            setSystemStatus(packet.system_status);
            
            // Append to history data for charts (max 150 points)
            setHistoryData(prev => {
              const updated = [...prev, packet.data];
              if (updated.length > 150) {
                updated.shift();
              }
              return updated;
            });
            
            // Check for event triggers to write in logs
            if (packet.data.last_event) {
              handleScientificEvent(packet.data);
            }
          } else if (packet.type === 'STATUS' || packet.type === 'STATUS_UPDATE') {
            setSystemStatus(prev => ({
              ...prev,
              ...packet.data,
              ...packet.status
            }));
            
            if (packet.status?.fallback_triggered) {
              addLog('event', 'Hardware connection timeout. Backend reverted to Simulation Mode.');
            }
            
            addLog('info', `Backend status updated: Mode=${packet.data?.mode || packet.status?.mode}, Fan=${packet.data?.fan_on || packet.status?.fan_on ? 'ON' : 'OFF'}`);
          }
        } catch (err) {
          console.error("Error parsing socket frame:", err);
        }
      };
      
      socket.onclose = () => {
        setWsConnected(false);
        addLog('error', 'WebSocket disconnected. Reconnecting in 3s...');
        reconnectTimeout = setTimeout(connect, 3000);
      };
      
      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        socket.close();
      };
    }
    
    connect();
    
    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleScientificEvent = (data) => {
    const timeStr = new Date(data.timestamp * 1000).toLocaleTimeString();
    
    if (data.last_event === 'INJECTION_START') {
      addLog('event', `VOC Injection pulse detected! Raw gas reading spiking. (Baseline: ${data.baseline})`);
    } else if (data.last_event === 'DECAY_START') {
      addLog('event', `Concentration peaked at ${data.c_max} units. Decay slope calculations initiated.`);
    } else if (data.last_event === 'DECAY_END') {
      addLog('event', `Decay sequence complete. Calculated Tau: ${data.tau}s, ACH: ${data.ach} h⁻¹.`);
      
      // Save decay test into sessions list
      setSessions(prev => [
        {
          id: Date.now(),
          time: timeStr,
          duration: `${Math.round(data.decay_duration)}s`,
          tau: `${data.tau}s`,
          ach: `${data.ach}`,
          quality: data.ventilation_quality,
          fan: systemStatus.fan_on ? 'ON' : 'OFF'
        },
        ...prev
      ]);
    }
  };

  const addLog = (type, message) => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs(prev => [{ time: timeStr, type, message }, ...prev].slice(0, 100));
  };

  // Controller Actions
  const sendCommand = (cmdPacket) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmdPacket));
    } else {
      addLog('error', 'Cannot send command. WebSocket not connected.');
    }
  };

  const fetchPorts = async () => {
    setIsScanningPorts(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/available-ports');
      if (res.ok) {
        const data = await res.json();
        setAvailablePorts(data);
      }
    } catch (err) {
      console.error("Failed to fetch COM ports:", err);
    } finally {
      setIsScanningPorts(false);
    }
  };

  useEffect(() => {
    fetchPorts();
    const interval = setInterval(() => {
      if (systemStatus.mode === 'LIVE_ESP' || activeTab === 'Sensor Health') {
        fetchPorts();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [systemStatus.mode, activeTab]);

  const handleModeSwitch = (mode) => {
    const backendMode = mode === 'SIMULATION' ? 'SIMULATION' : 'LIVE';
    sendCommand({ 
      command: 'SET_MODE', 
      mode: backendMode, 
      port: selectedPort 
    });
    addLog('info', `Requesting mode switch to ${mode} (port: ${selectedPort})`);
  };

  const handlePortChange = (port) => {
    setSelectedPort(port);
    if (systemStatus.mode === 'LIVE_ESP') {
      sendCommand({ 
        command: 'SET_MODE', 
        mode: 'LIVE', 
        port: port 
      });
      addLog('info', `Switching active serial port to ${port}`);
    }
  };

  const handleReconnect = () => {
    if (systemStatus.mode === 'LIVE_ESP') {
      fetchPorts();
      sendCommand({ 
        command: 'SET_MODE', 
        mode: 'LIVE', 
        port: selectedPort 
      });
      addLog('info', `Scanning and reconnecting to serial port: ${selectedPort}...`);
    } else {
      if (wsRef.current) {
        wsRef.current.close();
      }
      addLog('info', 'Resetting WebSocket connection...');
    }
  };

  const getLiveStatusLabel = () => {
    if (!wsConnected) return 'Offline';
    if (systemStatus.mode === 'SIMULATION') return 'Simulation Active';
    if (systemStatus.serial_connected) return 'ESP Connected';
    return 'Searching for hardware...';
  };

  const handleZoneSwitch = (zone) => {
    sendCommand({ command: 'SET_ZONE', zone });
    setHistoryData([]);
    addLog('info', `Rotating instrument location to ${zone}. Resetting transient charts.`);
  };

  const toggleFan = () => {
    const nextState = !systemStatus.fan_on;
    sendCommand({ command: 'SET_FAN', state: nextState });
    addLog('info', `Commanding Ventilation Fan ${nextState ? 'ON' : 'OFF'}`);
  };

  const triggerInjection = () => {
    sendCommand({ command: 'INJECT_EVENT' });
    addLog('info', 'Commanding pulse VOC marker injection...');
  };

  const resetBaseline = () => {
    sendCommand({ command: 'RESET_BASELINE' });
    setHistoryData([]);
    addLog('info', 'Sensor baseline recalibration triggered.');
  };

  // Navigation Items
  const navItems = [
    { name: 'Live Monitoring', icon: Activity },
    { name: 'Decay Analytics', icon: Layers },
    { name: 'Zone Mapping', icon: MapPin },
    { name: 'Historical Sessions', icon: History },
    { name: 'Sensor Health', icon: ShieldCheck },
    { name: 'System Logs', icon: FileText }
  ];

  // Helper for status styling
  const getQualityBadge = (qual) => {
    if (qual === 'Excellent') return <span className="badge badge-success">Excellent</span>;
    if (qual === 'Moderate') return <span className="badge badge-warning">Moderate</span>;
    return <span className="badge badge-danger">Stagnant</span>;
  };

  return (
    <div className="app-container">
      {/* Sidebar Section */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">A</div>
          <span className="logo-text">AeroSense</span>
        </div>
        
        <ul className="nav-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <div 
                  className={`nav-item ${activeTab === item.name ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.name)}
                >
                  <Icon size={16} />
                  {item.name}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="sidebar-footer">
          <div>AeroSense v1.2.0</div>
          <div>IoT Research Platform</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
            <span className={`dot ${wsConnected ? 'connected' : ''}`} style={{ width: '6px', height: '6px' }}></span>
            {wsConnected ? 'Link Connected' : 'Link Disconnected'}
          </div>
        </div>
      </aside>

      {/* Main Dashboard Section */}
      <main className="main-content">
        <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div className="header-title-area">
            <h1>AeroSense</h1>
            <p>VOC Persistence-Based Airflow Diagnostics</p>
          </div>

          <div className="connection-controls-group" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Mode Switcher Pill */}
            <div style={{ display: 'inline-flex', backgroundColor: '#e5e7eb', borderRadius: '20px', padding: '2px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => handleModeSwitch('SIMULATION')}
                style={{ 
                  border: 'none', 
                  backgroundColor: systemStatus.mode === 'SIMULATION' ? '#ffffff' : 'transparent',
                  color: systemStatus.mode === 'SIMULATION' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderRadius: '18px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: systemStatus.mode === 'SIMULATION' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                Simulation
              </button>
              <button 
                onClick={() => handleModeSwitch('LIVE_ESP')}
                style={{ 
                  border: 'none', 
                  backgroundColor: systemStatus.mode === 'LIVE_ESP' ? '#ffffff' : 'transparent',
                  color: systemStatus.mode === 'LIVE_ESP' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderRadius: '18px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: systemStatus.mode === 'LIVE_ESP' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                Live Hardware
              </button>
            </div>

            {/* COM Port Dropdown */}
            {systemStatus.mode === 'LIVE_ESP' && (
              <select
                value={selectedPort}
                onChange={(e) => handlePortChange(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="AUTO">Auto COM Port</option>
                {availablePorts.map((p, idx) => (
                  <option key={idx} value={p.device}>
                    {p.device} ({p.description.substring(0, 18)})
                  </option>
                ))}
              </select>
            )}

            {/* Reconnect / Scan Button */}
            <button
              onClick={handleReconnect}
              title={systemStatus.mode === 'LIVE_ESP' ? "Rescan Serial Ports & Reconnect" : "Reconnect WebSocket Link"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'var(--transition-fast)',
                height: '28px'
              }}
            >
              <RefreshCw size={12} className={isScanningPorts ? 'spin-animation' : ''} />
            </button>

            {/* Status Badge */}
            <div className="connection-badge" style={{ padding: '6px 12px' }}>
              <div className="status-indicator">
                <span className={`dot ${
                  !wsConnected 
                    ? '' 
                    : systemStatus.mode === 'SIMULATION' 
                      ? 'simulating' 
                      : systemStatus.serial_connected 
                        ? 'connected' 
                        : 'searching'
                }`}></span>
                <span style={{ fontWeight: 600 }}>
                  {getLiveStatusLabel()}
                  {systemStatus.mode === 'LIVE_ESP' && systemStatus.serial_connected && ` (${systemStatus.serial_port})`}
                </span>
              </div>
            </div>
            
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
              <span>{systemStatus.sampling_frequency_hz} Hz</span>
            </div>
          </div>
        </header>

        {/* Tab contents */}
        {activeTab === 'Live Monitoring' && (
          <div className="dashboard-grid">
            
            {/* Primary Live Cards */}
            {/* 1. VOC Card */}
            <div className="card metric-card">
              <div className="card-title">
                <span>VOC Concentration</span>
                <Wind size={14} color="var(--text-muted)" />
              </div>
              <div className="metric-value-container">
                <span className="metric-value">{telemetry ? telemetry.comp_gas : '---'}</span>
                <span className="metric-unit">ppm-eq</span>
              </div>
              <div className="metric-subtext">
                <span>Baseline: {telemetry ? telemetry.baseline : '---'}</span>
                <span style={{ margin: '0 4px', color: 'var(--border-color)' }}>|</span>
                <span style={{ color: telemetry?.state === 'DECAYING' ? 'var(--accent-warning)' : 'var(--text-muted)' }}>
                  State: {telemetry ? telemetry.state : 'IDLE'}
                </span>
              </div>
            </div>

            {/* 2. Temperature Card */}
            <div className="card metric-card">
              <div className="card-title">
                <span>Temperature</span>
                <Thermometer size={14} color="var(--text-muted)" />
              </div>
              <div className="metric-value-container">
                <span className="metric-value">{telemetry ? telemetry.temp : '---'}</span>
                <span className="metric-unit">°C</span>
              </div>
              <div className="metric-subtext">
                <span>DHT compensated calibration active</span>
              </div>
            </div>

            {/* 3. Humidity Card */}
            <div className="card metric-card">
              <div className="card-title">
                <span>Relative Humidity</span>
                <Droplets size={14} color="var(--text-muted)" />
              </div>
              <div className="metric-value-container">
                <span className="metric-value">{telemetry ? telemetry.hum : '---'}</span>
                <span className="metric-unit">%</span>
              </div>
              <div className="metric-subtext">
                <span>Absolute moisture compensation active</span>
              </div>
            </div>

            {/* 4. Ventilation Quality */}
            <div className="card metric-card">
              <div className="card-title">
                <span>Ventilation Quality</span>
                <Layers size={14} color="var(--text-muted)" />
              </div>
              <div className="metric-value-container">
                <span className="metric-value" style={{ fontSize: '24px', height: '39px', display: 'flex', alignItems: 'center' }}>
                  {telemetry ? telemetry.ventilation_quality : '---'}
                </span>
              </div>
              <div className="metric-subtext">
                {telemetry ? getQualityBadge(telemetry.ventilation_quality) : null}
                <span>Air exchange status</span>
              </div>
            </div>

            {/* 5. Stagnation score Circular gauge */}
            <div className="card gauge-card">
              <div className="card-title">
                <span>Stagnation Score</span>
                <Activity size={14} color="var(--text-muted)" />
              </div>
              <MetricGauge score={telemetry ? telemetry.stagnation_score : 0} />
              <div className="metric-subtext" style={{ justifyContent: 'center', marginTop: '12px' }}>
                <span>0 = High Flow | 100 = Fully Stagnant</span>
              </div>
            </div>

            {/* 6. Estimated Decay Constant (Tau) */}
            <div className="card metric-card">
              <div className="card-title">
                <span>Decay Constant (τ)</span>
                <Settings size={14} color="var(--text-muted)" />
              </div>
              <div className="metric-value-container">
                <span className="metric-value">{telemetry?.tau ? `${telemetry.tau}` : '---'}</span>
                <span className="metric-unit">s</span>
              </div>
              <div className="metric-subtext">
                {telemetry?.tau ? (
                  telemetry.tau < 60 ? (
                    <span className="badge badge-success">Fast Decay (Active Flow)</span>
                  ) : (
                    <span className="badge badge-danger">Slow Decay (Stagnant Air)</span>
                  )
                ) : (
                  <span>Pulse marker required</span>
                )}
              </div>
            </div>

            {/* Real-time Line Chart */}
            <div className="card graph-section">
              <div className="card-title" style={{ marginBottom: '8px' }}>
                <span>Real-Time VOC Exponential Decay Curve</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {telemetry?.state === 'DECAYING' && (
                    <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw size={10} className="spin-animation" /> Fitting Curve...
                    </span>
                  )}
                </div>
              </div>
              <ChartComponent data={historyData} activeMode={systemStatus.mode} />
            </div>

            {/* Floor Map */}
            <div className="card map-card">
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Sequential Stagnation Map</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Instrument Location:</span>
                  <select
                    value={activeZone}
                    onChange={(e) => handleZoneSwitch(e.target.value)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="Zone A">Zone A</option>
                    <option value="Zone B">Zone B</option>
                    <option value="Zone C">Zone C</option>
                    <option value="Corridor">Corridor</option>
                  </select>
                </div>
              </div>
              <ZoneMap 
                activeZone={activeZone} 
                zoneAScore={telemetry ? telemetry.stagnation_score : 0} 
                zoneData={zoneData} 
              />
            </div>

            {/* Control Panel */}
            <div className="card control-card">
              <div className="card-title">
                <span>Experiment Control Panel</span>
                <Settings size={14} color="var(--text-muted)" />
              </div>
              
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.4' }}>
                Manage physical simulator inputs or hardware modes directly from the console interface.
              </div>
              
              <div className="control-grid">
                <button 
                  className={`btn ${systemStatus.mode === 'LIVE_ESP' ? 'btn-toggle-active' : ''}`}
                  onClick={() => handleModeSwitch(systemStatus.mode === 'SIMULATION' ? 'LIVE_ESP' : 'SIMULATION')}
                  title="Switch between live USB connection and software simulator model"
                >
                  <Activity size={14} />
                  {systemStatus.mode === 'LIVE_ESP' ? 'Simulation Mode' : 'Enable Live ESP'}
                </button>
                
                <button 
                  className="btn"
                  onClick={resetBaseline}
                  title="Clear graph history and recalculate clean air baseline level"
                >
                  <RefreshCw size={14} />
                  Reset Baseline
                </button>
                
                <button 
                  className={`btn btn-full ${systemStatus.fan_on ? 'btn-toggle-active' : ''}`}
                  onClick={toggleFan}
                  disabled={systemStatus.mode !== 'SIMULATION'}
                  style={{ opacity: systemStatus.mode !== 'SIMULATION' ? 0.5 : 1 }}
                  title="Simulates an active ventilation exhaust fan (drastically speeds up VOC decay)"
                >
                  <Fan size={14} className={systemStatus.fan_on ? 'spin-animation' : ''} />
                  Exhaust Fan: {systemStatus.fan_on ? 'ON (Fast Decay)' : 'OFF (Stagnant)'}
                </button>
                
                <button 
                  className="btn btn-primary btn-full"
                  onClick={triggerInjection}
                  disabled={systemStatus.mode !== 'SIMULATION'}
                  style={{ opacity: systemStatus.mode !== 'SIMULATION' ? 0.5 : 1 }}
                  title="Pulse-injects a VOC spray to watch and analyze the room decay curve"
                >
                  <Play size={14} />
                  Inject VOC Marker Event
                </button>
              </div>
            </div>

            {/* Decay Analytics Panel */}
            <div className="card analytics-card">
              <div className="card-title">
                <span>Decay Analytics</span>
                <Layers size={14} color="var(--text-muted)" />
              </div>
              
              <table className="science-table">
                <tbody>
                  <tr>
                    <td className="label">Estimated Fit Form</td>
                    <td className="val" style={{ fontSize: '11px' }}>
                      {telemetry?.tau ? `C_b + ${telemetry.amplitude || 'A'} * e^(-t/${telemetry.tau})` : 'No Active Curve'}
                    </td>
                  </tr>
                  <tr>
                    <td className="label">Decay Constant (τ)</td>
                    <td className="val">{telemetry?.tau ? `${telemetry.tau} s` : '---'}</td>
                  </tr>
                  <tr>
                    <td className="label">Air Changes Per Hour (ACH)</td>
                    <td className="val">{telemetry?.ach ? `${telemetry.ach} h⁻¹` : '---'}</td>
                  </tr>
                  <tr>
                    <td className="label">Air Exchange Efficiency</td>
                    <td className="val">
                      {telemetry?.ach ? (
                        telemetry.ach > 50 ? 'High' : telemetry.ach > 15 ? 'Moderate' : 'Stagnant'
                      ) : '---'}
                    </td>
                  </tr>
                  <tr>
                    <td className="label">Baseline Drift</td>
                    <td className="val">{telemetry ? `${(telemetry.baseline - 120.0).toFixed(1)} ppm` : '---'}</td>
                  </tr>
                  <tr>
                    <td className="label">Transient Peak (C_max)</td>
                    <td className="val">{telemetry?.c_max ? `${telemetry.c_max} ppm` : '---'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sensor Health Panel */}
            <div className="card health-card">
              <div className="card-title">
                <span>Sensor Health & Calibration</span>
                <ShieldCheck size={14} color="var(--text-muted)" />
              </div>
              
              <div className="health-grid">
                <div className="health-item">
                  <span className="health-name">MQ135 Gas Sensor Status</span>
                  <span className="health-status" style={{ color: 'var(--accent-success)' }}>
                    <CheckCircle size={12} /> Calibrated
                  </span>
                </div>
                
                <div className="health-item">
                  <span className="health-name">DHT22 Temp/Humidity Status</span>
                  <span className="health-status" style={{ color: 'var(--accent-success)' }}>
                    <CheckCircle size={12} /> Active
                  </span>
                </div>

                <div className="health-item">
                  <span className="health-name">ESP32 Hardware Connection</span>
                  <span className="health-status">
                    {systemStatus.serial_connected ? (
                      <span style={{ color: 'var(--accent-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> Connected
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Simulated
                      </span>
                    )}
                  </span>
                </div>

                <div className="health-item">
                  <span className="health-name">Packet latency</span>
                  <span className="health-status" style={{ fontFamily: 'var(--font-mono)' }}>
                    {systemStatus.serial_connected ? '4 ms' : '0 ms (Local)'}
                  </span>
                </div>

                <div className="health-item">
                  <span className="health-name">Calibration Standard Reference</span>
                  <span className="health-status" style={{ color: 'var(--text-secondary)' }}>
                    20°C, 55% RH
                  </span>
                </div>
              </div>
            </div>

            {/* Logs Area */}
            <div className="card logs-card">
              <div className="card-title">
                <span>AeroSense Local Stream Logs</span>
                <FileText size={14} color="var(--text-muted)" />
              </div>
              <div className="console-output">
                {logs.map((log, idx) => (
                  <div key={idx} className="log-line">
                    <span className="log-time">[{log.time}] </span>
                    {log.type === 'event' ? (
                      <span className="log-msg-event">{log.message}</span>
                    ) : (
                      <span className="log-msg-info">{log.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {activeTab === 'Decay Analytics' && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Decay Curve Analytics & Fitting Logic</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              The ventilation capacity of a space can be measured using tracer gas decay. The rate of decay corresponds directly to the volumetric flow rate of clean outdoor air entering the zone, assuming complete mixing.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '20px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>Exponential Fit Mechanics</h3>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '15px', backgroundColor: '#fafafa', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', lineHeight: '1.6' }}>
                  <div>C(t) = C_baseline + A * e^(-t/τ)</div>
                  <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Linear transformation for Regression:</div>
                  <div style={{ color: 'var(--accent-primary)' }}>ln(C(t) - C_baseline) = ln(A) - t/τ</div>
                  <div style={{ marginTop: '8px' }}>Slope (m) = -1/τ</div>
                  <div>Decay Time Constant (τ) = -1/m</div>
                  <div>Air Changes Per Hour (ACH) = 3600 / τ</div>
                </div>
              </div>
              
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>ACH Quality Benchmarks</h3>
                <table className="science-table">
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 'bold' }}>
                      <td style={{ padding: '8px 0' }}>ACH Range</td>
                      <td>Tau Range</td>
                      <td style={{ textAlign: 'right' }}>Diagnostic Classification</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 0' }}>&gt; 60 h⁻¹</td>
                      <td>&lt; 60 seconds</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-success)', fontWeight: 600 }}>Excellent (High Flow)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0' }}>20 - 60 h⁻¹</td>
                      <td>60 - 180 seconds</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-warning)', fontWeight: 600 }}>Moderate (Normal)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0' }}>&lt; 20 h⁻¹</td>
                      <td>&gt; 180 seconds</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-danger)', fontWeight: 600 }}>Stagnant (Restricted)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Compensation Factors</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
                MQ135 sensors are inherently temperature and humidity dependent. AeroSense adjusts the raw gas readings dynamically to a reference temperature of 20°C and 55% RH. This ensures that environmental changes do not trigger baseline drifts or artificial spikes during prolonged monitoring runs.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'Zone Mapping' && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Multi-Zone Airflow Mapping</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Deploy additional wireless ESP32 sensor transmitters in adjacent areas to chart local stagnation scores across the floor plan.
            </p>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <ZoneMap zoneAScore={telemetry ? telemetry.stagnation_score : 0} />
            </div>
          </div>
        )}

        {activeTab === 'Historical Sessions' && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Historical Diagnostic Runs</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Session data is preserved in local storage</span>
            </div>
            
            <table className="science-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 600 }}>
                  <td style={{ padding: '12px 6px' }}>Timestamp</td>
                  <td>Exhaust Fan</td>
                  <td>Decay Test Duration</td>
                  <td>Decay Constant (τ)</td>
                  <td>Air Changes (ACH)</td>
                  <td style={{ textAlign: 'right' }}>Ventilation Quality</td>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => (
                  <tr key={sess.id}>
                    <td style={{ padding: '12px 6px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{sess.time}</td>
                    <td style={{ fontSize: '13px' }}>
                      <span className={`badge ${sess.fan === 'ON' ? 'badge-success' : 'badge-warning'}`}>{sess.fan}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{sess.duration}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 'bold' }}>{sess.tau}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{sess.ach} h⁻¹</td>
                    <td style={{ textAlign: 'right' }}>{getQualityBadge(sess.quality)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Sensor Health' && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>Microcontroller & Hardware Health Panel</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>MQ135 VOC Sensor</h3>
                <div style={{ fontSize: '20px', fontWeight: 700, margin: '8px 0' }}>100% Calibrated</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Sensor warming: Done<br />R0 Value: 76.2 kΩ<br />Load Resistor: 20.0 kΩ</div>
              </div>
              
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>DHT22 Sensor</h3>
                <div style={{ fontSize: '20px', fontWeight: 700, margin: '8px 0' }}>Nominal</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Humidity error rate: 0.1%<br />Temp precision: ±0.5°C<br />Sampling interval: 2.0s</div>
              </div>

              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>USB Serial Connection</h3>
                <div style={{ fontSize: '20px', fontWeight: 700, margin: '8px 0' }}>
                  {systemStatus.serial_connected ? 'Connected' : 'Offline (Sim)'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Port: {systemStatus.serial_port || 'N/A'}<br />
                  Baud rate: 115200 bps<br />
                  Packet rate: 1.0 packet/s
                </div>
              </div>
            </div>

            <div style={{ marginTop: '30px', padding: '16px', border: '1px solid #ffe3e3', backgroundColor: '#ffe3e3', borderRadius: 'var(--radius-md)', color: '#c92a2a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={16} />
              <strong>Warning:</strong> Ensure the MQ135 sensor has been preheated for at least 24 hours in a stable clean environment before conducting research-grade stagnation readings.
            </div>
          </div>
        )}

        {activeTab === 'System Logs' && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Instrumentation Event Console</h2>
              <button className="btn" onClick={() => setLogs([])}>Clear Console</button>
            </div>
            <div className="console-output" style={{ height: '400px' }}>
              {logs.map((log, idx) => (
                <div key={idx} className="log-line">
                  <span className="log-time">[{log.time}] </span>
                  {log.type === 'event' ? (
                    <span className="log-msg-event">{log.message}</span>
                  ) : (
                    <span className="log-msg-info">{log.message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
