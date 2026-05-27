# AeroSense — VOC Decay Based Airflow Stagnation Analyzer

AeroSense is a research-grade scientific instrumentation dashboard and backend designed for embedded systems and IoT workflows. It monitors indoor air stagnation by observing how quickly VOC (Volatile Organic Compound) gas concentrations decay over time after a pulse injection event. 

Instead of simple static threshold alerts, AeroSense utilizes dynamic temporal modeling (exponential decay curves and least-squares regression) to calculate the room's **Air Changes Per Hour (ACH)** and **Stagnation Score**.

---

## 🛠️ Technology Stack
- **Firmware**: Arduino/ESP32 C++ (utilizing MQ135 and DHT22)
- **Backend**: Python 3.8+, FastAPI, WebSockets (`websockets`), Serial communication (`pyserial`)
- **Frontend**: React (Vite template), Vanilla CSS (Notion/Apple minimal white layout)

---

## 📂 Project Structure
```
IOT PBL/
├── backend/
│   ├── main.py                  # FastAPI server & WebSocket broker
│   ├── scientific_processor.py  # Compensation & Least-squares exponential decay fitting
│   ├── serial_reader.py         # USB COM port auto-detector and reader
│   ├── mock_stream.py           # Simulated room gas physics generator
│   ├── config.json              # Port, baudrate, and fitting settings
│   ├── requirements.txt         # Python dependencies
│   └── start_backend.bat        # Double-click startup script for Windows
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChartComponent.jsx  # SVG Real-time plot (baseline, fitting curve, markers)
│   │   │   ├── MetricGauge.jsx     # Stagnation score circular gauge (0-100)
│   │   │   └── ZoneMap.jsx         # Floor plan layout (Live Zone A + simulated zones)
│   │   ├── App.jsx              # Main React coordinator
│   │   ├── index.css            # Vanilla CSS Design System (light mode)
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── firmware/
│   └── esp32_sensor_sender.ino  # ESP32 source sketch
│
└── README.md                    # Setup & workflow guide
```

---

## 🚀 Local Development Workflow

### 1. Start the Backend
The backend runs a local server that reads either from mock software generators or from USB ports, processes the numbers, and broadcasts to WebSocket clients.

1. Navigate to the `backend` folder.
2. Double-click the **`start_backend.bat`** file.
   * *This script automatically creates a Python virtual environment (`venv`), installs all dependencies from `requirements.txt`, and runs the FastAPI server at `http://127.0.0.1:8000`.*
   * *Alternatively, you can manually run:*
     ```bash
     cd backend
     python -m venv venv
     venv\Scripts\activate
     pip install -r requirements.txt
     python main.py
     ```

### 2. Start the Frontend
1. Open a command prompt, navigate to the `frontend` folder:
   ```cmd
   cd frontend
   ```
2. Install npm modules:
   ```cmd
   npm install
   ```
3. Start the Vite React development server:
   ```cmd
   npm run dev
   ```
4. Open the displayed URL in your browser (usually `http://localhost:5173`).

---

## 🧪 Testing in Simulation Mode (No Hardware Needed)
By default, the dashboard starts in **Simulation Mode** (enabled in `backend/config.json`).
1. Launch the backend and frontend. Open the browser page.
2. Under the **Experiment Control Panel** on the dashboard, you will find active controls:
   - **Inject VOC Marker Event**: Triggers a rapid VOC gas spike (+350 ppm) representing an air tracer injection. It will spike, and then begin an exponential decay.
   - **Exhaust Fan ON/OFF Toggle**:
     - **Fan ON**: Simulates active ventilation. The VOC concentration decays rapidly ($\tau \approx 30$ seconds, Ventilation Quality = *Excellent*, Stagnation Score = *low*).
     - **Fan OFF**: Simulates stagnant air. The VOC concentration decays extremely slowly ($\tau \approx 220$ seconds, Ventilation Quality = *Stagnant*, Stagnation Score = *high*).
3. Observe how the **Real-time Chart** renders:
   - The dark charcoal VOC concentration line.
   - The vertical blue **INJECTION** marker line.
   - The shaded **Analyzed Decay Window** (light orange box).
   - The dotted red **Exponential Fit Overlay** curve representing the regression model.
4. Watch the circular **Stagnation Score** gauge and **Room Map** update dynamically.

---

## 🔌 Connecting Real ESP32 Hardware

To transition from Simulation Mode to a live ESP32 micro-sensor:

### 1. Upload Firmware
1. Open the [esp32_sensor_sender.ino](file:///c:/Users/mayur/Desktop/IOT%20PBL/firmware/esp32_sensor_sender.ino) file in the Arduino IDE.
2. Install the **DHT sensor library** (by Adafruit) via the Library Manager.
3. Connect your ESP32 board to your computer via USB.
4. Select the correct board and port, and click **Upload**.

### 2. Stream to Dashboard
1. Keep the ESP32 connected to the USB port.
2. On the AeroSense Dashboard, look at the **Experiment Control Panel** and click **Enable Live ESP** (or toggle "Live Hardware").
3. The backend will automatically stop the simulation generator, scan your USB ports, locate the microcontroller, and open a 115200 baud serial connection.
4. The dashboard's connection indicator in the top right will change to **Live Streaming** and display the active serial port (e.g., `COM3` or `/dev/ttyUSB0`).
5. Physically introduce a VOC tracer gas spike (e.g., spray rubbing alcohol or use a dry erase marker near the MQ135 sensor) and watch the dashboard auto-detect the injection event and trace the real decay rate!
