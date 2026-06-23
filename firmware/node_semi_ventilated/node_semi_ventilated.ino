#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
// Change this to your backend server's IP address (e.g., http://192.168.1.100:8000/api/sensor-data)
const char* serverName = "http://YOUR_SERVER_IP:8000/api/sensor-data"; 

// --- Pin Assignments ---
#define DHTPIN 2      // DHT sensor connected to GPIO 2
#define DHTTYPE DHT11 // Change to DHT22 if using DHT22
#define MQ2PIN 35     // MQ-2 sensor connected to GPIO 35
#define LEDPIN 2      // Built-in LED for alert indication

// --- House Identifier ---
String HOUSE_ID = "Semi-Ventilated"; 

// --- Thresholds ---
const float TEMP_THRESHOLD = 40.0;
const float HUMIDITY_THRESHOLD = 85.0;
const int GAS_THRESHOLD = 1000;

DHT dht(DHTPIN, DHTTYPE);

unsigned long lastTime = 0;
unsigned long timerDelay = 5000; // Send data every 5 seconds

void setup() {
  Serial.begin(115200);
  pinMode(MQ2PIN, INPUT);
  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW);

  dht.begin();

  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected to WiFi network with IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if ((millis() - lastTime) > timerDelay) {
    if (WiFi.status() == WL_CONNECTED) {
      
      float t = dht.readTemperature();
      float h = dht.readHumidity();
      int gasValue = analogRead(MQ2PIN);
      
      // Check if any reads failed and exit early (to try again).
      if (isnan(t) || isnan(h)) {
        Serial.println("Failed to read from DHT sensor!");
        return;
      }

      // Threshold Checking Logic
      bool alertActive = false;
      if (t > TEMP_THRESHOLD) {
        Serial.println("ALERT: High Temperature!");
        alertActive = true;
      }
      if (h > HUMIDITY_THRESHOLD) {
        Serial.println("ALERT: High Humidity!");
        alertActive = true;
      }
      if (gasValue > GAS_THRESHOLD) {
        Serial.println("ALERT: High Gas Level!");
        alertActive = true;
      }

      // Turn on LED if alert is active
      digitalWrite(LEDPIN, alertActive ? HIGH : LOW);

      // Prepare JSON payload
      String jsonPayload = "{\"house_id\": \"" + HOUSE_ID + "\", ";
      jsonPayload += "\"temperature\": " + String(t) + ", ";
      jsonPayload += "\"humidity\": " + String(h) + ", ";
      jsonPayload += "\"gas\": " + String(gasValue) + "}";

      Serial.print("Sending Data: ");
      Serial.println(jsonPayload);

      // Send HTTP POST
      HTTPClient http;
      http.begin(serverName);
      http.addHeader("Content-Type", "application/json");
      
      int httpResponseCode = http.POST(jsonPayload);
      
      if (httpResponseCode > 0) {
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
      } else {
        Serial.print("Error code: ");
        Serial.println(httpResponseCode);
      }
      
      http.end();
    } else {
      Serial.println("WiFi Disconnected");
    }
    lastTime = millis();
  }
}
