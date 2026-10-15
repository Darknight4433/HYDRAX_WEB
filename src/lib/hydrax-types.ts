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

export interface HydraxNode {
  id: string; // e.g. "testNode"
  name: string; // "Main Supply Line"
  location: string; // "Central Pump Room"
  online: boolean; // Evaluated dynamically from lastUpdate heartbeat
  flowRate: number; // Measured flow rate in L/min
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
    relay: string; // "D5 (GPIO 14)"
    pushButton: string; // "D3 (GPIO 0)"
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
