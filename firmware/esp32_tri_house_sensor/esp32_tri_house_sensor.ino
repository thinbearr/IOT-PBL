// ========================================================
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
const char* serverName = "http://172.20.10.2:8000/api/sensor-data"; 

// --- House Identifier Config (Uncomment ONLY one) ---
// #define HOUSE_TYPE "Fully Ventilated"
// #define HOUSE_TYPE "Semi-Ventilated"
#define HOUSE_TYPE "Closed"

// --- Pin Assignments ---
#define DHTPIN 4      // DHT11 sensor data connected to pin D4
#define DHTTYPE DHT11 // Sensor type
#define MQ2PIN 35     // MQ-2 Analog A0 output connected to pin D35 (ADC1_CH6)
#define LEDPIN 2      // GPIO 2 is also the built-in blue LED for alert indicator

DHT dht(DHTPIN, DHTTYPE);

unsigned long lastTime = 0;
unsigned long timerDelay = 200; // Poll and send data every 0.2 seconds

unsigned long lastDhtTime = 0;
float cachedT = 0.0;
float cachedH = 0.0;

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
      
      if (millis() - lastDhtTime >= 2000 || lastDhtTime == 0) {
        cachedT = dht.readTemperature();
        cachedH = dht.readHumidity();
        lastDhtTime = millis();
      }
      
      int rawGasValue = analogRead(MQ2PIN); // Reads 0 to 4095
      Serial.print("RAW GAS ANALOG READING: ");
      Serial.println(rawGasValue);
      
      // --- Sensor Calibration ---
      float multiplier = 1.0;
      int offset = 0;
      
      // Target Baseline: ~100 | Target Peak: ~2000
      if (String(HOUSE_TYPE) == "Fully Ventilated") {
        multiplier = 0.656;
        offset = 100;
      } else if (String(HOUSE_TYPE) == "Semi-Ventilated") {
        multiplier = 1.078;
        offset = 84;
      } else if (String(HOUSE_TYPE) == "Closed") {
        multiplier = 1.055;
        offset = -48;
      }
      
      int gasValue = (rawGasValue * multiplier) + offset;
      if (gasValue < 0) gasValue = 0; // Prevent negative readings
      
      // Error checking for DHT sensor
      if (isnan(cachedT) || isnan(cachedH)) {
        Serial.println("Error: Failed to read from DHT sensor!");
        // We still continue to send gas data even if DHT fails temporarily
      }

      // Check if Gas exceeds standard congestion threshold (700 on a 4095 range)
      // Turn on built-in LED if congestion detected
      if (gasValue > 700) {
        digitalWrite(LEDPIN, HIGH);
      } else {
        digitalWrite(LEDPIN, LOW);
      }

      // Format JSON payload
      String jsonPayload = "{\"house_id\": \"";
      jsonPayload += HOUSE_TYPE;
      jsonPayload += "\", \"temperature\": ";
      jsonPayload += String(isnan(cachedT) ? 0 : cachedT);
      jsonPayload += ", \"humidity\": ";
      jsonPayload += String(isnan(cachedH) ? 0 : cachedH);
      jsonPayload += ", \"gas\": ";
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
