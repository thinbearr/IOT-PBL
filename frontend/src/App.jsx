import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import { useSensorData } from './useSensorData';
import { HOUSES, HOUSE_COLORS, formatTime, STATUS_COLORS, STATUS_BG, STATUS_BORDER } from './utils';
import {
  Play,
  Square,
  RotateCcw,
  Wind,
  Thermometer,
  Droplets,
  Activity,
  FileText,
  Terminal,
  Copy,
  Check,
  Flame,
  FileSpreadsheet,
  Cpu,
  Sliders,
  HelpCircle,
  Wifi,
  WifiOff
} from 'lucide-react';

const ESP32_CODE = `// ========================================================
// AeroSense IQ - ESP32 Multi-House Sensor Node Firmware
// Configured for: DHT11 on GPIO 2 (D2) | MQ-2 Analog on GPIO 35 (D35)
// ========================================================
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// --- WiFi Configuration ---
const char* ssid = "Madhur";
const char* password = "qwertyuiop";

// Central Backend Server Endpoint IP (e.g. http://192.168.1.100:8000/api/sensor-data)
const char* serverName = "http://YOUR_SERVER_IP:8000/api/sensor-data"; 

// --- House Identifier Config (Uncomment ONLY one) ---
#define HOUSE_TYPE "Fully Ventilated"
// #define HOUSE_TYPE "Semi-Ventilated"
// #define HOUSE_TYPE "Closed"

// --- Pin Assignments ---
#define DHTPIN 2      // DHT11 sensor data connected to pin D2
#define DHTTYPE DHT11 // Sensor type
#define MQ2PIN 35     // MQ-2 Analog A0 output connected to pin D35 (ADC1_CH6)
#define LEDPIN 2      // GPIO 2 is also the built-in blue LED for alert indicator

DHT dht(DHTPIN, DHTTYPE);

unsigned long lastTime = 0;
unsigned long timerDelay = 1500; // Poll and send data every 1.5 seconds

void setup() {
  Serial.begin(115200);
  pinMode(MQ2PIN, INPUT);
  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW);

  dht.begin();

  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi network...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected successfully! Local IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Flash LED twice to confirm successful setup
  digitalWrite(LEDPIN, HIGH); delay(200);
  digitalWrite(LEDPIN, LOW);  delay(200);
  digitalWrite(LEDPIN, HIGH); delay(200);
  digitalWrite(LEDPIN, LOW);
}

void loop() {
  // Post sensor readings periodically
  if ((millis() - lastTime) > timerDelay) {
    if (WiFi.status() == WL_CONNECTED) {
      
      float t = dht.readTemperature();
      float h = dht.readHumidity();
      int gasValue = analogRead(MQ2PIN); // Reads 0 to 4095
      
      // Error checking for DHT sensor
      if (isnan(t) || isnan(h)) {
        Serial.println("Error: Failed to read from DHT sensor!");
        return;
      }

      // Check if Gas exceeds standard congestion threshold (700 on a 4095 range)
      // Turn on built-in LED if congestion detected
      if (gasValue > 700) {
        digitalWrite(LEDPIN, HIGH);
      } else {
        digitalWrite(LEDPIN, LOW);
      }

      // Format JSON payload
      String jsonPayload = "{\\"house_id\\": \\"";
      jsonPayload += HOUSE_TYPE;
      jsonPayload += "\\", \\"temperature\\": ";
      jsonPayload += String(t);
      jsonPayload += ", \\"humidity\\": ";
      jsonPayload += String(h);
      jsonPayload += ", \\"gas\\": ";
      jsonPayload += String(gasValue);
      jsonPayload += "}";

      Serial.print("Posting Data: ");
      Serial.println(jsonPayload);

      // Initialize HTTP client
      HTTPClient http;
      http.begin(serverName);
      http.addHeader("Content-Type", "application/json");
      
      int httpResponseCode = http.POST(jsonPayload);
      
      if (httpResponseCode > 0) {
        Serial.print("HTTP response code: ");
        Serial.println(httpResponseCode);
      } else {
        Serial.print("Error sending HTTP POST: ");
        Serial.println(httpResponseCode);
      }
      
      http.end();
    } else {
      Serial.println("WiFi disconnected. Reconnecting...");
      WiFi.disconnect();
      WiFi.begin(ssid, password);
    }
    
    lastTime = millis();
  }
}
`;

export default function App() {
  const {
    history,
    latestData,
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
  } = useSensorData();

  // Tab State
  const [activeTab, setActiveTab] = useState('simulation');
  const [copiedCode, setCopiedCode] = useState(false);

  const simChartRef = useRef(null);
  const houseChartRefs = useRef({});

  // Sync mode state with active tab dynamically only when navigating between home tabs
  useEffect(() => {
    if (isHardwareMode && activeTab === 'simulation') {
      setActiveTab('hardware');
    } else if (!isHardwareMode && activeTab === 'hardware') {
      setActiveTab('simulation');
    }
  }, [isHardwareMode, activeTab]);

  // Fix for ECharts grid size being cut off / half-width in animated/tabbed layouts
  useEffect(() => {
    const handleResize = () => {
      if (simChartRef.current) {
        try {
          simChartRef.current.getEchartsInstance().resize();
        } catch (e) {
          console.error(e);
        }
      }
      Object.values(houseChartRefs.current).forEach(ref => {
        if (ref) {
          try {
            ref.getEchartsInstance().resize();
          } catch (e) {
            console.error(e);
          }
        }
      });
    };

    // Run immediately and after layout animations settle
    handleResize();
    const timer1 = setTimeout(handleResize, 100);
    const timer2 = setTimeout(handleResize, 350);
    const timer3 = setTimeout(handleResize, 700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [activeTab]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ESP32_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // EChart configurations
  const buildChartOption = (houseName, color, isLarge = false) => {
    const dataSource = isRecording ? sessionHistory[houseName] : history[houseName];
    const chartData = (dataSource || []).map(r => [r.timestamp, r.gas]);

    return {
      backgroundColor: 'transparent',
      grid: { left: 45, right: 15, top: 15, bottom: 35 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: 'rgba(13, 242, 184, 0.25)',
        borderWidth: 1,
        textStyle: { color: '#0f172a', fontSize: 11, fontFamily: 'Roboto', fontWeight: 300 },
        axisPointer: { lineStyle: { color: 'rgba(13, 242, 184, 0.15)' } }
      },
      xAxis: {
        type: 'time',
        min: chartData.length > 1 ? chartData[0][0] : undefined,
        max: chartData.length > 1 ? chartData[chartData.length - 1][0] : undefined,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        splitLine: { show: false },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          fontFamily: 'Roboto',
          fontWeight: 300,
          formatter: (val) => {
            const d = new Date(val);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
          }
        }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1100,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          fontFamily: 'Roboto',
          fontWeight: 300,
          formatter: v => `${v} ppm`
        }
      },
      series: [
        {
          name: 'VOC Level',
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: isLarge ? 3 : 2, color: color },
          itemStyle: { color: color },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: color + '25' },
                { offset: 1, color: color + '00' }
              ]
            }
          },
          data: chartData
        }
      ]
    };
  };

  // Build the option for the single simulation chart
  const buildSimChartOption = () => {
    const chartData = simHistory.map(h => [h.timestamp, h.gas]);
    const simColor = '#0df2b8'; // Mint-Cyan

    return {
      backgroundColor: 'transparent',
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: 'rgba(13, 242, 184, 0.25)',
        borderWidth: 1,
        textStyle: { color: '#0f172a', fontSize: 12, fontFamily: 'Roboto', fontWeight: 300 },
        axisPointer: { lineStyle: { color: 'rgba(13, 242, 184, 0.2)' } }
      },
      xAxis: {
        type: 'time',
        min: chartData.length > 1 ? chartData[0][0] : undefined,
        max: chartData.length > 1 ? chartData[chartData.length - 1][0] : undefined,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        splitLine: { show: true, lineStyle: { color: '#f1f5f9' } },
        axisLabel: {
          color: '#475569',
          fontSize: 10,
          fontFamily: 'Roboto',
          fontWeight: 300,
          formatter: (val) => {
            const d = new Date(val);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
          }
        }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1100,
        axisLine: { show: false },
        splitLine: { show: true, lineStyle: { color: '#e2e8f0', type: 'dashed' } },
        axisLabel: {
          color: '#475569',
          fontSize: 10,
          fontFamily: 'Roboto',
          fontWeight: 300,
          formatter: v => `${v} ppm`
        }
      },
      series: [
        {
          name: 'VOC Concentration',
          type: 'line',
          smooth: true,
          symbol: 'emptyCircle',
          symbolSize: 4,
          lineStyle: { width: 3, color: simColor },
          itemStyle: { color: simColor },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: simColor + '30' },
                { offset: 1, color: simColor + '00' }
              ]
            }
          },
          data: chartData
        }
      ]
    };
  };

  const downloadSessionReport = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Timestamp,House,Temperature(C),Humidity(%),VOC(ppm)\\n';
    
    if (activeTab === 'simulation') {
      simHistory.forEach(r => {
        csvContent += `${new Date(r.timestamp).toISOString()},Simulation,${r.temperature},${r.humidity},${r.gas}\\n`;
      });
    } else {
      HOUSES.forEach(house => {
        const data = isRecording ? sessionHistory[house] : history[house];
        data.forEach(r => {
          csvContent += `${new Date(r.timestamp).toISOString()},${house},${r.temperature},${r.humidity},${r.gas}\\n`;
        });
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VOC_Session_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Decorative Mint Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-5 blur-3xl pointer-events-none bg-emerald-300" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-5 blur-3xl pointer-events-none bg-teal-200" />

      {/* HEADER SECTION - completely fills the top page */}
      <header className="w-full bg-white border-b border-emerald-100 px-6 sm:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm sticky top-0 z-50">
        <div className="space-y-1 text-center md:text-left">
          <h1 className="garamond-title-xl tracking-tight text-slate-800 flex items-center justify-center md:justify-start gap-3">
            AeroSense IQ
          </h1>
          <p className="roboto-thin text-sm text-slate-500 uppercase tracking-widest">
            Dual-Sensor Multi-House Ventilation & Gas Dispersion Analyzer
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Mode Switch Toggle */}
          <div className="flex items-center gap-1 bg-slate-100/85 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => {
                setIsHardwareMode(false);
                setActiveTab('simulation');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                !isHardwareMode
                  ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/40 border border-transparent'
              }`}
            >
              <Sliders size={13} />
              Simulation Lab
            </button>
            <button
              onClick={() => {
                setIsHardwareMode(true);
                setActiveTab('hardware');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isHardwareMode
                  ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/40 border border-transparent'
              }`}
            >
              <Cpu size={13} />
              Hardware Mode
            </button>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-3">
            {!isHardwareMode ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border bg-emerald-50 border-emerald-200 text-emerald-700 glow-mint">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                LOCAL SIMULATOR ACTIVE
              </div>
            ) : (
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isLive
                  ? 'bg-cyan-50 border-cyan-200 text-cyan-700 glow-cyan'
                  : 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-cyan-500 animate-pulse' : 'bg-amber-500'}`} />
                {isLive ? 'LIVE HARDWARE CONNECTED' : 'HARDWARE NODE OFFLINE'}
              </div>
            )}
            
            {isRecording && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                RECORDING ACTIVE
              </motion.div>
            )}
          </div>
        </div>
      </header>

      {/* TWO-COLUMN SIDEBAR LAYOUT */}
      <main className="flex-1 w-full px-6 sm:px-8 lg:px-10 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* SIDEBAR TABS (Left column - sleek sidebar navigation with right vertical divider) */}
        <aside className="w-full lg:w-64 flex-shrink-0 lg:border-r lg:border-slate-200/80 lg:pr-8">
          <div className="flex flex-col gap-2 sticky lg:top-28">
            {isHardwareMode ? (
              <button
                onClick={() => setActiveTab('hardware')}
                className={`nav-tab w-full flex items-center gap-3 px-4 py-3 justify-start rounded-xl ${activeTab === 'hardware' ? 'active font-semibold' : ''}`}
              >
                <Activity size={16} />
                <span className="text-sm font-medium">Hardware Monitor</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('simulation')}
                className={`nav-tab w-full flex items-center gap-3 px-4 py-3 justify-start rounded-xl ${activeTab === 'simulation' ? 'active font-semibold' : ''}`}
              >
                <Sliders size={16} />
                <span className="text-sm font-medium">Simulation Lab</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('logs')}
              className={`nav-tab w-full flex items-center gap-3 px-4 py-3 justify-start rounded-xl ${activeTab === 'logs' ? 'active font-semibold' : ''}`}
            >
              <Terminal size={16} />
              <span className="text-sm font-medium">Logs & Reports</span>
            </button>

            <button
              onClick={() => setActiveTab('firmware')}
              className={`nav-tab w-full flex items-center gap-3 px-4 py-3 justify-start rounded-xl ${activeTab === 'firmware' ? 'active font-semibold' : ''}`}
            >
              <Cpu size={16} />
              <span className="text-sm font-medium">Setup & Firmware</span>
            </button>

            <button
              onClick={() => setActiveTab('info')}
              className={`nav-tab w-full flex items-center gap-3 px-4 py-3 justify-start rounded-xl ${activeTab === 'info' ? 'active font-semibold' : ''}`}
            >
              <FileText size={16} />
              <span className="text-sm font-medium">Project Info</span>
            </button>

            {/* Sidebar Overview Widget */}
            <div className="mt-8 border border-emerald-100 bg-emerald-50/20 rounded-xl p-4.5 space-y-4 shadow-sm animate-fade-in">
              <span className="roboto-regular text-[10px] text-emerald-800 uppercase tracking-widest font-bold block">
                System Overview
              </span>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="roboto-thin">Current Mode:</span>
                  <span className="roboto-medium font-semibold text-emerald-700 uppercase tracking-wider text-[10px] bg-emerald-100/60 px-2 py-0.5 rounded">
                    {isHardwareMode ? 'Hardware' : 'Simulation'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="roboto-thin">Connected Nodes:</span>
                  <span className="roboto-medium font-bold text-slate-700">
                    {isHardwareMode 
                      ? Object.values(latestData).filter(n => n.isOnline).length 
                      : 1} / 3
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="roboto-thin">Dispersion Math:</span>
                  <span className="roboto-medium font-semibold text-cyan-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
                    Exponential
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN PANEL CONTENT (Right column) */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            
            {/* 1. HARDWARE MONITOR TAB */}
            {activeTab === 'hardware' && (
              <motion.div
                key="hardware-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Controls bar */}
                <div className="glass-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h2 className="garamond-title-lg text-slate-800">Hardware Monitor</h2>
                    <p className="roboto-thin text-xs text-slate-400">
                      Real-time plots from ESP32 microcontrollers
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button onClick={triggerSprayEvent} className="btn-glass flex items-center gap-2">
                      <Flame size={14} className="text-emerald-500" />
                      <span>Simulate Node Spray</span>
                    </button>

                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="btn-glass bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 hover:text-white flex items-center gap-2"
                      >
                        <Play size={13} fill="currentColor" />
                        <span>Start Record</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="btn-glass bg-rose-600 border-rose-600 text-white hover:bg-rose-700 hover:text-white flex items-center gap-2"
                      >
                        <Square size={13} fill="currentColor" />
                        <span>Stop Record</span>
                      </button>
                    )}

                    <button onClick={resetSession} className="btn-glass">
                      <RotateCcw size={13} />
                      <span>Reset Data</span>
                    </button>

                    <button onClick={downloadSessionReport} className="btn-glass">
                      <FileSpreadsheet size={13} />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Side-by-Side Graphs */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {HOUSES.map(house => {
                    const houseData = latestData[house] || {};
                    const { current, peak, avg, clearanceRate, clearanceStatus, congestionLevel, lastReading, isOnline } = houseData;
                    const houseColor = HOUSE_COLORS[house];

                    let badgeColor = 'bg-teal-50 border-teal-200 text-teal-700';
                    if (congestionLevel === 'Moderate') badgeColor = 'bg-amber-50 border-amber-200 text-amber-700';
                    if (congestionLevel === 'High') badgeColor = 'bg-rose-50 border-rose-200 text-rose-700';

                    return (
                      <div key={house} className="glass-card glass-card-accent flex flex-col justify-between overflow-hidden">
                        
                        {/* Node Header */}
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                          <div>
                            <h3 className="garamond-title-lg text-slate-800">{house} House</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                              <span className="roboto-thin text-xs text-slate-400 uppercase">
                                {isOnline ? 'Node Online' : 'Node Offline'}
                              </span>
                            </div>
                          </div>

                          {isOnline && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                              {clearanceStatus}
                            </span>
                          )}
                        </div>

                        {/* Content (Conditional on online check) */}
                        {!isOnline ? (
                          <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/50">
                            <WifiOff size={40} className="text-slate-300 mb-3" />
                            <h4 className="roboto-medium text-slate-700 text-sm mb-1">ESP32 Offline</h4>
                            <p className="roboto-thin text-xs leading-relaxed max-w-xs">
                              Please connect ESP32 Node to Wifi SSID <strong className="roboto-regular">"Madhur"</strong> and power it on. It will automatically stream to this dashboard.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Temp & Hum */}
                            <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-around text-slate-600 text-xs">
                              <div className="flex items-center gap-1">
                                <Thermometer size={14} className="text-emerald-500" />
                                <span className="roboto-light">Temp:</span>
                                <span className="roboto-medium font-semibold">{lastReading ? `${lastReading.temperature}°C` : '--'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Droplets size={14} className="text-emerald-500" />
                                <span className="roboto-light">Hum:</span>
                                <span className="roboto-medium font-semibold">{lastReading ? `${lastReading.humidity}%` : '--'}</span>
                              </div>
                            </div>

                            {/* Graph */}
                            <div className="p-4 bg-white">
                              <ReactECharts
                                ref={el => { houseChartRefs.current[house] = el; }}
                                option={buildChartOption(house, houseColor)}
                                style={{ height: 220, width: '100%' }}
                                opts={{ renderer: 'svg' }}
                                notMerge={true}
                              />
                            </div>

                            {/* Statistics */}
                            <div className="p-5 border-t border-slate-100 bg-slate-50/30 grid grid-cols-2 gap-4">
                              <div className="col-span-2 border-b border-slate-100 pb-3 flex items-baseline justify-between">
                                <span className="roboto-light text-xs text-slate-500">Live Gas Level</span>
                                <div className="flex items-baseline gap-1 text-slate-800">
                                  <span className="roboto-thin text-4xl leading-none font-bold tracking-tight">
                                    {current}
                                  </span>
                                  <span className="roboto-light text-xs uppercase text-slate-400">ppm</span>
                                </div>
                              </div>
                              
                              <div className="space-y-0.5">
                                <span className="roboto-light text-[10px] text-slate-400 uppercase tracking-wider block">Session Peak</span>
                                <span className="roboto-medium text-slate-700 text-sm font-semibold">{peak} ppm</span>
                              </div>

                              <div className="space-y-0.5">
                                <span className="roboto-light text-[10px] text-slate-400 uppercase tracking-wider block">Session Avg</span>
                                <span className="roboto-medium text-slate-700 text-sm font-semibold">{avg} ppm</span>
                              </div>

                              <div className="col-span-2 border-t border-slate-100 pt-3 flex items-center justify-between">
                                <span className="roboto-light text-xs text-slate-500">Clearance Rate</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-emerald-500"
                                      style={{ width: `${clearanceRate}%` }}
                                    />
                                  </div>
                                  <span className="roboto-medium text-xs font-semibold text-slate-700">{clearanceRate}%</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* 2. SIMULATION LAB TAB */}
            {activeTab === 'simulation' && (
              <motion.div
                key="sim-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                
                {/* Simulation Control Card */}
                <div className="glass-card p-6 flex flex-col sm:flex-row items-center justify-between gap-5 border border-emerald-100">
                  <div className="space-y-1">
                    <h2 className="garamond-title-lg text-slate-800">Simulation Laboratory</h2>
                    <p className="roboto-thin text-xs text-slate-400">
                      Adjust parameters to understand gas clearance kinetics without hardware
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={triggerSimSpray}
                      className="btn-glass bg-emerald-500 border-emerald-500 text-slate-900 font-semibold hover:bg-emerald-600 hover:text-slate-950 flex items-center gap-2 shadow-sm shadow-emerald-200"
                    >
                      <Flame size={15} className="animate-bounce" />
                      <span>Inject VOC (Perfume/Smoke)</span>
                    </button>
                    
                    <button onClick={resetSim} className="btn-glass flex items-center gap-1.5">
                      <RotateCcw size={13} />
                      <span>Reset Simulator</span>
                    </button>

                    <button onClick={downloadSessionReport} className="btn-glass flex items-center gap-1.5">
                      <FileSpreadsheet size={13} />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Physics Controls Card (Enlarged and optimized) */}
                <div className="glass-card glass-card-accent p-6 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-6 border border-emerald-100">
                  
                  {/* Fan Speed Controls */}
                  <div className="space-y-3">
                    <h4 className="roboto-medium text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <Wind size={16} className="text-emerald-600 animate-spin" style={{ animationDuration: simFanSpeed === 2 ? '1s' : simFanSpeed === 1 ? '3s' : '0s' }} />
                      Exhaust Fan Speed
                    </h4>
                    
                    <div className="flex flex-col gap-2.5">
                      {[
                        { level: 0, label: 'Fan Off (Closed House)', desc: 'Poor Ventilation / High VOC' },
                        { level: 1, label: 'Fan Low (Semi-Ventilated)', desc: 'Moderate Air Exchange' },
                        { level: 2, label: 'Fan High (Fully Ventilated)', desc: 'Rapid Exhaust Displacement' }
                      ].map(opt => (
                        <label
                          key={opt.level}
                          onClick={() => setSimFanSpeed(opt.level)}
                          className={`flex items-center justify-between p-4 rounded-xl border text-sm cursor-pointer transition-all ${
                            simFanSpeed === opt.level
                              ? 'bg-white border-emerald-400 text-emerald-800 font-semibold shadow-sm'
                              : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="fanSpeed"
                              checked={simFanSpeed === opt.level}
                              onChange={() => {}}
                              className="accent-emerald-500 w-4 h-4"
                            />
                            <span className="text-sm font-medium">{opt.label}</span>
                          </div>
                          <span className="text-xs text-slate-400 font-light">{opt.desc}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Environment Readout */}
                  <div className="space-y-3">
                    <h4 className="roboto-medium text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <Activity size={16} className="text-emerald-600" />
                      Simulated Environment
                    </h4>
                    
                    <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200/60">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="roboto-light text-xs text-slate-500">Air Temperature</span>
                          <span className="roboto-medium font-semibold text-sm text-slate-700">{simTemp}°C</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, (simTemp / 50) * 100))}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="roboto-light text-xs text-slate-500">Relative Humidity</span>
                          <span className="roboto-medium font-semibold text-sm text-slate-700">{simHum}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${simHum}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="roboto-light text-xs text-slate-500">Exhaust status</span>
                        <span className="roboto-medium font-bold text-sm text-emerald-600">
                          {simClearanceStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Kinetics Statistics */}
                  <div className="space-y-3">
                    <h4 className="roboto-medium text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <Sliders size={16} className="text-emerald-600" />
                      Live Kinetics Statistics
                    </h4>
                    
                    <div className="bg-white p-5 rounded-xl border border-slate-200/60 space-y-3.5">
                      {/* Live VOC Readout */}
                      <div className="space-y-1.5 border-b border-slate-100 pb-2.5">
                        <div className="flex items-baseline justify-between">
                          <span className="roboto-light text-xs text-slate-500">Live VOC Level</span>
                          <div className="flex items-baseline gap-1 text-emerald-700 font-bold">
                            <span className="roboto-thin text-3xl font-extrabold leading-none tracking-tight">
                              {simGasLevel}
                            </span>
                            <span className="roboto-light text-xs uppercase text-slate-400">ppm</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              simGasLevel > 700 ? 'bg-rose-500 animate-pulse' : simGasLevel > 400 ? 'bg-amber-500' : 'bg-emerald-400'
                            }`} 
                            style={{ width: `${Math.min(100, Math.max(0, (simGasLevel / 1100) * 100))}%` }} 
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 border-b border-slate-50 pb-2">
                        <div className="flex items-baseline justify-between">
                          <span className="roboto-light text-xs text-slate-500">Peak VOC Observed</span>
                          <span className="roboto-medium text-sm font-semibold text-slate-800">{simPeak} ppm</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-400 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, (simPeak / 1100) * 100))}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="roboto-light text-xs text-slate-500">Clearance Index</span>
                          <span className="roboto-medium text-sm font-semibold text-slate-800">{simClearanceRate}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${simClearanceRate}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Single Big Graph Card (Completely occupies the remaining space) */}
                <div className="glass-card glass-card-accent p-6 bg-white border border-emerald-100 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="garamond-title-lg text-slate-800">Live Volatile Organic Compound PPM Plot</h3>
                      <p className="roboto-thin text-xs text-slate-400">Single large monitor for demonstrations and projections</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="roboto-light text-xs text-emerald-800 uppercase tracking-widest font-semibold">Simulator Active</span>
                    </div>
                  </div>

                  {/* Big ECharts Graph viewport */}
                  <div className="p-2">
                    <ReactECharts
                      ref={simChartRef}
                      option={buildSimChartOption()}
                      style={{ height: 390, width: '100%' }}
                      opts={{ renderer: 'svg' }}
                      notMerge={true}
                    />
                  </div>
                </div>

              </motion.div>
            )}

            {/* 3. EVENT LOGS TAB */}
            {activeTab === 'logs' && (
              <motion.div
                key="logs-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-card p-6 border border-emerald-100 space-y-4 min-h-[450px] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="garamond-title-lg text-slate-800 flex items-center gap-2">
                      <Terminal size={18} className="text-emerald-600" />
                      Experiment Event Console Logs
                    </h2>
                    <p className="roboto-thin text-xs text-slate-400">Chronological history of sensor readings and anomalies</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={downloadSessionReport} className="btn-glass flex items-center gap-1.5">
                      <FileSpreadsheet size={13} />
                      <span>Download Logs Report</span>
                    </button>
                  </div>
                </div>

                {/* Log List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[400px]">
                  {logs.length > 0 ? (
                    logs.map(log => {
                      let alertClass = 'bg-slate-50 text-slate-600 border-slate-100';
                      if (log.severity === 'warning') alertClass = 'bg-amber-50 text-amber-800 border-amber-200';
                      if (log.severity === 'error') alertClass = 'bg-rose-50 text-rose-800 border-rose-200';
                      if (log.severity === 'success') alertClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';

                      return (
                        <div key={log.id} className={`p-3 rounded-xl border text-xs flex items-start gap-3.5 ${alertClass} animate-fade-in`}>
                          <span className="roboto-light text-[10px] text-slate-400 select-none pt-0.5">
                            {new Date(log.timestamp).toLocaleTimeString('en-IN')}
                          </span>
                          <div className="flex-1">
                            {log.house && log.house !== 'System' && (
                              <span className="roboto-medium font-bold mr-1.5">{log.house}:</span>
                            )}
                            <span className="roboto-light">{log.message}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-slate-300 gap-2">
                      <Terminal size={24} />
                      <span className="roboto-thin text-xs">Waiting for events to log. Run the simulator or connect hardware to write logs.</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* 4. SETUP & FIRMWARE TAB */}
            {activeTab === 'firmware' && (
              <motion.div
                key="firmware-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                
                {/* Code display (Left 2 Columns) */}
                <div className="lg:col-span-2 glass-card p-6 border border-emerald-100 flex flex-col justify-between h-[520px]">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <h2 className="garamond-title-lg text-slate-800 flex items-center gap-2">
                        <Cpu size={18} className="text-emerald-600" />
                        ESP32 Firmware Source Code
                      </h2>
                      <p className="roboto-thin text-xs text-slate-400">Preconfigured Arduino sketch with wifi credentials</p>
                    </div>

                    <button
                      onClick={handleCopyCode}
                      className="btn-glass py-1.5 px-4 flex items-center gap-1.5 border-slate-200 text-xs shadow-sm"
                    >
                      {copiedCode ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span className="roboto-medium">{copiedCode ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto bg-slate-900 text-emerald-400 p-4 rounded-xl text-[11px] font-mono leading-relaxed select-all">
                    <pre>{ESP32_CODE}</pre>
                  </div>
                </div>

                {/* Instructions (Right 1 Column) */}
                <div className="glass-card p-6 border border-emerald-100 space-y-4">
                  <h3 className="garamond-title-lg text-emerald-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Sliders size={18} />
                    How to Setup Hardware
                  </h3>

                  <div className="space-y-4 text-xs text-slate-600 leading-relaxed roboto-light">
                    <p>
                      Follow these simple steps to connect and configure your physical microcontroller node:
                    </p>

                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                        <p>
                          Open <strong className="roboto-regular">Arduino IDE</strong>, install ESP32 support board libraries, and download DHT sensor libraries.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                        <p>
                          Wire DHT11 to Pin <strong className="roboto-regular">D2</strong> and the Analog output (A0) of the MQ-2 sensor to Pin <strong className="roboto-regular">D35</strong>.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                        <p>
                          Uncomment the correct <strong className="roboto-regular">#define HOUSE_TYPE</strong> string matching the house that ESP is deployed in (Fully Ventilated, Semi-Ventilated, or Closed).
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0">4</span>
                        <p>
                          Replace the placeholder IP in the <strong className="roboto-regular">serverName</strong> string with your local server host computer IP, and click flash upload.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                      <Wifi size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800">
                        <strong>Note</strong>: The nodes will automatically look for SSID <strong>"Madhur"</strong> and password <strong>"qwertyuiop"</strong> to log data.
                      </p>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* 5. PROJECT INFO TAB */}
            {activeTab === 'info' && (
              <motion.div
                key="info-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in"
              >
                {/* Objective Card */}
                <div className="glass-card p-6 border border-emerald-100 space-y-4">
                  <h3 className="garamond-title-lg text-emerald-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <HelpCircle size={20} />
                    Project Overview
                  </h3>
                  
                  <div className="space-y-3.5 text-sm text-slate-600 leading-relaxed roboto-light">
                    <p>
                      <strong>AeroSense IQ</strong> is an IoT-based ventilation monitoring platform built to compare air exchange efficiency in different indoor layouts:
                    </p>
                    
                    <ul className="list-disc pl-4 space-y-2">
                      <li>
                        <strong className="roboto-regular text-slate-700">Fully Ventilated Room</strong>: Features high continuous airflow, dissolving airborne gases rapidly.
                      </li>
                      <li>
                        <strong className="roboto-regular text-slate-700">Semi-Ventilated Room</strong>: Limited air displacement, resulting in slow gas dispersion.
                      </li>
                      <li>
                        <strong className="roboto-regular text-slate-700">Closed Room</strong>: Stagnant volume where gases settle, creating heavy VOC congestion.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Physics Formula Card */}
                <div className="glass-card p-6 border border-emerald-100 space-y-4">
                  <h3 className="garamond-title-lg text-emerald-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <Wind size={20} />
                    Gas Decay Physics
                  </h3>

                  <div className="space-y-4 text-sm text-slate-600 leading-relaxed roboto-light">
                    <p>
                      The dispersion profile of an injected organic volatile compound (like perfume spray) fits the classic exponential decay model:
                    </p>
                    
                    <div className="p-3 bg-slate-50 border border-emerald-100 rounded-lg text-center font-mono text-xs font-bold text-emerald-800 select-all">
                      C(t) = C_baseline + (C_peak - C_baseline) * e^(-k * t)
                    </div>

                    <p>
                      Where:
                      <br />• <strong className="roboto-regular">C(t)</strong>: Live Concentration in PPM
                      <br />• <strong className="roboto-regular">k</strong>: Air Exchange Clearance Coefficient
                      <br />• <strong className="roboto-regular">t</strong>: Elapsed Time in seconds
                    </p>
                    
                    <p className="border-t border-slate-100 pt-3 font-light text-xs text-slate-400">
                      💡 With High Fan speed, k increases. In a Closed layout, k approaches 0 causing persistent high ppm.
                    </p>
                  </div>
                </div>

                {/* Sensor Info */}
                <div className="glass-card p-6 border border-emerald-100 space-y-4">
                  <h3 className="garamond-title-lg text-emerald-800 flex items-center gap-2.5 border-b border-slate-100 pb-3">
                    <Cpu size={20} />
                    Sensor Integration
                  </h3>

                  <div className="space-y-4 text-sm text-slate-600 leading-relaxed roboto-light">
                    <p>
                      Each room node contains:
                    </p>
                    <ul className="list-disc pl-4 space-y-2.5">
                      <li>
                        <strong className="roboto-regular text-slate-700">MQ-2 Gas Sensor</strong> connected to analog Pin D35, providing sensitive readings of smoke and combustible organic VOCs.
                      </li>
                      <li>
                        <strong className="roboto-regular text-slate-700">DHT11 Sensor</strong> connected to digital Pin D2, measuring room temperature & humidity profiles.
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
