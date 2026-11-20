export type OperatingMode = "auto" | "manual" | "emergency" | "holiday" | "break";
export type ValveState = "open" | "closed";
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertType =
  | "possible_leak"
  | "continuous_flow"
  | "valve_failure"
  | "communication_failure"
  | "node_offline"
  | "high_usage"
  | "low_usage"
  | "tampering"
  | "ai_prediction";

// Tank & Pump Types (HYDRAXX v0.3.0)
export type TankStatus = "normal" | "low" | "critical" | "full" | "sensor_error";
export type TankLevelSource = "ultrasonic" | "calculated";
export type PumpState = "on" | "off";
export type PumpMode = "auto" | "manual";

export interface HydraxNode {
  id: string; // e.g. "testNode"
  name: string; // "HYDRAXX Main Node"
  location: string; // "Main Tank"
  online: boolean; // Evaluated dynamically from lastUpdate heartbeat
  flowRate: number; // Measured flow rate in L/min
  // pH Sensor Telemetry
  ph?: number; // Normalized pH (0.0..14.0)
  phValue?: number; // Direct from ESP (e.g. 6.6)
  phVoltage?: number; // Sensor voltage in Volts (e.g. 2.57V)
  phMode?: string; // "neutral" | "acidic" | "alkaline"
  phActive?: boolean; // ESP sensor active state
  phLastUpdate?: number; // Unix ms
  // TDS Sensor Telemetry
  tdsPpm?: number; // Measured TDS in ppm (e.g. 13.2)
  tdsVoltage?: number; // Sensor voltage in Volts (e.g. 0.031V)
  tdsRawADC?: number; // Raw ADC reading (e.g. 10)
  tdsStatus?: string; // "monitoring" | "normal" | "warning"
  tdsLastUpdate?: number; // Unix ms
  // Ultrasonic Tank Telemetry (HYDRAXX v0.3.0)
  tankLevelSource?: TankLevelSource; // "ultrasonic" for physical HC-SR04; "calculated" for flow-rate dynamic depletion
  tankDepletionRateLpm?: number; // Rate of water level change in L/min
  tankDepletionRateCmMin?: number; // Rate of water level change in cm/min
  tankStartingVolumeLitres?: number; // Baseline starting volume for calculation (e.g. 850L)
  tankDistanceCm?: number; // Distance between sensor and water surface in cm
  tankWaterLevelCm?: number; // Height of water currently in tank in cm
  tankCapacityLitres?: number; // Total tank capacity in Litres
  tankWaterVolumeLitres?: number; // Estimated water volume present in Litres
  tankFillPercent?: number; // Tank filling percentage (0..100%)
  tankStatus?: TankStatus; // "normal" | "low" | "critical" | "full" | "sensor_error"
  tankSensorActive?: boolean; // Sensor functioning status
  tankLastUpdate?: number; // Last sensor reading timestamp
  // Automated Pump Control Telemetry (HYDRAXX v0.3.0)
  pumpState?: PumpState; // "on" | "off"
  pumpMode?: PumpMode; // "auto" | "manual"
  pumpActive?: boolean; // Whether pump is running
  pumpLastUpdate?: number; // Last pump-state change timestamp
  pumpStartLevelPercent?: number; // Level at which pumping begins (default 20%)
  pumpStopLevelPercent?: number; // Level at which pumping stops (default 90%)
  valveState: ValveState; // Physical relay: "open" | "closed"
  manualOverride: boolean; // Flagged when manually overridden
  operatingMode: OperatingMode; // "auto" | "manual" | "emergency" | "holiday" | "break"
  todayUsage: number; // Actual litres consumed today
  weeklyUsage: number; // Actual litres consumed this week
  monthlyUsage: number; // Actual litres consumed this month
  threshold: number; // Active flow threshold in L/min
  leakProbability?: number | null; // Calculated risk score (0..1) when implemented
  lastUpdate: number; // Unix epoch ms
  signal: number; // Wi-Fi signal quality percentage (0..100)
  battery?: number; // Optional; omitted/unavailable for USB-powered Wemos
  temperature?: number; // Optional; omitted/unavailable when no sensor connected
  uptimeSec?: number; // Controller uptime in seconds
  firmware?: string; // Controller firmware string
  wifi?: string; // Connected SSID
  buttonPressed?: boolean; // Physical push button state on D3
}

export interface Thresholds {
  normalTime: number; // 22 L/min
  breakTime: number; // 28 L/min
  holiday: number; // 10 L/min
  specialEvent: number; // 35 L/min
  emergency: number; // 45 L/min
  custom: number; // 20 L/min
}

export interface AlertItem {
  id: string;
  time: number;
  severity: AlertSeverity;
  type: AlertType;
  nodeId: string;
  message: string;
  suggestion: string;
  resolved: boolean;
}

export interface WemosController {
  online: boolean;
  model: string; // "Wemos D1 Mini (ESP8266)"
  uptimeSec: number;
  systemHealth: number; // 0..100
  lastUpdate: number;
  firmware: string;
  wifi: string;
  pins: {
    flowSensor: string; // "D7 (GPIO 13)"
    relay: string; // "D5 (GPIO 14) - Valve"
    pushButton: string; // "D3 (GPIO 0)"
    phSensor?: string; // "A0 (pH Sensor ADC)"
    tdsSensor?: string; // "A0 (TDS Sensor ADC)"
    ultrasonicTrigger?: string; // "D6 (GPIO 12)"
    ultrasonicEcho?: string; // "D8 (GPIO 15)"
    pumpRelay?: string; // "D2 (GPIO 4) - Pump"
  };
}

// Kept for backward compatibility with existing components
export type Esp32Status = WemosController;

export interface Analytics {
  todayConsumption?: number;
  weeklyConsumption?: number;
  monthlyConsumption?: number;
  averageDaily?: number;
  averageHourly?: number;
  predictedTomorrow?: number;
  predictedWeek?: number;
  savingsEstimate?: number;
  aiConfidence?: number;
  hourlyToday?: { hour: number; liters: number }[];
  weeklyByDay?: { day: string; liters: number }[];
  monthlyByWeek?: { week: string; liters: number }[];
  forecastNext24h?: { hour: number; liters: number }[];
  anomalyScore?: { hour: number; score: number }[];
  liveFlow?: { t: number; flow: number }[];
}

export interface HydraxSnapshot {
  config: {
    institutionName: string;
    aiEnabled: boolean;
    phTarget?: number;
    tankLevelSource?: TankLevelSource;
    tankStartingVolumeLitres?: number;
    thresholds: Thresholds | null;
    thresholdsStatus: "loading" | "loaded" | "missing" | "error";
    thresholdsError?: string | null;
  };
  controller: WemosController;
  esp32: WemosController; // Alias for backward compatibility
  nodes: Record<string, HydraxNode>;
  analytics: Analytics;
  alerts: { active: AlertItem[]; history: AlertItem[] };
  connectionState: {
    connected: boolean;
    lastHeartbeat?: number;
    error?: string | null;
  };
}
