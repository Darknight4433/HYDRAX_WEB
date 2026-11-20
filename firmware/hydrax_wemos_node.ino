/*
 * =========================================================================================
 * HYDRAXX ENTERPRISE WATER TELEMETRY FIRMWARE
 * Target Hardware: Wemos D1 Mini (ESP8266)
 * Firmware Version: hydrax-wemos-0.1.2-tds
 * 
 * Confirmed Firebase RTDB Path: /nodes/testNode
 * Database Region: Singapore (asia-southeast1)
 * 
 * Pinout Reference:
 *   - Flow Sensor (YF-S201)        : Pin D7 (GPIO 13) - Interrupt
 *   - Relay Actuator (Solenoid)    : Pin D5 (GPIO 14) - Active LOW / HIGH
 *   - Physical Push Button         : Pin D3 (GPIO 0)  - Internal Pullup
 *   - HC-SR04 Ultrasonic Trig     : Pin D1 (GPIO 5)  - Output
 *   - HC-SR04 Ultrasonic Echo     : Pin D2 (GPIO 4)  - Input
 *   - TDS Sensor Analog ADC        : Pin A0 (ADC0)    - 0 to 3.3V
 * =========================================================================================
 */

#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>

// ==========================================
// 1. NETWORK & FIREBASE CONFIGURATION
// ==========================================
#define WIFI_SSID       "YOUR_WIFI_NAME"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// Exact Firebase URL from your console
#define FIREBASE_HOST   "https://hydrax-f65d9-default-rtdb.asia-southeast1.firebasedatabase.app/"
// Use your Firebase Web API Key or Database Secret
#define FIREBASE_AUTH   "AIzaSyCilQstd46mmaZ_8diLEs8KeMP9WLVHfq0"

#define NODE_ID         "testNode"
#define NODE_PATH       "/nodes/testNode"

// Relay Logic (Most Arduino 5V Relays are Active LOW: LOW = ON, HIGH = OFF)
#define RELAY_ACTIVE_STATE   LOW
#define RELAY_INACTIVE_STATE HIGH

// ==========================================
// 2. TANK & SENSOR CALIBRATION PARAMETERS
// ==========================================
const float TANK_TOTAL_HEIGHT_CM    = 100.0; // Total height of physical reservoir
const float TANK_CAPACITY_LITRES    = 1000.0;// Full volume capacity (Litres)
const float FLOW_CALIBRATION_FACTOR = 7.5;   // Pulses per second per L/min (YF-S201)

// ==========================================
// 3. HARDWARE PIN DEFINITIONS (User Configured)
// ==========================================
#define FLOW_PIN       D7  // Flow sensor pulse output (Interrupt GPIO 13)
#define RELAY_PIN      D5  // Solenoid / Relay control (GPIO 14)
#define TRIG_PIN       D1  // Ultrasonic HC-SR04 Trigger (GPIO 5)
#define ECHO_PIN       D2  // Ultrasonic HC-SR04 Echo (GPIO 4)
#define BUTTON_PIN     D3  // Physical override push button (GPIO 0)
#define TDS_PIN        A0  // Analog TDS sensor reading (ADC0)

// ==========================================
// 4. GLOBAL OBJECTS & STATE REGISTERS
// ==========================================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Flow Meter Variables
volatile unsigned long pulseCounter = 0;
float currentFlowRateLMin = 0.0;
float todayUsageLitres    = 6.27; // Baseline from your database, accumulates live
float weeklyUsageLitres   = 6.27;
float monthlyUsageLitres  = 6.27;

// TDS Telemetry
float currentTdsPpm       = 0.0;
float currentTdsVoltage   = 0.0;
int   currentTdsRawADC    = 0;

// Ultrasonic Tank Telemetry
float currentDistanceCm   = 0.0;
float currentWaterLevelCm = 0.0;
float currentFillPercent  = 0.0;
float currentWaterVolumeL = 0.0;

// Valve / Pump Actuation Registers
bool relayState           = false; // Matches website's "relay" boolean
bool manualOverrideActive = false;
bool pumpSafetyTrip       = false;

// Non-blocking Timers (millis)
unsigned long lastFlowTime       = 0;
unsigned long lastSensorSample   = 0;
unsigned long lastFirebasePoll   = 0;
unsigned long lastTelemetryPush  = 0;
unsigned long lastButtonDebounce = 0;

// ==========================================
// 5. FORWARD DECLARATIONS (Function Prototypes)
// ==========================================
void setActuatorRelay(bool energize, bool fromManualButton = false);
void calculateWaterFlow();
void sampleTdsSensor();
void measureUltrasonicReservoir();
void handlePhysicalOverrideButton();
void pollWebsiteCommands();
void pushTelemetryToFirebase();

// ==========================================
// 6. INTERRUPT SERVICE ROUTINE (Flow Pulses)
// ==========================================
IRAM_ATTR void onFlowPulseInterrupt() {
  pulseCounter++;
}

// ==========================================
// 6. SETUP ROUTINE
// ==========================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=======================================================");
  Serial.println("  HYDRAXX WATER MANAGEMENT SYSTEM - WEMOS D1 MINI");
  Serial.println("  Firmware: hydrax-wemos-0.1.2-tds | Node: testNode");
  Serial.println("=======================================================");

  // 1. Configure Hardware Pins
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_INACTIVE_STATE); // Keep valve closed on boot

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(FLOW_PIN, INPUT_PULLUP);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // 2. Attach Interrupt for YF-S201 Flow Meter on Pin D7
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), onFlowPulseInterrupt, FALLING);

  // 3. Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected successfully!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());

  // 4. Configure Firebase RTDB
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // 5. Read Existing Cumulative Totals from Firebase on Boot (to persist across restarts)
  if (Firebase.getFloat(fbdo, String(NODE_PATH) + "/todayUsage")) {
    todayUsageLitres = fbdo.floatData();
    weeklyUsageLitres = todayUsageLitres;
    monthlyUsageLitres = todayUsageLitres;
    Serial.printf("[Firebase] Restored Cumulative Water Usage: %.2f L\n", todayUsageLitres);
  }

  Serial.println("[Firebase] Initialized & Listening to /nodes/testNode");
}

// ==========================================
// 7. SENSOR MEASUREMENT MODULES
// ==========================================

// Module A: Flow Rate & Volumetric Consumption Meter
void calculateWaterFlow() {
  unsigned long now = millis();
  float elapsedSec = (now - lastFlowTime) / 1000.0;

  if (elapsedSec >= 1.0) {
    detachInterrupt(digitalPinToInterrupt(FLOW_PIN));

    // L/min = (pulses / 7.5) / elapsedSeconds
    currentFlowRateLMin = (pulseCounter / FLOW_CALIBRATION_FACTOR) / elapsedSec;

    // Volume (Litres) = (L/min / 60) * elapsedSeconds
    float addedLitres = (currentFlowRateLMin / 60.0) * elapsedSec;
    todayUsageLitres   += addedLitres;
    weeklyUsageLitres  += addedLitres;
    monthlyUsageLitres += addedLitres;

    pulseCounter = 0;
    lastFlowTime = now;
    attachInterrupt(digitalPinToInterrupt(FLOW_PIN), onFlowPulseInterrupt, FALLING);
  }
}

// Module B: TDS Sensor Sampling & Voltage Conversion (Pin A0)
void sampleTdsSensor() {
  // Read 10-bit analog pin A0 (0 - 1023)
  currentTdsRawADC = analogRead(TDS_PIN);
  currentTdsVoltage = (currentTdsRawADC * 3.3) / 1024.0;

  // Temperature compensation formula (25°C standard reference)
  float compensationCoefficient = 1.0;
  float compensationVoltage = currentTdsVoltage / compensationCoefficient;

  // Commercial TDS standard conversion polynomial
  currentTdsPpm = (133.42 * pow(compensationVoltage, 3) 
                 - 255.86 * pow(compensationVoltage, 2) 
                 + 857.39 * compensationVoltage) * 0.5;

  if (currentTdsPpm < 0) currentTdsPpm = 0.0;
}

// Module C: HC-SR04 Ultrasonic Reservoir Level
void measureUltrasonicReservoir() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Measure round-trip sound wave pulse (30ms timeout = ~500cm max)
  long durationMicros = pulseIn(ECHO_PIN, HIGH, 30000);

  if (durationMicros > 0) {
    // Sound speed = 0.0343 cm/microsecond (divide by 2 for round-trip)
    currentDistanceCm = (durationMicros * 0.0343) / 2.0;

    // Constrain distance within physical tank boundaries
    if (currentDistanceCm > TANK_TOTAL_HEIGHT_CM) currentDistanceCm = TANK_TOTAL_HEIGHT_CM;
    if (currentDistanceCm < 2.0) currentDistanceCm = 2.0;

    currentWaterLevelCm = TANK_TOTAL_HEIGHT_CM - currentDistanceCm;
    currentFillPercent  = (currentWaterLevelCm / TANK_TOTAL_HEIGHT_CM) * 100.0;
    currentWaterVolumeL = (currentFillPercent / 100.0) * TANK_CAPACITY_LITRES;
  }
}

// Module D: Physical Relay Actuation Setter
void setActuatorRelay(bool energize, bool fromManualButton) {
  relayState = energize;
  digitalWrite(RELAY_PIN, relayState ? RELAY_ACTIVE_STATE : RELAY_INACTIVE_STATE);
  if (fromManualButton) {
    manualOverrideActive = true;
  }
}

// Module E: Physical Hardware Override Button (Pin D3)
void handlePhysicalOverrideButton() {
  static int lastButtonState = HIGH;
  int currentButtonState = digitalRead(BUTTON_PIN);

  if (currentButtonState == LOW && lastButtonState == HIGH) {
    if (millis() - lastButtonDebounce > 250) {
      // Toggle state physically
      setActuatorRelay(!relayState, true);
      lastButtonDebounce = millis();
      Serial.println("[Hardware Button] Manual Override Triggered! New State: " + String(relayState ? "ON" : "OFF"));
    }
  }
  lastButtonState = currentButtonState;
}

// ==========================================
// 8. FIREBASE SYNCHRONIZATION MODULES
// ==========================================

// Module F: Poll Website Commands from Firebase (/nodes/testNode)
void pollWebsiteCommands() {
  // Read requested "relay" command from the website (true = ON/Open, false = OFF/Closed)
  if (Firebase.getBool(fbdo, String(NODE_PATH) + "/relay")) {
    bool requestedRelay = fbdo.boolData();
    if (requestedRelay != relayState) {
      Serial.printf("[Firebase] Incoming Relay Command: %s\n", requestedRelay ? "OPEN / ENERGIZE" : "CLOSE / DE-ENERGIZE");
      setActuatorRelay(requestedRelay, false);
    }
  }

  // Also check if manualOverride flag was changed from website
  if (Firebase.getBool(fbdo, String(NODE_PATH) + "/manualOverride")) {
    manualOverrideActive = fbdo.boolData();
  }
}

// Module G: Push Live Telemetry to Firebase (/nodes/testNode)
// Using FirebaseJson with updateNode (PATCH) so that existing pH fields are NEVER overwritten!
void pushTelemetryToFirebase() {
  FirebaseJson json;

  // General Node Status
  json.set("online", true);
  json.set("uptimeSec", (int)(millis() / 1000));
  json.set("signal", WiFi.RSSI());
  json.set("firmware", "hydrax-wemos-0.1.2-tds");

  // Actuator Feedback
  json.set("relay", relayState);
  json.set("valveState", relayState ? "open" : "closed");
  json.set("pumpState", relayState ? "on" : "off");
  json.set("pumpActive", relayState);
  json.set("pumpSafetyTrip", pumpSafetyTrip);
  json.set("manualOverride", manualOverrideActive);

  // Flow Sensor Telemetry
  json.set("flowRate", currentFlowRateLMin);
  json.set("todayUsage", todayUsageLitres);
  json.set("weeklyUsage", weeklyUsageLitres);
  json.set("monthlyUsage", monthlyUsageLitres);

  // TDS Sensor Telemetry
  json.set("tdsPpm", currentTdsPpm);
  json.set("tdsVoltage", currentTdsVoltage);
  json.set("tdsRawADC", currentTdsRawADC);
  json.set("tdsStatus", "monitoring");

  // Ultrasonic Tank Telemetry
  json.set("tankDistanceCm", currentDistanceCm);
  json.set("tankWaterLevelCm", currentWaterLevelCm);
  json.set("tankFillPercent", currentFillPercent);
  json.set("tankCapacityLitres", TANK_CAPACITY_LITRES);
  json.set("tankWaterVolumeLitres", currentWaterVolumeL);
  json.set("tankSensorActive", true);
  json.set("tankStatus", "monitoring");

  // Use updateNode (HTTP PATCH) -> PRESERVES EXISTING ph, phValue, phVoltage, phMode, phActive!
  if (Firebase.updateNode(fbdo, NODE_PATH, json)) {
    Serial.println("[Firebase] Telemetry synced: Flow=" + String(currentFlowRateLMin) + " L/min, TDS=" + String(currentTdsPpm) + " ppm, Level=" + String(currentWaterLevelCm) + " cm");
  } else {
    Serial.println("[Firebase] Telemetry update failed: " + fbdo.errorReason());
  }
}

// ==========================================
// 9. MAIN EXECUTION LOOP
// ==========================================
void loop() {
  unsigned long now = millis();

  // 1. Process flow sensor pulses every second
  calculateWaterFlow();

  // 2. Sample TDS and Ultrasonic every 500ms
  if (now - lastSensorSample >= 500) {
    sampleTdsSensor();
    measureUltrasonicReservoir();
    lastSensorSample = now;
  }

  // 3. Check physical override button on Pin D3
  handlePhysicalOverrideButton();

  // 4. Poll incoming website commands every 1.5s
  if (now - lastFirebasePoll >= 1500) {
    pollWebsiteCommands();
    lastFirebasePoll = now;
  }

  // 5. Push live telemetry to Firebase every 2s
  if (now - lastTelemetryPush >= 2000) {
    pushTelemetryToFirebase();
    lastTelemetryPush = now;
  }
}
