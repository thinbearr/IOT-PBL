import asyncio
import json
import os
import time
import logging
from typing import List, Dict, Any, Set, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from scientific_processor import ScientificProcessor
from mock_stream import MockStreamGenerator
from serial_reader import SerialReader, get_available_ports
active_zone = "Zone A"
# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AeroSenseBackend")

# Load configuration
config_path = os.path.join(os.path.dirname(__file__), "config.json")
config = {
    "serial": {"port": "AUTO", "baudrate": 115200, "timeout": 1.0},
    "simulation": {"enabled": True, "fan_on": False, "sampling_interval_sec": 1.0},
    "scientific": {"baseline_window_sec": 300, "decay_fit_duration_sec": 120}
}

if os.path.exists(config_path):
    try:
        with open(config_path, "r") as f:
            config.update(json.load(f))
        logger.info("Configuration loaded from config.json")
    except Exception as e:
        logger.error(f"Error reading config.json, using defaults: {e}")

# FastAPI App initialization
app = FastAPI(title="AeroSense API", description="VOC Decay Airflow Analyzer Backend")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSockets clients
active_websockets: Set[WebSocket] = set()

# Initialize core processor and mock generator
processor = ScientificProcessor(
    baseline_window_sec=config["scientific"]["baseline_window_sec"],
    decay_fit_duration_sec=config["scientific"]["decay_fit_duration_sec"]
)
mock_generator = MockStreamGenerator(
    sampling_interval=config["simulation"]["sampling_interval_sec"]
)

# Sequential multi-zone testing states
zone_data = {
    "Zone A": {"stagnation_score": 0.0, "tau": None, "ach": None, "quality": "No Data", "last_updated": None},
    "Zone B": {"stagnation_score": 0.0, "tau": None, "ach": None, "quality": "No Data", "last_updated": None},
    "Zone C": {"stagnation_score": 0.0, "tau": None, "ach": None, "quality": "No Data", "last_updated": None},
    "Corridor": {"stagnation_score": 0.0, "tau": None, "ach": None, "quality": "No Data", "last_updated": None}
}
active_zone = "Zone A"

# Application state variables
use_simulation = config["simulation"]["enabled"]
fan_state = config["simulation"]["fan_on"]
mock_generator.set_fan(fan_state)

serial_reader: Optional[SerialReader] = None
serial_loop_task: Optional[asyncio.Task] = None
simulation_loop_task: Optional[asyncio.Task] = None
hardware_monitor_task: Optional[asyncio.Task] = None
event_loop = None

async def hardware_monitor_loop():
    global use_simulation
    logger.info("Hardware monitor loop started.")
    live_disconnect_timer = 0
    while True:
        try:
            await asyncio.sleep(1.0)
            if not use_simulation:
                # We are in LIVE mode
                if not (serial_reader and serial_reader.connected):
                    live_disconnect_timer += 1
                    # If disconnected/searching for more than 10 seconds, fallback
                    if live_disconnect_timer >= 10:
                        logger.warning("Hardware unavailable or disconnected. Falling back to Simulation Mode.")
                        use_simulation = True
                        if serial_reader:
                            serial_reader.stop()
                        live_disconnect_timer = 0
                        # Broadcast status update to all connected dashboard clients
                        await send_to_all(json.dumps({
                            "type": "STATUS_UPDATE",
                            "status": {
                                "mode": "SIMULATION",
                                "fan_on": fan_state,
                                "serial_connected": False,
                                "serial_port": None,
                                "fallback_triggered": True
                            }
                        }))
                else:
                    live_disconnect_timer = 0
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in hardware monitor loop: {e}")

def broadcast_data(processed_packet: Dict[str, Any]):
    """Helper to send processed packet to all connected clients."""
    payload = {
        "type": "TELEMETRY",
        "data": processed_packet,
        "active_zone": active_zone,
        "zone_data": zone_data,
        "system_status": {
            "mode": "SIMULATION" if use_simulation else "LIVE_ESP",
            "fan_on": fan_state,
            "serial_connected": serial_reader.connected if serial_reader else False,
            "serial_port": serial_reader.active_port if (serial_reader and serial_reader.connected) else None,
            "sampling_frequency_hz": round(1.0 / config["simulation"]["sampling_interval_sec"], 1),
            "timestamp": time.time()
        }
    }
    
    # Broadcast asynchronously
    if active_websockets:
        message_str = json.dumps(payload)
        # Use asyncio.run_coroutine_threadsafe if called from the serial thread
        if event_loop and event_loop.is_running():
            asyncio.run_coroutine_threadsafe(
                send_to_all(message_str),
                event_loop
            )

async def send_to_all(message: str):
    """Coro to send message to all sockets."""
    for ws in list(active_websockets):
        try:
            await ws.send_text(message)
        except Exception:
            active_websockets.remove(ws)

def handle_serial_packet(packet: Dict[str, float]):
    """Callback for SerialReader packets."""
    # Process packet through scientific module
    processed = processor.process_packet(packet)
    # Broadcast to clients
    broadcast_data(processed)

# Initialize Serial Reader (but don't start it unless simulation is disabled)
serial_reader = SerialReader(
    port=config["serial"]["port"],
    baudrate=config["serial"]["baudrate"],
    callback=handle_serial_packet
)

async def simulation_loop():
    """Background task to simulate sensor data and stream it."""
    logger.info("Simulation loop started.")
    while True:
        try:
            if use_simulation:
                packet = mock_generator.next_sample()
                processed = processor.process_packet(packet)
                broadcast_data(processed)
            await asyncio.sleep(config["simulation"]["sampling_interval_sec"])
        except asyncio.CancelledError:
            logger.info("Simulation loop cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in simulation loop: {e}")
            await asyncio.sleep(1.0)

@app.on_event("startup")
async def startup_event():
    global event_loop, simulation_loop_task, hardware_monitor_task
    event_loop = asyncio.get_running_loop()
    
    # Start the simulation loop by default
    simulation_loop_task = asyncio.create_task(simulation_loop())
    
    # Start the hardware monitor loop
    hardware_monitor_task = asyncio.create_task(hardware_monitor_loop())
    
    # Start serial reader if not in simulation mode
    if not use_simulation:
        logger.info("Starting serial reader...")
        serial_reader.start()

@app.on_event("shutdown")
async def shutdown_event():
    global simulation_loop_task, hardware_monitor_task
    if simulation_loop_task:
        simulation_loop_task.cancel()
    if hardware_monitor_task:
        hardware_monitor_task.cancel()
    if serial_reader:
        serial_reader.stop()

@app.get("/status")
def get_status():
    return {
        "mode": "SIMULATION" if use_simulation else "LIVE_ESP",
        "fan_on": fan_state,
        "serial_connected": serial_reader.connected if serial_reader else False,
        "serial_port": serial_reader.active_port if (serial_reader and serial_reader.connected) else None,
        "tau_seconds": processor.tau,
        "baseline": processor.baseline,
        "stagnation_score": processor.stagnation_score,
        "ventilation_quality": processor.ventilation_quality,
        "ach": processor.ach
    }

# Pydantic schema for REST endpoint
class SwitchModeRequest(BaseModel):
    mode: str  # "SIMULATION" or "LIVE"
    port: Optional[str] = "AUTO"

@app.get("/available-ports")
def api_available_ports():
    return get_available_ports()

class SetZoneRequest(BaseModel):
    zone: str

@app.post("/set-active-zone")
def api_set_active_zone(req: SetZoneRequest):
    global active_zone, zone_data
    if req.zone not in zone_data:
        return {"status": "error", "message": "Invalid zone"}
    
    if processor:
        zone_data[active_zone] = {
            "stagnation_score": processor.stagnation_score,
            "tau": processor.tau,
            "ach": processor.ach,
            "quality": processor.ventilation_quality,
            "last_updated": time.time()
        }
        # Reset decay processor states for clean restart
        processor.state = "IDLE"
        processor.decay_data_points = []
        processor.injection_timestamp = None
        processor.decay_start_timestamp = None
        processor.c_max = 0.0
        
    active_zone = req.zone
    logger.info(f"Active instrumentation zone switched to: {active_zone}")
    
    # Broadcast change immediately
    if event_loop and event_loop.is_running():
        asyncio.run_coroutine_threadsafe(
            send_to_all(json.dumps({
                "type": "STATUS_UPDATE",
                "active_zone": active_zone,
                "zone_data": zone_data,
                "status": {
                    "mode": "SIMULATION" if use_simulation else "LIVE_ESP",
                    "fan_on": fan_state,
                    "serial_connected": serial_reader.connected if serial_reader else False,
                    "serial_port": serial_reader.active_port if (serial_reader and serial_reader.connected) else None,
                    "baseline": processor.baseline
                }
            })),
            event_loop
        )
        
    return {
        "status": "success",
        "active_zone": active_zone,
        "zone_data": zone_data
    }

@app.post("/switch-mode")
def api_switch_mode(req: SwitchModeRequest):
    global use_simulation, serial_reader
    
    if req.mode == "SIMULATION":
        use_simulation = True
        if serial_reader:
            serial_reader.stop()
        logger.info("Switched to SIMULATION mode via REST API.")
    elif req.mode == "LIVE":
        use_simulation = False
        if serial_reader:
            serial_reader.stop()
            serial_reader.port_config = req.port if req.port else "AUTO"
            serial_reader.start()
        logger.info(f"Switched to LIVE mode via REST API (port: {req.port}).")
        
    status_msg = "Simulation Active"
    if not use_simulation:
        if serial_reader and serial_reader.connected:
            status_msg = "Streaming Live Data"
        else:
            status_msg = "Searching for hardware..."
            
    return {
        "status": "success",
        "mode": "SIMULATION" if use_simulation else "LIVE_ESP",
        "port": serial_reader.active_port if (serial_reader and serial_reader.connected) else None,
        "serial_connected": serial_reader.connected if serial_reader else False,
        "status_message": status_msg
    }

@app.get("/hardware-status")
def api_hardware_status():
    ports = get_available_ports()
    
    status_msg = "Simulation Active"
    if not use_simulation:
        if serial_reader:
            if serial_reader.connected:
                status_msg = "Streaming Live Data"
            elif serial_reader.running:
                status_msg = "Searching for hardware..."
            else:
                status_msg = "Hardware Disconnected"
        else:
            status_msg = "Hardware Disconnected"
            
    serial_conn = serial_reader.connected if serial_reader else False
    return {
        "mode": "SIMULATION" if use_simulation else "LIVE_ESP",
        "serial_connected": serial_conn,
        "serial_port": serial_reader.active_port if (serial_reader and serial_conn) else None,
        "fan_on": fan_state,
        "status_message": status_msg,
        "available_ports": ports
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global use_simulation, fan_state, active_zone, zone_data
    await websocket.accept()
    active_websockets.add(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(active_websockets)}")
    
    # Send current status immediately upon connection
    await websocket.send_text(json.dumps({
        "type": "STATUS",
        "active_zone": active_zone,
        "zone_data": zone_data,
        "data": {
            "mode": "SIMULATION" if use_simulation else "LIVE_ESP",
            "fan_on": fan_state,
            "serial_connected": serial_reader.connected if serial_reader else False,
            "serial_port": serial_reader.active_port if (serial_reader and serial_reader.connected) else None,
            "baseline": processor.baseline,
            "stagnation_score": processor.stagnation_score,
            "ventilation_quality": processor.ventilation_quality
        }
    }))
    
    try:
        while True:
            # Read messages from the client
            data = await websocket.receive_text()
            try:
                cmd_packet = json.loads(data)
                cmd = cmd_packet.get("command")
                
                if cmd == "SET_MODE":
                    mode = cmd_packet.get("mode") # "SIMULATION" or "LIVE"
                    target_port = cmd_packet.get("port", "AUTO")
                    if mode == "SIMULATION":
                        use_simulation = True
                        serial_reader.stop()
                        logger.info("Switched to SIMULATION mode.")
                    else:
                        use_simulation = False
                        serial_reader.stop()
                        serial_reader.port_config = target_port
                        serial_reader.start()
                        logger.info(f"Switched to LIVE ESP mode on port: {target_port}")
                        
                elif cmd == "INJECT_EVENT":
                    if use_simulation:
                        mock_generator.trigger_injection()
                        logger.info("Triggered simulated injection event.")
                    else:
                        logger.warning("Injection control can only be commanded in Simulation mode.")
                        # (On physical hardware, user injects gas physically)
                        
                elif cmd == "SET_FAN":
                    state = bool(cmd_packet.get("state"))
                    fan_state = state
                    mock_generator.set_fan(state)
                    logger.info(f"Set fan speed: {'ON' if state else 'OFF'}")
                    
                elif cmd == "RESET_BASELINE":
                    processor.reset_baseline()
                    if use_simulation:
                        mock_generator.reset_baseline()
                    logger.info("Baseline reset triggered.")
                
                elif cmd == "SET_ZONE":
                    zone = cmd_packet.get("zone")
                    if zone in zone_data:
                        if processor:
                            zone_data[active_zone] = {
                                "stagnation_score": processor.stagnation_score,
                                "tau": processor.tau,
                                "ach": processor.ach,
                                "quality": processor.ventilation_quality,
                                "last_updated": time.time()
                            }
                            # Reset processor states
                            processor.state = "IDLE"
                            processor.decay_data_points = []
                            processor.injection_timestamp = None
                            processor.decay_start_timestamp = None
                            processor.c_max = 0.0
                        active_zone = zone
                        logger.info(f"Switched active instrumentation zone via WS to: {active_zone}")
                
                # Send status update acknowledge
                await send_to_all(json.dumps({
                    "type": "STATUS_UPDATE",
                    "active_zone": active_zone,
                    "zone_data": zone_data,
                    "status": {
                        "mode": "SIMULATION" if use_simulation else "LIVE_ESP",
                        "fan_on": fan_state,
                        "serial_connected": serial_reader.connected if serial_reader else False,
                        "serial_port": serial_reader.active_port if (serial_reader and serial_reader.connected) else None,
                        "baseline": processor.baseline
                    }
                }))
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse WebSocket command: {data}")
            except Exception as cmd_err:
                logger.error(f"Error executing command: {cmd_err}")
                
    except WebSocketDisconnect:
        active_websockets.remove(websocket)
        logger.info(f"WebSocket client disconnected. Remaining: {len(active_websockets)}")

if __name__ == "__main__":
    # Start FastAPI server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
