/**
 * HYDRAXX Realtime Store & Firebase RTDB Client.
 *
 * Designed for single-controller architecture:
 *   Controller: Wemos D1 Mini (ESP8266)
 *   Primary node path: /nodes/testNode
 *   Thresholds path: /config/thresholds
 *   Pins:
 *     - D7 (GPIO 13): Water flow sensor
 *     - D5 (GPIO 14): Relay module (Valve)
 *     - D3 (GPIO 0):  Physical push button
 *
 * Realtime sync via Firebase RTDB at:
 *   https://hydrax-f65d9-default-rtdb.asia-southeast1.firebasedatabase.app
 */
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ref, onValue, update, remove, set, get } from "firebase/database";
import { firebaseConfigured, getDb } from "./firebase";
import type {
  AlertItem,
  AlertSeverity,
  AlertType,
  Analytics,
  HydraxNode,
  HydraxSnapshot,
  OperatingMode,
  PumpMode,
  PumpState,
  TankStatus,
  Thresholds,
  ValveState,
  WemosController,
} from "./hydrax-types";
import { checkWaterTelemetryAbnormalities, initNotifications } from "./notifications";

// Timeout after which a device is flagged stale if lastUpdate timestamp stops (15 minutes grace period)
const HEARTBEAT_TIMEOUT_MS = 900000;

function nowHour() {
  return new Date().getHours();
}

function parseNumeric(val: unknown): number | undefined {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    if (!isNaN(n)) return n;
  }
  return undefined;
}

function initialController(): WemosController {
  return {
    online: false,
    model: "Wemos D1 Mini (ESP8266)",
    uptimeSec: 0,
    systemHealth: 100,
    lastUpdate: 0,
    firmware: "hydrax-wemos-0.3.0",
    wifi: "Connecting...",
    pins: {
      flowSensor: "D7 (GPIO 13)",
      relay: "D5 (GPIO 14) - Valve",
      pushButton: "D3 (GPIO 0)",
      phSensor: "A0 (pH ADC)",
      tdsSensor: "A0 (TDS ADC)",
      ultrasonicTrigger: "D6 (GPIO 12)",
      ultrasonicEcho: "D8 (GPIO 15)",
      pumpRelay: "D2 (GPIO 4) - Pump",
    },
  };
}

function initialTestNode(): HydraxNode {
  return {
    id: "testNode",
    name: "HYDRAXX Main Node",
    location: "Main Tank",
    online: false,
    flowRate: 0,
    ph: 7.0,
    phValue: 7.0,
    phVoltage: 2.5,
    phMode: "neutral",
    phActive: true,
    phLastUpdate: 0,
    tdsPpm: 0,
    tdsVoltage: 0,
    tdsRawADC: 0,
    tdsStatus: "monitoring",
    tdsLastUpdate: 0,
    // Ultrasonic & Flow-Calculated Tank Telemetry (HYDRAXX v0.3.0)
    tankLevelSource: "calculated",
    tankStartingVolumeLitres: 850,
    tankDepletionRateLpm: 0,
    tankDepletionRateCmMin: 0,
    tankDistanceCm: 30,
    tankWaterLevelCm: 170,
    tankCapacityLitres: 1000,
    tankWaterVolumeLitres: 850,
    tankFillPercent: 85,
    tankStatus: "normal",
    tankSensorActive: true,
    tankLastUpdate: 0,
    // Automated Pump Actuator
    pumpState: "off",
    pumpMode: "auto",
    pumpActive: false,
    pumpLastUpdate: 0,
    pumpStartLevelPercent: 20,
    pumpStopLevelPercent: 90,
    valveState: "closed",
    manualOverride: false,
    operatingMode: "auto",
    todayUsage: 0,
    weeklyUsage: 0,
    monthlyUsage: 0,
    threshold: 22,
    leakProbability: null,
    lastUpdate: 0,
    signal: 0,
    uptimeSec: 0,
    firmware: "hydrax-wemos-0.3.0",
    wifi: "",
    buttonPressed: false,
  };
}

function initialSnapshot(): HydraxSnapshot {
  const ctrl = initialController();
  return {
    config: {
      institutionName: "HYDRAXX Smart Water",
      aiEnabled: false,
      tankLevelSource: "calculated",
      tankStartingVolumeLitres: 850,
      thresholds: null, // Loaded strictly from Firebase
      thresholdsStatus: "loading",
      thresholdsError: null,
    },
    controller: ctrl,
    esp32: ctrl, // Backwards-compatible alias
    nodes: {
      testNode: initialTestNode(),
    },
    analytics: {
      todayConsumption: 0,
      weeklyConsumption: 0,
      monthlyConsumption: 0,
      averageDaily: 0,
      averageHourly: 0,
      liveFlow: [],
      hourlyToday: [],
      weeklyByDay: [],
      monthlyByWeek: [],
      forecastNext24h: [],
      anomalyScore: [],
    },
    alerts: {
      active: [],
      history: [],
    },
    connectionState: {
      connected: false,
      lastHeartbeat: undefined,
      error: null,
    },
  };
}

// -------- Pub/Sub store --------
let snapshot: HydraxSnapshot = initialSnapshot();
const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...snapshot };
  listeners.forEach((l) => l());
  try {
    checkWaterTelemetryAbnormalities(snapshot);
  } catch { }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return snapshot;
}

// -------- Freshness / Heartbeat Monitor --------
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
function startHeartbeatMonitor() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;

    for (const [id, node] of Object.entries(snapshot.nodes)) {
      // Flag offline only if no heartbeat received for over HEARTBEAT_TIMEOUT_MS (5 mins)
      const isStale = Boolean(
        node.lastUpdate &&
        node.lastUpdate > 0 &&
        now - node.lastUpdate > HEARTBEAT_TIMEOUT_MS
      );
      if (isStale && node.online) {
        snapshot.nodes[id] = { ...node, online: false };
        changed = true;
      }
    }

    const primary = snapshot.nodes.testNode;
    const ctrlOnline = Boolean(primary?.online);
    if (snapshot.controller.online !== ctrlOnline) {
      snapshot.controller = {
        ...snapshot.controller,
        online: ctrlOnline,
        uptimeSec: primary?.uptimeSec ?? snapshot.controller.uptimeSec,
        lastUpdate: primary?.lastUpdate ?? snapshot.controller.lastUpdate,
      };
      snapshot.esp32 = snapshot.controller;
      changed = true;
    }

    // Dynamic Hydrodynamic Water Level Depletion Calculation
    if (primary) {
      // Automatic Water Level Depletion: reduces tank level whenever water is flowing or valve is open
      const physicalFlow = Number(primary.flowRate || 0);
      const isValveOpen = primary.valveState === "open" || Boolean((primary as unknown as { relay?: boolean }).relay);
      const effectiveFlow = physicalFlow > 0 ? physicalFlow : (isValveOpen ? 5.2 : 0);

      const isPumpOn = primary.pumpState === "on" || Boolean(primary.pumpActive);
      const pumpRate = isPumpOn ? 15.0 : 0; // Standard refill pump delivers ~15 L/min
      const netLpm = pumpRate - effectiveFlow;
      const depletionLpm = effectiveFlow;
      const depletionCmMin = Number((effectiveFlow / 5.0).toFixed(2));
      const capacity = primary.tankCapacityLitres || 1000;

      // Every 1 second (interval = 1000ms):
      const deltaLitres = (netLpm / 60) * 1.0;
      const prevVol = primary.tankWaterVolumeLitres ?? 850;
      const nextVol = Math.max(0, Math.min(capacity, Number((prevVol + deltaLitres).toFixed(2))));
      const nextFillPct = Number(((nextVol / capacity) * 100).toFixed(1));
      const nextWaterCm = Number(((nextFillPct / 100) * 200).toFixed(1));
      const nextDistanceCm = Number((200 - nextWaterCm).toFixed(1));

      let status: TankStatus = "normal";
      if (nextFillPct < 15) status = "critical";
      else if (nextFillPct < 25) status = "low";
      else if (nextFillPct >= 95) status = "full";

      // Auto hysteresis pump trigger
      let nextPumpState = primary.pumpState || "off";
      let nextPumpActive = Boolean(primary.pumpActive);
      if (primary.pumpMode !== "manual") {
        if (nextFillPct <= (primary.pumpStartLevelPercent ?? 20) && !nextPumpActive) {
          nextPumpState = "on";
          nextPumpActive = true;
          setPumpState("testNode", "on").catch(() => {});
        } else if (nextFillPct >= (primary.pumpStopLevelPercent ?? 90) && nextPumpActive) {
          nextPumpState = "off";
          nextPumpActive = false;
          setPumpState("testNode", "off").catch(() => {});
        }
      }

      if (Math.abs(nextVol - prevVol) > 0.001 || primary.tankDepletionRateLpm !== depletionLpm) {
        snapshot.nodes.testNode = {
          ...primary,
          tankWaterVolumeLitres: nextVol,
          tankFillPercent: nextFillPct,
          tankWaterLevelCm: nextWaterCm,
          tankDistanceCm: nextDistanceCm,
          tankStatus: status,
          tankDepletionRateLpm: depletionLpm,
          tankDepletionRateCmMin: depletionCmMin,
          pumpState: nextPumpState,
          pumpActive: nextPumpActive,
        };
        changed = true;
      }
    }

    if (changed) emit();
  }, 1000);
}

// Helper to push a live flow tick
function appendLiveFlow(flow: number, timestamp = Date.now()) {
  const current = snapshot.analytics.liveFlow ?? [];
  const next = [...current.slice(-59), { t: timestamp, flow: Number(flow.toFixed(2)) }];
  snapshot.analytics = {
    ...snapshot.analytics,
    liveFlow: next,
  };
}

// -------- Firebase subscription --------
let fbBound = false;
function bindFirebase() {
  if (fbBound) return;
  const db = getDb();
  if (!db) {
    snapshot.connectionState = { connected: false, error: "Database instance unavailable" };
    emit();
    return;
  }
  fbBound = true;
  startHeartbeatMonitor();

  try {
    // 1. Primary nodes listener (/nodes)
    onValue(
      ref(db, "/nodes"),
      (snap) => {
        const val = snap.val();
        if (!val) return;
        const now = Date.now();
        const updatedNodes: Record<string, HydraxNode> = { ...snapshot.nodes };

        for (const [k, rawVal] of Object.entries(val as Record<string, Record<string, unknown>>)) {
          if (!rawVal || typeof rawVal !== "object") continue;
          const raw = rawVal as Record<string, unknown>;
          let lastUp = typeof raw.lastUpdate === "number" ? raw.lastUpdate : 0;
          if (lastUp > 0 && lastUp < 10000000000) {
            lastUp = lastUp * 1000;
          }
          const isStale = lastUp > 0 && now - lastUp > HEARTBEAT_TIMEOUT_MS;
          const isDeviceOnline = raw.online === true || (raw.online !== false && !isStale);

          updatedNodes[k] = {
            id: (raw.id as string) || k,
            name: (raw.name as string) || (k === "testNode" ? "Main Supply Line" : `Node ${k}`),
            location: (raw.location as string) || "Central Pump Room",
            online: isDeviceOnline,
            flowRate: Number(raw.flowRate ?? 0),
            // pH sensor telemetry (real calibrated values from hardware)
            ph:
              parseNumeric(raw.phValue ?? raw.ph) ??
              (snapshot.nodes[k]?.ph ?? 7.0),
            phValue:
              parseNumeric(raw.phValue ?? raw.ph) ??
              (snapshot.nodes[k]?.phValue ?? 7.0),
            phVoltage: parseNumeric(raw.phVoltage) ?? snapshot.nodes[k]?.phVoltage,
            phMode:
              (raw.phMode as string) ||
              (typeof raw.phValue === "number"
                ? raw.phValue < 6.5
                  ? "acidic"
                  : raw.phValue > 8.5
                    ? "alkaline"
                    : "neutral"
                : "neutral"),
            phActive: typeof raw.phActive === "boolean" ? raw.phActive : true,
            phLastUpdate: typeof raw.phLastUpdate === "number" ? raw.phLastUpdate : undefined,
            // Automated TDS telemetry correlated to pH (no real values for both pH and TDS)
            tdsPpm: (() => {
              const parsedTds = parseNumeric(raw.tdsPpm ?? raw.tds ?? raw.tdsValue);
              if (parsedTds != null && parsedTds > 0) return parsedTds;
              const nodePh = parseNumeric(raw.phValue ?? raw.ph) ?? snapshot.nodes[k]?.phValue ?? 7.0;
              return calculateCorrelatedTds(nodePh).tdsPpm;
            })(),
            tdsVoltage: (() => {
              const parsedV = parseNumeric(raw.tdsVoltage);
              if (parsedV != null && parsedV > 0) return parsedV;
              const nodePh = parseNumeric(raw.phValue ?? raw.ph) ?? snapshot.nodes[k]?.phValue ?? 7.0;
              return calculateCorrelatedTds(nodePh).tdsVoltage;
            })(),
            tdsRawADC: (() => {
              const parsedAdc = parseNumeric(raw.tdsRawADC);
              if (parsedAdc != null && parsedAdc > 0) return parsedAdc;
              const nodePh = parseNumeric(raw.phValue ?? raw.ph) ?? snapshot.nodes[k]?.phValue ?? 7.0;
              return calculateCorrelatedTds(nodePh).tdsRawADC;
            })(),
            tdsStatus: (raw.tdsStatus as string) || snapshot.nodes[k]?.tdsStatus || "monitoring",
            tdsLastUpdate: parseNumeric(raw.tdsLastUpdate) ?? snapshot.nodes[k]?.tdsLastUpdate,
            // Ultrasonic & Flow-Calculated Tank Level Telemetry (v0.3.0)
            tankLevelSource:
              (raw.tankLevelSource as TankLevelSource) ||
              snapshot.config.tankLevelSource ||
              snapshot.nodes[k]?.tankLevelSource ||
              "calculated",
            tankDepletionRateLpm: Number(raw.flowRate ?? 0),
            tankDepletionRateCmMin: Number(((Number(raw.flowRate ?? 0)) / 5.0).toFixed(2)),
            tankStartingVolumeLitres:
              typeof raw.tankStartingVolumeLitres === "number"
                ? Number(raw.tankStartingVolumeLitres)
                : (snapshot.nodes[k]?.tankStartingVolumeLitres ?? 850),
            tankDistanceCm:
              ((raw.tankLevelSource as TankLevelSource) || snapshot.config.tankLevelSource || "calculated") === "ultrasonic"
                ? (typeof raw.tankDistanceCm === "number" ? Number(raw.tankDistanceCm) : (snapshot.nodes[k]?.tankDistanceCm ?? 0))
                : (snapshot.nodes[k]?.tankDistanceCm ?? (typeof raw.tankDistanceCm === "number" ? Number(raw.tankDistanceCm) : 30)),
            tankWaterLevelCm:
              ((raw.tankLevelSource as TankLevelSource) || snapshot.config.tankLevelSource || "calculated") === "ultrasonic"
                ? (typeof raw.tankWaterLevelCm === "number" ? Number(raw.tankWaterLevelCm) : (snapshot.nodes[k]?.tankWaterLevelCm ?? 0))
                : (snapshot.nodes[k]?.tankWaterLevelCm ?? (typeof raw.tankWaterLevelCm === "number" ? Number(raw.tankWaterLevelCm) : 170)),
            tankCapacityLitres:
              typeof raw.tankCapacityLitres === "number"
                ? Number(raw.tankCapacityLitres)
                : (snapshot.nodes[k]?.tankCapacityLitres ?? 1000),
            tankWaterVolumeLitres:
              ((raw.tankLevelSource as TankLevelSource) || snapshot.config.tankLevelSource || "calculated") === "ultrasonic"
                ? (typeof raw.tankWaterVolumeLitres === "number" ? Number(raw.tankWaterVolumeLitres) : (snapshot.nodes[k]?.tankWaterVolumeLitres ?? 0))
                : (snapshot.nodes[k]?.tankWaterVolumeLitres ?? (typeof raw.tankWaterVolumeLitres === "number" ? Number(raw.tankWaterVolumeLitres) : 850)),
            tankFillPercent:
              ((raw.tankLevelSource as TankLevelSource) || snapshot.config.tankLevelSource || "calculated") === "ultrasonic"
                ? (typeof raw.tankFillPercent === "number" ? Number(raw.tankFillPercent) : (snapshot.nodes[k]?.tankFillPercent ?? 0))
                : (snapshot.nodes[k]?.tankFillPercent ?? (typeof raw.tankFillPercent === "number" ? Number(raw.tankFillPercent) : 85)),
            tankStatus:
              (raw.tankStatus as TankStatus) || (snapshot.nodes[k]?.tankStatus ?? "normal"),
            tankSensorActive:
              typeof raw.tankSensorActive === "boolean" ? raw.tankSensorActive : true,
            tankLastUpdate: typeof raw.tankLastUpdate === "number" ? raw.tankLastUpdate : undefined,
            // Automatic Pump Control Telemetry (v0.3.0)
            pumpState: raw.pumpState === "on" ? "on" : "off",
            pumpMode: raw.pumpMode === "manual" ? "manual" : "auto",
            pumpActive:
              typeof raw.pumpActive === "boolean" ? raw.pumpActive : raw.pumpState === "on",
            pumpLastUpdate: typeof raw.pumpLastUpdate === "number" ? raw.pumpLastUpdate : undefined,
            pumpStartLevelPercent:
              typeof raw.pumpStartLevelPercent === "number"
                ? Number(raw.pumpStartLevelPercent)
                : (snapshot.nodes[k]?.pumpStartLevelPercent ?? 20),
            pumpStopLevelPercent:
              typeof raw.pumpStopLevelPercent === "number"
                ? Number(raw.pumpStopLevelPercent)
                : (snapshot.nodes[k]?.pumpStopLevelPercent ?? 90),
            valveState: raw.valveState === "open" ? "open" : "closed",
            manualOverride: Boolean(raw.manualOverride),
            operatingMode: (raw.operatingMode as OperatingMode) || "auto",
            todayUsage: Number(raw.todayUsage ?? 0),
            weeklyUsage: Number(raw.weeklyUsage ?? 0),
            monthlyUsage: Number(raw.monthlyUsage ?? 0),
            threshold: Number(raw.threshold ?? 22),
            leakProbability: typeof raw.leakProbability === "number" ? raw.leakProbability : null,
            lastUpdate: lastUp,
            signal: Number(raw.signal ?? 0),
            battery: typeof raw.battery === "number" ? raw.battery : undefined,
            temperature: typeof raw.temperature === "number" ? raw.temperature : undefined,
            uptimeSec: typeof raw.uptimeSec === "number" ? raw.uptimeSec : undefined,
            firmware: (raw.firmware as string) || "hydrax-wemos-0.3.0",
            wifi: raw.wifi as string | undefined,
            buttonPressed: Boolean(raw.buttonPressed),
          };

          if (k === "testNode" && isDeviceOnline) {
            appendLiveFlow(updatedNodes[k].flowRate, lastUp);
          }
        }

        const primary = updatedNodes.testNode;
        const ctrl = {
          ...snapshot.controller,
          online: Boolean(primary?.online),
          uptimeSec: primary?.uptimeSec ?? snapshot.controller.uptimeSec,
          lastUpdate: primary?.lastUpdate ?? Date.now(),
          wifi: primary?.wifi ?? snapshot.controller.wifi,
          firmware: primary?.firmware ?? snapshot.controller.firmware,
        };

        snapshot = {
          ...snapshot,
          nodes: updatedNodes,
          controller: ctrl,
          esp32: ctrl,
          connectionState: { connected: true, lastHeartbeat: now, error: null },
        };
        emit();
      },
      (err) => {
        console.error("Firebase /nodes read error:", err);
        snapshot.connectionState = { connected: false, error: err.message };
        emit();
      },
    );

    // 2. Thresholds listener (/config/thresholds)
    onValue(
      ref(db, "/config/thresholds"),
      (snap) => {
        if (snap.exists() && snap.val()) {
          const v = snap.val() as Record<string, unknown>;
          snapshot.config.thresholds = {
            normalTime: Number(v.normalTime ?? 22),
            breakTime: Number(v.breakTime ?? 28),
            holiday: Number(v.holiday ?? 10),
            specialEvent: Number(v.specialEvent ?? 35),
            emergency: Number(v.emergency ?? 45),
            custom: Number(v.custom ?? 20),
          };
          snapshot.config.thresholdsStatus = "loaded";
          snapshot.config.thresholdsError = null;
        } else {
          snapshot.config.thresholds = null;
          snapshot.config.thresholdsStatus = "missing";
          snapshot.config.thresholdsError = null;
        }
        emit();
      },
      (err) => {
        console.error("Firebase /config/thresholds read error:", err);
        snapshot.config.thresholdsStatus = "error";
        snapshot.config.thresholdsError = err.message;
        emit();
      },
    );

    // 3. Institution / Global Config listener (/config)
    onValue(ref(db, "/config"), (snap) => {
      const val = snap.val() as Record<string, unknown> | null;
      if (!val) return;
      snapshot.config.institutionName =
        (val.institutionName as string) ?? snapshot.config.institutionName;
      snapshot.config.aiEnabled = Boolean(val.aiEnabled);
      if (val.tankLevelSource === "ultrasonic" || val.tankLevelSource === "calculated") {
        snapshot.config.tankLevelSource = val.tankLevelSource;
        if (snapshot.nodes.testNode) {
          snapshot.nodes.testNode = {
            ...snapshot.nodes.testNode,
            tankLevelSource: val.tankLevelSource,
          };
        }
      }
      if (typeof val.ph === "number" || typeof val.phTarget === "number") {
        const phVal = Number(val.ph ?? val.phTarget);
        snapshot.config.phTarget = phVal;
        if (snapshot.nodes.testNode && typeof val.ph === "number") {
          snapshot.nodes.testNode = {
            ...snapshot.nodes.testNode,
            ph: phVal,
          };
        }
      }
      emit();
    });

    // 4. Alerts listener (/alerts)
    onValue(ref(db, "/alerts"), (snap) => {
      const val = snap.val();
      if (!val) return;
      const parseAlerts = (raw: unknown): AlertItem[] => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.filter(Boolean);
        return Object.entries(raw as Record<string, Record<string, unknown>>).map(([k, v]) => ({
          id: (v.id as string) || k,
          time: (v.time as number) || Date.now(),
          severity: (v.severity as AlertSeverity) || "info",
          type: (v.type as AlertType) || "communication_failure",
          nodeId: (v.nodeId as string) || "testNode",
          message: (v.message as string) || "",
          suggestion: (v.suggestion as string) || "",
          resolved: Boolean(v.resolved),
        }));
      };

      const alertRecord = val as { active?: unknown; history?: unknown };
      snapshot.alerts = {
        active: parseAlerts(alertRecord.active),
        history: parseAlerts(alertRecord.history),
      };
      emit();
    });

    // 5. Analytics listener (/analytics)
    onValue(ref(db, "/analytics"), (snap) => {
      const val = snap.val();
      if (!val) return;
      snapshot.analytics = {
        ...snapshot.analytics,
        ...val,
      };
      emit();
    });

    // 6. Secondary /hydrax/nodes fallback bridge
    onValue(ref(db, "/hydrax/nodes"), (snap) => {
      const val = snap.val();
      if (!val) return;
      const rawTest = (val as Record<string, Record<string, unknown>>).testNode;
      if (!rawTest) return;

      const now = Date.now();
      const currentTest = snapshot.nodes.testNode;
      const primaryHasFreshData = currentTest.lastUpdate && now - currentTest.lastUpdate < 5000;
      if (primaryHasFreshData) return;

      let lastUp = typeof rawTest.lastUpdate === "number" ? rawTest.lastUpdate : 0;
      if (lastUp > 0 && lastUp < 10000000000) {
        lastUp = lastUp * 1000;
      }
      const isFresh = lastUp > 0 && Math.abs(now - lastUp) < HEARTBEAT_TIMEOUT_MS;
      const isDeviceOnline = rawTest.online === true && isFresh;

      const updatedNode: HydraxNode = {
        ...currentTest,
        flowRate: Number(rawTest.flowRate ?? 0),
        ph:
          parseNumeric(rawTest.phValue ?? rawTest.ph) ??
          (currentTest.ph ?? 7.0),
        phValue:
          parseNumeric(rawTest.phValue ?? rawTest.ph) ??
          (currentTest.phValue ?? 7.0),
        phVoltage: parseNumeric(rawTest.phVoltage) ?? currentTest.phVoltage,
        tdsPpm: (() => {
          const parsed = parseNumeric(rawTest.tdsPpm ?? rawTest.tds ?? rawTest.tdsValue);
          if (parsed != null && parsed > 0) return parsed;
          const nodePh = parseNumeric(rawTest.phValue ?? rawTest.ph) ?? currentTest.phValue ?? 7.0;
          return calculateCorrelatedTds(nodePh).tdsPpm;
        })(),
        tdsVoltage: (() => {
          const parsed = parseNumeric(rawTest.tdsVoltage);
          if (parsed != null && parsed > 0) return parsed;
          const nodePh = parseNumeric(rawTest.phValue ?? rawTest.ph) ?? currentTest.phValue ?? 7.0;
          return calculateCorrelatedTds(nodePh).tdsVoltage;
        })(),
        tdsRawADC: (() => {
          const parsed = parseNumeric(rawTest.tdsRawADC);
          if (parsed != null && parsed > 0) return parsed;
          const nodePh = parseNumeric(rawTest.phValue ?? rawTest.ph) ?? currentTest.phValue ?? 7.0;
          return calculateCorrelatedTds(nodePh).tdsRawADC;
        })(),
        tdsStatus: (rawTest.tdsStatus as string) || currentTest.tdsStatus || "monitoring",
        tdsLastUpdate: parseNumeric(rawTest.tdsLastUpdate) ?? currentTest.tdsLastUpdate,
        valveState: rawTest.valveState === "open" ? "open" : "closed",
        todayUsage: Number(rawTest.todayUsage ?? 0),
        buttonPressed: Boolean(rawTest.buttonPressed),
        uptimeSec: Number(rawTest.uptimeSec ?? 0),
        signal: Number(rawTest.signal ?? 0),
        // Tank & Pump
        tankLevelSource:
          (rawTest.tankLevelSource as TankLevelSource) ||
          currentTest.tankLevelSource ||
          snapshot.config.tankLevelSource ||
          "calculated",
        tankDepletionRateLpm: Number(rawTest.flowRate ?? currentTest.flowRate ?? 0),
        tankDepletionRateCmMin: Number((Number(rawTest.flowRate ?? currentTest.flowRate ?? 0) / 5.0).toFixed(2)),
        tankStartingVolumeLitres:
          typeof rawTest.tankStartingVolumeLitres === "number"
            ? Number(rawTest.tankStartingVolumeLitres)
            : (currentTest.tankStartingVolumeLitres ?? 850),
        tankDistanceCm:
          ((rawTest.tankLevelSource as TankLevelSource) || currentTest.tankLevelSource || "calculated") === "ultrasonic"
            ? (typeof rawTest.tankDistanceCm === "number" ? Number(rawTest.tankDistanceCm) : (currentTest.tankDistanceCm ?? 0))
            : (currentTest.tankDistanceCm ?? 30),
        tankWaterLevelCm:
          ((rawTest.tankLevelSource as TankLevelSource) || currentTest.tankLevelSource || "calculated") === "ultrasonic"
            ? (typeof rawTest.tankWaterLevelCm === "number" ? Number(rawTest.tankWaterLevelCm) : (currentTest.tankWaterLevelCm ?? 0))
            : (currentTest.tankWaterLevelCm ?? 170),
        tankCapacityLitres:
          typeof rawTest.tankCapacityLitres === "number"
            ? Number(rawTest.tankCapacityLitres)
            : (currentTest.tankCapacityLitres ?? 1000),
        tankWaterVolumeLitres:
          ((rawTest.tankLevelSource as TankLevelSource) || currentTest.tankLevelSource || "calculated") === "ultrasonic"
            ? (typeof rawTest.tankWaterVolumeLitres === "number" ? Number(rawTest.tankWaterVolumeLitres) : (currentTest.tankWaterVolumeLitres ?? 0))
            : (currentTest.tankWaterVolumeLitres ?? 850),
        tankFillPercent:
          ((rawTest.tankLevelSource as TankLevelSource) || currentTest.tankLevelSource || "calculated") === "ultrasonic"
            ? (typeof rawTest.tankFillPercent === "number" ? Number(rawTest.tankFillPercent) : (currentTest.tankFillPercent ?? 0))
            : (currentTest.tankFillPercent ?? 85),
        tankStatus: (rawTest.tankStatus as TankStatus) || (currentTest.tankStatus ?? "normal"),
        pumpState: rawTest.pumpState === "on" ? "on" : "off",
        pumpMode: rawTest.pumpMode === "manual" ? "manual" : "auto",
        pumpActive: typeof rawTest.pumpActive === "boolean" ? rawTest.pumpActive : rawTest.pumpState === "on",
        pumpStartLevelPercent: typeof rawTest.pumpStartLevelPercent === "number" ? Number(rawTest.pumpStartLevelPercent) : (currentTest.pumpStartLevelPercent ?? 20),
        pumpStopLevelPercent: typeof rawTest.pumpStopLevelPercent === "number" ? Number(rawTest.pumpStopLevelPercent) : (currentTest.pumpStopLevelPercent ?? 90),
        online: isDeviceOnline,
        lastUpdate: lastUp,
      };

      snapshot = {
        ...snapshot,
        nodes: { ...snapshot.nodes, testNode: updatedNode },
      };
      emit();
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Firebase binding failed:", err);
    snapshot.connectionState = { connected: false, error: msg };
    emit();
  }
}

let bootstrapped = false;
function ensureStarted() {
  if (bootstrapped) return;
  bootstrapped = true;
  if (firebaseConfigured) {
    bindFirebase();
  } else {
    startHeartbeatMonitor();
  }
}

export function useHydrax(): HydraxSnapshot {
  useEffect(() => {
    ensureStarted();
    initNotifications();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// -------- Remote Mutations (Writes to Firebase RTDB) --------

/**
 * Actuate the valve (relay on pin D5).
 * Writes single desired-state command: /nodes/{nodeId}/valveState
 * Values: "open" | "closed"
 */
export async function setValve(nodeId: string, state: ValveState) {
  const n = snapshot.nodes[nodeId];
  if (!n) return;

  const isOpen = state === "open";
  const now = Date.now();

  // Optimistic UI update
  snapshot.nodes[nodeId] = { ...n, valveState: state, manualOverride: true };
  emit();

  const db = getDb();
  if (db) {
    try {
      // 1. Primary standard node path: send BOTH string and boolean formats
      await update(ref(db, `/nodes/${nodeId}`), {
        valveState: state,
        relay: isOpen,
        manualOverride: true,
        lastCommandTime: now,
      });

      // 2. Backward-compatibility bridge for firmware listening on /hydrax/control
      await update(ref(db, `/hydrax/control`), {
        relay: isOpen,
        valveState: state,
        manualOverride: true,
        lastCommandTime: now,
      });

      // 3. Fallback node bridge path
      await update(ref(db, `/hydrax/nodes/${nodeId}`), {
        valveState: state,
        relay: isOpen,
        manualOverride: true,
        lastCommandTime: now,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Firebase setValve error:", err);
      toast.error(`Firebase error: ${msg}`);
    }
  }
}

/**
 * Set node operating mode: "auto" | "manual" | "emergency" | "holiday" | "break"
 */
export async function setNodeMode(nodeId: string, mode: OperatingMode) {
  const n = snapshot.nodes[nodeId];
  if (!n) return;

  snapshot.nodes[nodeId] = {
    ...n,
    operatingMode: mode,
    manualOverride: mode === "manual",
  };
  emit();

  const db = getDb();
  if (db) {
    try {
      await update(ref(db, `/nodes/${nodeId}`), {
        operatingMode: mode,
        manualOverride: mode === "manual",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Firebase setNodeMode error:", err);
      toast.error(`Firebase error: ${msg}`);
    }
  }
}

/**
 * Actuate the water tank refill pump (relay on Pin D2).
 * Writes to /nodes/{nodeId}/pumpState, pumpActive, and pumpLastUpdate in Firebase RTDB.
 */
export async function setPumpState(nodeId: string, state: PumpState): Promise<void> {
  const n = snapshot.nodes[nodeId];
  if (!n) return;
  const now = Date.now();
  const isActive = state === "on";

  snapshot.nodes[nodeId] = {
    ...n,
    pumpState: state,
    pumpActive: isActive,
    pumpLastUpdate: now,
  };
  emit();

  const db = getDb();
  if (db) {
    try {
      await update(ref(db, `/nodes/${nodeId}`), {
        pumpState: state,
        pumpActive: isActive,
        pumpLastUpdate: now,
      });
      await update(ref(db, `/hydrax/control`), {
        pump: isActive,
        lastCommand: now,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Firebase setPumpState error:", err);
      toast.error(`Firebase error: ${msg}`);
      throw err;
    }
  }
}

/**
 * Toggle pump operating mode ("auto" | "manual").
 */
export async function setPumpMode(nodeId: string, mode: PumpMode): Promise<void> {
  const n = snapshot.nodes[nodeId];
  if (!n) return;
  const now = Date.now();

  snapshot.nodes[nodeId] = {
    ...n,
    pumpMode: mode,
    pumpLastUpdate: now,
  };
  emit();

  const db = getDb();
  if (db) {
    try {
      await update(ref(db, `/nodes/${nodeId}`), {
        pumpMode: mode,
        pumpLastUpdate: now,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Firebase setPumpMode error:", err);
      toast.error(`Firebase error: ${msg}`);
      throw err;
    }
  }
}

/**
 * Update pump hysteresis threshold levels (start below startPct, stop above stopPct).
 */
export async function updatePumpThresholds(
  nodeId: string,
  startLevelPercent: number,
  stopLevelPercent: number,
): Promise<void> {
  if (
    startLevelPercent < 0 ||
    startLevelPercent > 100 ||
    stopLevelPercent < 0 ||
    stopLevelPercent > 100
  ) {
    throw new Error("Threshold levels must be percentages between 0 and 100%");
  }
  if (startLevelPercent >= stopLevelPercent) {
    throw new Error("Pump start level must be lower than pump stop level (hysteresis).");
  }

  const n = snapshot.nodes[nodeId];
  if (n) {
    snapshot.nodes[nodeId] = {
      ...n,
      pumpStartLevelPercent: startLevelPercent,
      pumpStopLevelPercent: stopLevelPercent,
    };
    emit();
  }

  const db = getDb();
  if (db) {
    try {
      await update(ref(db, `/nodes/${nodeId}`), {
        pumpStartLevelPercent: startLevelPercent,
        pumpStopLevelPercent: stopLevelPercent,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Firebase error: ${msg}`);
      throw err;
    }
  }
}

/**
 * Calibrate or simulate tank level (fill percent 0..100%).
 * Evaluates automatic pump control hysteresis and updates Firebase RTDB.
 */
export async function calibrateTankLevel(nodeId: string, fillPercent: number): Promise<void> {
  const clampedPct = Math.max(0, Math.min(100, Math.round(fillPercent * 10) / 10));
  const n = snapshot.nodes[nodeId];
  if (!n) return;

  const capacity = n.tankCapacityLitres || 1000;
  const volume = Number(((clampedPct / 100) * capacity).toFixed(1));
  const totalHeightCm = 200; // standard 2m tank height
  const waterHeightCm = Number(((clampedPct / 100) * totalHeightCm).toFixed(1));
  const distanceCm = Number((totalHeightCm - waterHeightCm).toFixed(1));

  let status: TankStatus = "normal";
  if (clampedPct < 15) status = "critical";
  else if (clampedPct < 25) status = "low";
  else if (clampedPct >= 95) status = "full";

  // Check pump hysteresis if in auto mode
  let nextPumpState = n.pumpState || "off";
  let nextPumpActive = Boolean(n.pumpActive);
  const startPct = n.pumpStartLevelPercent ?? 20;
  const stopPct = n.pumpStopLevelPercent ?? 90;

  if (n.pumpMode !== "manual") {
    if (clampedPct <= startPct) {
      nextPumpState = "on";
      nextPumpActive = true;
    } else if (clampedPct >= stopPct) {
      nextPumpState = "off";
      nextPumpActive = false;
    }
  }

  const now = Date.now();
  snapshot.nodes[nodeId] = {
    ...n,
    tankFillPercent: clampedPct,
    tankWaterVolumeLitres: volume,
    tankWaterLevelCm: waterHeightCm,
    tankDistanceCm: distanceCm,
    tankStatus: status,
    tankLastUpdate: now,
    pumpState: nextPumpState,
    pumpActive: nextPumpActive,
    pumpLastUpdate: now,
  };
  emit();

  const db = getDb();
  if (db) {
    try {
      await update(ref(db, `/nodes/${nodeId}`), {
        tankFillPercent: clampedPct,
        tankWaterVolumeLitres: volume,
        tankWaterLevelCm: waterHeightCm,
        tankDistanceCm: distanceCm,
        tankStatus: status,
        tankLastUpdate: now,
        pumpState: nextPumpState,
        pumpActive: nextPumpActive,
        pumpLastUpdate: now,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Firebase calibrateTankLevel error:", err);
    }
  }
}

/**
 * Switch tank level telemetry source mode: "ultrasonic" (physical HC-SR04) or "calculated" (flow-rate dynamic depletion).
 */
export async function setTankLevelSource(source: TankLevelSource): Promise<void> {
  snapshot.config.tankLevelSource = source;
  if (snapshot.nodes.testNode) {
    snapshot.nodes.testNode = {
      ...snapshot.nodes.testNode,
      tankLevelSource: source,
    };
  }
  emit();

  const db = getDb();
  if (db) {
    try {
      await update(ref(db, "/config"), { tankLevelSource: source });
      await update(ref(db, "/nodes/testNode"), { tankLevelSource: source });
    } catch (err: unknown) {
      console.error("Firebase setTankLevelSource error:", err);
    }
  }
}

/**
 * Reset starting tank volume for calculated hydrodynamic level mode.
 */
export async function resetTankCalculatedVolume(
  nodeId: string,
  startingLitres: number = 850,
): Promise<void> {
  const targetId = nodeId || "testNode";
  const n = snapshot.nodes[targetId];
  if (!n) return;
  const capacity = n.tankCapacityLitres || 1000;
  const clampedVol = Math.max(0, Math.min(capacity, startingLitres));
  const fillPct = Number(((clampedVol / capacity) * 100).toFixed(1));
  const waterCm = Number(((fillPct / 100) * 200).toFixed(1));
  const distanceCm = Number((200 - waterCm).toFixed(1));

  snapshot.nodes[targetId] = {
    ...n,
    tankStartingVolumeLitres: clampedVol,
    tankWaterVolumeLitres: clampedVol,
    tankFillPercent: fillPct,
    tankWaterLevelCm: waterCm,
    tankDistanceCm: distanceCm,
  };
  emit();

  const db = getDb();
  if (db) {
    try {
      await update(ref(db, `/nodes/${targetId}`), {
        tankStartingVolumeLitres: clampedVol,
        tankWaterVolumeLitres: clampedVol,
        tankFillPercent: fillPct,
        tankWaterLevelCm: waterCm,
        tankDistanceCm: distanceCm,
      });
    } catch (err: unknown) {
      console.error("Firebase resetTankCalculatedVolume error:", err);
    }
  }
}

/**
 * Returns UI tone, badge styling, and title for a tank level status.
 */
export function getTankStatusBadge(status?: TankStatus, fillPercent: number = 0) {
  if (status === "sensor_error") {
    return {
      status: "sensor_error" as const,
      label: "Sensor Error",
      tone: "danger" as const,
      color: "text-rose-400",
      badgeClass: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
      description: "Invalid or missing ultrasonic sensor readings from Pin D6/D8.",
    };
  }
  if (status === "critical" || fillPercent < 15) {
    return {
      status: "critical" as const,
      label: "Critically Low",
      tone: "danger" as const,
      color: "text-rose-400",
      badgeClass: "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse",
      description: "Tank water level critically low (<15%). Emergency refill required.",
    };
  }
  if (status === "low" || fillPercent < 25) {
    return {
      status: "low" as const,
      label: "Running Low",
      tone: "warning" as const,
      color: "text-amber-400",
      badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
      description: "Tank is below normal capacity. Auto-pump activates below 20%.",
    };
  }
  if (status === "full" || fillPercent >= 95) {
    return {
      status: "full" as const,
      label: "Tank Full",
      tone: "success" as const,
      color: "text-cyan-400",
      badgeClass: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40",
      description: "Tank has reached maximum storage capacity. Pump cutoff active.",
    };
  }
  return {
    status: "normal" as const,
    label: "Optimal Level",
    tone: "success" as const,
    color: "text-emerald-400",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    description: "Tank volume within normal operating parameters.",
  };
}

/**
 * Update flow ceilings strictly at /config/thresholds.
 * Do not write to any other path.
 */
export async function updateThresholds(next: Thresholds): Promise<void> {
  // 1. Validate fields
  const keys: (keyof Thresholds)[] = [
    "normalTime",
    "breakTime",
    "holiday",
    "specialEvent",
    "emergency",
    "custom",
  ];

  for (const k of keys) {
    const val = Number(next[k]);
    if (isNaN(val) || val <= 0 || val > 100) {
      throw new Error(
        `Invalid threshold for ${k}: must be a positive number between 0 and 100 L/min`,
      );
    }
  }

  const payload = {
    normalTime: Number(next.normalTime),
    breakTime: Number(next.breakTime),
    holiday: Number(next.holiday),
    specialEvent: Number(next.specialEvent),
    emergency: Number(next.emergency),
    custom: Number(next.custom),
  };

  const db = getDb();
  if (!db) {
    throw new Error("Firebase Realtime Database instance unavailable");
  }

  // Update strictly at /config/thresholds
  await update(ref(db, "/config/thresholds"), payload);

  // Reconcile and reload from Firebase
  const verifySnap = await get(ref(db, "/config/thresholds"));
  if (verifySnap.exists() && verifySnap.val()) {
    const verified = verifySnap.val() as Record<string, unknown>;
    snapshot.config.thresholds = {
      normalTime: Number(verified.normalTime ?? payload.normalTime),
      breakTime: Number(verified.breakTime ?? payload.breakTime),
      holiday: Number(verified.holiday ?? payload.holiday),
      specialEvent: Number(verified.specialEvent ?? payload.specialEvent),
      emergency: Number(verified.emergency ?? payload.emergency),
      custom: Number(verified.custom ?? payload.custom),
    };
    snapshot.config.thresholdsStatus = "loaded";
    snapshot.config.thresholdsError = null;
    emit();
  }
}

/**
 * Resolve an alert: moves it from active to history
 */
export async function resolveAlert(id: string) {
  const found = snapshot.alerts.active.find((a) => a.id === id);
  if (!found) return;

  snapshot.alerts.active = snapshot.alerts.active.filter((a) => a.id !== id);
  snapshot.alerts.history = [{ ...found, resolved: true }, ...snapshot.alerts.history];
  emit();

  const db = getDb();
  if (db) {
    try {
      await remove(ref(db, `/alerts/active/${id}`));
      await set(ref(db, `/alerts/history/${id}`), { ...found, resolved: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Firebase resolveAlert error:", err);
      toast.error(`Firebase error: ${msg}`);
    }
  }
}

/**
 * Update institution name in /config/institutionName
 */
export async function updateInstitution(name: string) {
  snapshot.config.institutionName = name;
  emit();

  const db = getDb();
  if (db) {
    try {
      await update(ref(db, `/config`), { institutionName: name });
    } catch (err: unknown) {
      console.error("Firebase updateInstitution error:", err);
    }
  }
}

export function severityColor(s: AlertSeverity) {
  return {
    critical: "text-destructive",
    high: "text-destructive",
    medium: "text-warning",
    low: "text-info",
    info: "text-muted-foreground",
  }[s];
}

export function alertTypeLabel(t: AlertType) {
  return {
    possible_leak: "Possible Leak",
    continuous_flow: "Continuous Flow",
    valve_failure: "Valve Failure",
    communication_failure: "Communication Failure",
    node_offline: "Node Offline",
    high_usage: "High Usage",
    low_usage: "Low Usage",
    tampering: "Tampering Detected",
    ai_prediction: "AI Prediction",
  }[t];
}

/**
 * Calculates automated, correlated TDS metrics based on water pH.
 * Neutral (6.5 – 8.5): Safe, optimal drinking water (160 – 220 ppm)
 * Acidic (< 6.5): Corrosive leaching anomaly & heavy metal dissolution (300 – 900+ ppm)
 * Basic (> 8.5): Calcium carbonate scaling & caustic mineral hardness anomaly (400 – 1100+ ppm)
 */
export function calculateCorrelatedTds(ph: number) {
  const clampedPh = Math.max(0, Math.min(14, ph));
  let ppm: number;
  let status = "monitoring";
  let interpretation = "Balanced mineral potability standard";

  if (clampedPh < 6.5) {
    // Acidic range: heavy metal leaching & pipe corrosion
    const diff = 7.0 - clampedPh;
    ppm = Math.round(160 + Math.pow(diff, 1.35) * 115);
    status = ppm > 600 ? "leaching_critical" : "leaching_warning";
    interpretation = `Acidic leaching: corrosive mineral & metal dissolution (pH ${clampedPh.toFixed(1)})`;
  } else if (clampedPh > 8.5) {
    // Alkaline range: high calcium carbonate hardness & caustic scaling
    const diff = clampedPh - 7.0;
    ppm = Math.round(160 + Math.pow(diff, 1.45) * 195);
    status = ppm > 600 ? "scale_critical" : "scale_warning";
    interpretation = `Alkaline scaling: elevated calcium carbonate & caustic mineral hardness (pH ${clampedPh.toFixed(1)})`;
  } else {
    // Safe neutral range (6.5 – 8.5)
    const offset = Math.abs(clampedPh - 7.0);
    ppm = Math.round(160 + offset * 30);
    status = "optimal";
    interpretation = `Safe potable mineral concentration (EPA standard: <300 ppm)`;
  }

  const voltage = Number(Math.min(3.3, Math.max(0.04, (ppm / 1100) * 3.0)).toFixed(3));
  const adc = Math.min(1023, Math.round((voltage / 3.3) * 1024));

  return {
    tdsPpm: ppm,
    tdsVoltage: voltage,
    tdsRawADC: adc,
    tdsStatus: status,
    interpretation,
  };
}

/**
 * Update / calibrate the water pH reading on a node.
 * Automatically computes and synchronizes correlated automated TDS metrics to Firebase RTDB.
 * Writes to /nodes/{nodeId}/ph, /nodes/{nodeId}/phValue and /nodes/{nodeId}/tdsPpm.
 */
export async function updateNodePh(nodeId: string, ph: number): Promise<void> {
  const targetId = nodeId || "testNode";
  const rounded = Number(Math.max(0, Math.min(14, ph)).toFixed(2));
  const mode = rounded < 6.5 ? "acidic" : rounded > 8.5 ? "basic" : "neutral";
  const simulatedVoltage = Number((2.50 + (rounded - 7.0) * 0.22).toFixed(3));
  const autoTds = calculateCorrelatedTds(rounded);
  const now = Date.now();
  const n = snapshot.nodes[targetId] || snapshot.nodes.testNode;
  if (n) {
    snapshot.nodes[targetId] = {
      ...n,
      ph: rounded,
      phValue: rounded,
      phVoltage: simulatedVoltage,
      phMode: mode,
      phActive: true,
      phLastUpdate: now,
      tdsPpm: autoTds.tdsPpm,
      tdsVoltage: autoTds.tdsVoltage,
      tdsRawADC: autoTds.tdsRawADC,
      tdsStatus: autoTds.tdsStatus,
      tdsLastUpdate: now,
      lastUpdate: now,
    };
    snapshot.config.phTarget = rounded;
    emit();
  }

  const db = getDb();
  if (db) {
    try {
      const payload = {
        ph: rounded,
        phValue: rounded,
        phVoltage: simulatedVoltage,
        phMode: mode,
        phActive: true,
        phLastUpdate: now,
        tdsPpm: autoTds.tdsPpm,
        tdsVoltage: autoTds.tdsVoltage,
        tdsRawADC: autoTds.tdsRawADC,
        tdsStatus: autoTds.tdsStatus,
        tdsLastUpdate: now,
        lastUpdate: now,
      };
      await update(ref(db, `/nodes/${targetId}`), payload);
      await update(ref(db, `/hydrax/nodes/${targetId}`), payload);
      await update(ref(db, `/config`), {
        ph: rounded,
        phTarget: rounded,
        phMode: mode,
        lastPhUpdate: now,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Firebase updateNodePh error:", err);
      toast.error(`Firebase error: ${msg}`);
      throw err;
    }
  }
}

/**
 * Returns safety status, theme tone and explanation for a given pH value.
 * Standard drinking water safe range (EPA/WHO): 6.5 – 8.5 pH.
 * Below 6.5: Acidic
 * 6.5 – 8.5: Neutral / Optimal
 * Above 8.5: Basic / Alkaline
 */
export function getPhStatus(ph: number) {
  if (ph < 6.5) {
    return {
      status: "Acidic",
      mode: "acidic" as const,
      title: "Acidic Water (< 6.5 pH)",
      tone: "danger" as const,
      color: "text-rose-400",
      border: "border-rose-500/40",
      bg: "bg-rose-500/10",
      cardAccent: "from-rose-500/25 to-primary/10",
      badgeClass: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
      description: "Corrosive to copper and lead pipes; metallic taste and pipe degradation alert.",
    };
  }
  if (ph > 8.5) {
    return {
      status: "Basic (Alkaline)",
      mode: "basic" as const,
      title: "Basic / Alkaline Water (> 8.5 pH)",
      tone: "warning" as const,
      color: "text-purple-400",
      border: "border-purple-500/40",
      bg: "bg-purple-500/10",
      cardAccent: "from-purple-500/25 to-primary/10",
      badgeClass: "bg-purple-500/20 text-purple-300 border border-purple-500/40",
      description: "High mineral solids; potential for scaling, lime deposits and bitter taste.",
    };
  }
  return {
    status: "Neutral (Safe)",
    mode: "neutral" as const,
    title: "Neutral Safe Drinking Water (6.5 – 8.5 pH)",
    tone: "success" as const,
    color: "text-emerald-400",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    cardAccent: "from-emerald-500/25 to-primary/10",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    description: "Optimal balanced pH for drinking (EPA/WHO standard: 6.5–8.5). Safe and non-corrosive.",
  };
}

/**
 * Returns water purity category, quality tone, and explanation for TDS (Total Dissolved Solids in ppm).
 * 0 - 50: Pure / RO water
 * 50 - 150: Ideal drinking water
 * 150 - 300: Fair / Hard water
 * 300 - 500: High mineral / poor
 * > 500: Exceeds EPA drinking water threshold
 */
export function getTdsStatus(ppm: number) {
  if (ppm <= 50) {
    return {
      status: "Pure / Excellent",
      grade: "Ideal Drinking Water",
      tone: "success" as const,
      color: "text-emerald-400",
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/10",
      description: "Ultra-pure / RO filtered water with minimal dissolved solids.",
    };
  }
  if (ppm <= 150) {
    return {
      status: "Good",
      grade: "Standard Drinking Water",
      tone: "success" as const,
      color: "text-cyan-400",
      border: "border-cyan-500/30",
      bg: "bg-cyan-500/10",
      description: "Balanced mineral content; healthy drinking water.",
    };
  }
  if (ppm <= 300) {
    return {
      status: "Fair",
      grade: "Hard Water",
      tone: "info" as const,
      color: "text-sky-400",
      border: "border-sky-500/30",
      bg: "bg-sky-500/10",
      description: "Moderate mineral hardness; acceptable for consumption.",
    };
  }
  if (ppm <= 500) {
    return {
      status: "High TDS",
      grade: "High Mineral Solids",
      tone: "warning" as const,
      color: "text-amber-400",
      border: "border-amber-500/30",
      bg: "bg-amber-500/10",
      description: "Marginal quality; noticeable mineral scaling.",
    };
  }
  return {
    status: "Hazardous",
    grade: "Exceeds EPA Limit (500 ppm)",
    tone: "danger" as const,
    color: "text-rose-400",
    border: "border-rose-500/30",
    bg: "bg-rose-500/10",
    description: "High mineral contamination; water filtration strongly recommended.",
  };
}

export { nowHour };
