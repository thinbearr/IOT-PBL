import asyncio
import json
import logging
import time
from typing import List, Dict, Any, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MultiHouseBackend")

app = FastAPI(title="Multi-House Environment API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_websockets: Set[WebSocket] = set()

# In-memory storage for the latest data from each house, and historical data
data_history: Dict[str, List[Dict[str, Any]]] = {
    "Fully Ventilated": [],
    "Semi-Ventilated": [],
    "Closed": []
}

HISTORY_LIMIT = 50 # Keep the last 50 readings per house

class SensorData(BaseModel):
    house_id: str
    temperature: float
    humidity: float
    gas: int

async def broadcast_data(data: dict):
    message_str = json.dumps(data)
    disconnected = set()
    for ws in list(active_websockets):
        try:
            await ws.send_text(message_str)
        except Exception:
            disconnected.add(ws)
    
    for ws in disconnected:
        active_websockets.discard(ws)

@app.post("/api/sensor-data")
async def receive_sensor_data(data: SensorData):
    house_id = data.house_id
    if house_id not in data_history:
        data_history[house_id] = []
        
    reading = {
        "timestamp": time.time(),
        "temperature": data.temperature,
        "humidity": data.humidity,
        "gas": data.gas
    }
    
    data_history[house_id].append(reading)
    if len(data_history[house_id]) > HISTORY_LIMIT:
        data_history[house_id].pop(0)
        
    logger.info(f"Received data from {house_id}: Temp={data.temperature}, Hum={data.humidity}, Gas={data.gas}")
    
    # Broadcast to websocket clients
    payload = {
        "type": "NEW_READING",
        "house_id": house_id,
        "data": reading
    }
    await broadcast_data(payload)
    
    return {"status": "success"}

@app.get("/api/history")
def get_history():
    return data_history

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.add(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(active_websockets)}")
    
    # Send current history immediately
    await websocket.send_text(json.dumps({
        "type": "HISTORY",
        "data": data_history
    }))
    
    try:
        while True:
            # We don't expect messages from the frontend but we need to keep connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        active_websockets.discard(websocket)
        logger.info(f"WebSocket client disconnected. Remaining: {len(active_websockets)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
