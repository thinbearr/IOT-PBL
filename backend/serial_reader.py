import time
import json
import logging
import serial
import serial.tools.list_ports
import threading
from typing import Callable, Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SerialReader")

class SerialReader:
    def __init__(self, port: str = "AUTO", baudrate: int = 115200, callback: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.port_config = port
        self.baudrate = baudrate
        self.callback = callback
        
        self.serial_conn: Optional[serial.Serial] = None
        self.running = False
        self.connected = False
        self.thread: Optional[threading.Thread] = None
        self.active_port: Optional[str] = None
        
    def find_com_port(self) -> Optional[str]:
        """Automatically search for available COM ports."""
        if self.port_config != "AUTO":
            return self.port_config
            
        ports = serial.tools.list_ports.comports()
        if not ports:
            return None
            
        # Priority 1: Ports containing common microcontroller descriptions
        for p in ports:
            desc = p.description.lower()
            hwid = p.hwid.lower()
            if any(term in desc or term in hwid for term in ["usb", "uart", "serial", "ch340", "cp210", "ftdi", "arduino"]):
                logger.info(f"Auto-detected microcontroller port: {p.device} ({p.description})")
                return p.device
                
        # Priority 2: Just return the first available port
        logger.info(f"No specific microcontroller device found. Selecting first port: {ports[0].device}")
        return ports[0].device

    def start(self):
        """Starts the serial reading background thread."""
        if self.running:
            logger.info("Serial reader already running.")
            return
        self.running = True
        self.thread = threading.Thread(target=self.run_loop, name="SerialReaderThread", daemon=True)
        self.thread.start()
        logger.info("Serial reader background thread started.")

    def stop(self):
        """Stops the serial reader thread and closes connection."""
        if not self.running:
            return
        self.running = False
        self.close_connection()
        if self.thread:
            try:
                self.thread.join(timeout=2.0)
            except Exception as e:
                logger.error(f"Error joining serial thread: {e}")
            self.thread = None
        logger.info("Serial reader background thread stopped.")

    def close_connection(self):
        """Safely closes the serial connection."""
        self.connected = False
        if self.serial_conn and self.serial_conn.is_open:
            try:
                self.serial_conn.close()
                logger.info(f"Closed serial connection on {self.active_port}")
            except Exception as e:
                logger.error(f"Error closing serial port: {e}")
        self.serial_conn = None

    def run_loop(self):
        """Main loop that manages connection and reads lines."""
        while self.running:
            if not self.connected:
                # Attempt to find and connect to COM port
                port = self.find_com_port()
                if not port:
                    logger.debug("No COM port available. Retrying in 3 seconds...")
                    time.sleep(3.0)
                    continue
                    
                self.active_port = port
                try:
                    logger.info(f"Attempting to connect to serial port: {port} at {self.baudrate} baud...")
                    self.serial_conn = serial.Serial(port, self.baudrate, timeout=1.0)
                    self.connected = True
                    logger.info(f"Successfully connected to serial port: {port}")
                except Exception as e:
                    logger.error(f"Failed to connect to serial port {port}: {e}. Retrying in 5 seconds...")
                    self.connected = False
                    self.serial_conn = None
                    time.sleep(5.0)
                    continue

            # Read lines from serial
            try:
                if self.serial_conn and self.serial_conn.is_open:
                    line = self.serial_conn.readline()
                    if not line:
                        continue  # Timeout occurred, try again
                        
                    # Decode and parse line
                    try:
                        decoded_line = line.decode("utf-8", errors="ignore").strip()
                        if not decoded_line:
                            continue
                            
                        # Check if it looks like JSON
                        if decoded_line.startswith("{") and decoded_line.endswith("}"):
                            packet = json.loads(decoded_line)
                            
                            # Validate required fields
                            if "gas" in packet and ("temp" in packet or "temperature" in packet):
                                # Normalize key names
                                normalized_packet = {
                                    "gas": float(packet["gas"]),
                                    "temp": float(packet.get("temp", packet.get("temperature", 25.0))),
                                    "hum": float(packet.get("hum", packet.get("humidity", 50.0))),
                                    "timestamp": float(packet.get("timestamp", time.time()))
                                }
                                
                                # Send packet to callback if configured
                                if self.callback:
                                    self.callback(normalized_packet)
                            else:
                                logger.warning(f"Received JSON missing required fields: {decoded_line}")
                        else:
                            logger.debug(f"Received non-JSON raw serial data: {decoded_line}")
                    except json.JSONDecodeError:
                        logger.debug(f"Failed to parse serial line as JSON: {line}")
                    except Exception as parse_err:
                        logger.error(f"Error parsing serial data: {parse_err}")
            except Exception as read_err:
                logger.error(f"Error reading from serial connection on {self.active_port}: {read_err}")
                self.close_connection()
                time.sleep(2.0)

def get_available_ports():
    """Returns a list of all active serial ports on the host system."""
    ports = serial.tools.list_ports.comports()
    return [{"device": p.device, "description": p.description} for p in ports]
