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
      String jsonPayload = "{\"house_id\": \"";
      jsonPayload += HOUSE_TYPE;
      jsonPayload += "\", \"temperature\": ";
      jsonPayload += String(t);
      jsonPayload += ", \"humidity\": ";
      jsonPayload += String(h);
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
