/**
 * AeroSense - ESP32 Serial Telemetry Sender
 * 
 * This sketch reads a MQ135 gas sensor and a DHT22 temperature/humidity sensor,
 * compiles the measurements into a JSON string, and sends it over the USB Serial
 * connection at 115200 baud.
 * 
 * Hardware Setup:
 * - MQ135 Analog Out -> ESP32 GPIO 34 (ADC1_CH6)
 * - DHT22 Data Pin  -> ESP32 GPIO 23 (Pullup resistor recommended)
 * - VCC -> 5V (for MQ135) or 3.3V (for DHT22)
 * - GND -> ESP32 GND
 */

#include <DHT.h>

// Pin Definitions
#define MQ135_PIN 34
#define DHT_PIN 23
#define DHT_TYPE DHT11

// Initialize DHT Sensor
DHT dht(DHT_PIN, DHT_TYPE);

// Sampling Configuration
unsigned long lastSampleTime = 0;
const unsigned long sampleInterval = 1000; // 1 second interval (1 Hz)

void setup() {
  // Initialize Serial USB Connection
  Serial.begin(115200);
  while (!Serial) {
    ; // Wait for serial port to connect (needed for native USB boards)
  }

  // Initialize Sensors
  dht.begin();
  
  // Set ADC attenuation for ESP32 (gives full range 0-3.3V)
  analogSetPinAttenuation(MQ135_PIN, ADC_11db);
}

void loop() {
  unsigned long currentTime = millis();

  // Enforce precise 1Hz sampling interval
  if (currentTime - lastSampleTime >= sampleInterval) {
    lastSampleTime = currentTime;

    // Read MQ135 Gas Sensor
    // Raw analog reading on ESP32 is 12-bit (0 - 4095)
    int rawGas = analogRead(MQ135_PIN);

    // Read DHT22 Temperature and Humidity
    float temp = dht.readTemperature(); // Celsius
    float hum = dht.readHumidity();     // Relative Humidity %

    // Check if DHT readings are valid. If not, supply safe fallback defaults.
    if (isnan(temp)) {
      temp = 20.0; // fallback reference temp
    }
    if (isnan(hum)) {
      hum = 55.0;  // fallback reference hum
    }

    // Format telemetry as a clean JSON packet on a single line
    // Format: {"gas": 412.0, "temp": 29.4, "hum": 61.2}
    // Note: The Python serial reader automatically appends a server-side 
    // timestamp to maintain scientific accuracy even if the ESP has no internet.
    Serial.print("{\"gas\": ");
    Serial.print(rawGas);
    Serial.print(", \"temp\": ");
    Serial.print(temp, 1);
    Serial.print(", \"hum\": ");
    Serial.print(hum, 1);
    Serial.println("}");
  }
}
