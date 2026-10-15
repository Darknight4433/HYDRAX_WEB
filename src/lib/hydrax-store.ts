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
  Thresholds,
  ValveState,
  WemosController,
} from "./hydrax-types";

// Timeout after which a device is flagged stale if lastUpdate timestamp stops
const HEARTBEAT_TIMEOUT_MS = 60000;

function nowHour() {
  return new Date().getHours();
}

function initialController(): WemosController {
  return {
    online: false,
    model: "Wemos D1 Mini (ESP8266)",
    uptimeSec: 0,
    systemHealth: 100,
    lastUpdate: 0,
    firmware: "HYDRAXX-Wemos-v1.0",
    wifi: "Connecting...",
    pins: {
      flowSensor: "D7 (GPIO 13)",
      relay: "D5 (GPIO 14)",
      pushButton: "D3 (GPIO 0)",
    },
  };
}

function initialTestNode(): HydraxNode {
  return {
    id: "testNode",
    name: "Main Supply Line",
    location: "Central Pump Room",
    online: false,
    flowRate: 0,
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
    firmware: "HYDRAXX-Wemos-v1.0",
    wifi: "HYDRAXX-WIFI",
    buttonPressed: false,
  };
}

function initialSnapshot(): HydraxSnapshot {
  const ctrl = initialController();
  return {
    config: {
      institutionName: "HYDRAXX Smart Water",
      aiEnabled: false,
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
      const isFresh = Boolean(
        node.lastUpdate && Math.abs(now - node.lastUpdate) < HEARTBEAT_TIMEOUT_MS,
      );
      if (node.online !== isFresh) {
        snapshot.nodes[id] = { ...node, online: isFresh };
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

    if (changed) emit();
  }, 2000);
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
          const lastUp = typeof raw.lastUpdate === "number" ? raw.lastUpdate : now;
          const isFresh = Math.abs(now - lastUp) < HEARTBEAT_TIMEOUT_MS;

          updatedNodes[k] = {
            id: (raw.id as string) || k,
            name: (raw.name as string) || (k === "testNode" ? "Main Supply Line" : `Node ${k}`),
            location: (raw.location as string) || "Central Pump Room",
            online: typeof raw.online === "boolean" ? raw.online && isFresh : isFresh,
            flowRate: Number(raw.flowRate ?? 0),
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
            firmware: raw.firmware as string | undefined,
            wifi: raw.wifi as string | undefined,
            buttonPressed: Boolean(raw.buttonPressed),
          };

          if (k === "testNode") {
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

      const lastUp = typeof rawTest.lastUpdate === "number" ? rawTest.lastUpdate : now;
      const isFresh = Math.abs(now - lastUp) < HEARTBEAT_TIMEOUT_MS;

      const updatedNode: HydraxNode = {
        ...currentTest,
        flowRate: Number(rawTest.flowRate ?? 0),
        valveState: rawTest.valveState === "open" ? "open" : "closed",
        todayUsage: Number(rawTest.todayUsage ?? 0),
        buttonPressed: Boolean(rawTest.buttonPressed),
        uptimeSec: Number(rawTest.uptimeSec ?? 0),
        signal: Number(rawTest.signal ?? 0),
        online: isFresh,
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

  // Optimistic UI update
  snapshot.nodes[nodeId] = { ...n, valveState: state, manualOverride: true };
  emit();

  const db = getDb();
  if (db) {
    try {
      // Primary standard contract path
      await update(ref(db, `/nodes/${nodeId}`), {
        valveState: state,
        manualOverride: true,
      });

      // Backward-compatibility write to legacy firmware path:
      await update(ref(db, `/hydrax/control`), {
        relay: state === "open",
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

export { nowHour };
