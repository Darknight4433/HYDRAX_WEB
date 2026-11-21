import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { toast } from "sonner";
import type { HydraxSnapshot } from "@/lib/hydrax-types";

let permissionsRequested = false;
let channelCreated = false;
const lastNotificationTime: Record<string, number> = {};
const NOTIFICATION_COOLDOWN_MS = 45000; // 45 seconds cooldown per distinct abnormality key

// State transition tracker to ensure immediate push on contamination transitions
let lastPhState: "acidic" | "basic" | "neutral" | null = null;

export const ALERT_CHANNEL_ID = "hydrax_water_alerts_v2";

/**
 * Synthesizes an audible alert tone using Web Audio API.
 * Works seamlessly in web browsers and mobile WebView without external audio files.
 */
export function playContaminationAudioTone(severity: "critical" | "warning" | "info" = "critical") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (severity === "critical") {
      // High-urgency dual-tone alarm (880 Hz -> 660 Hz)
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else {
      // Moderate warning tone (587 Hz)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Autoplay restrictions or lack of audio permission - ignore silently
  }
}

/**
 * Triggers physical vibration patterns on supporting mobile devices.
 */
export function triggerContaminationHaptics(severity: "critical" | "warning" | "info" = "critical") {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      if (severity === "critical") {
        navigator.vibrate([350, 150, 350, 150, 500]);
      } else {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {
      // Unsupported or blocked
    }
  }
}

/**
 * Initialize Notification permissions and high-priority Android notification channel.
 */
export async function initNotifications(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      if (!permissionsRequested) {
        permissionsRequested = true;
        const status = await LocalNotifications.checkPermissions();
        if (status.display !== "granted") {
          await LocalNotifications.requestPermissions();
        }
      }

      if (!channelCreated) {
        channelCreated = true;
        // Register high-priority notification channel on Android
        await LocalNotifications.createChannel({
          id: ALERT_CHANNEL_ID,
          name: "HYDRAXX Water Safety & Contamination Alarms",
          description: "High priority alarms for pH contamination (acidic/basic), toxic TDS, and reservoir anomalies.",
          importance: 5, // High / Urgent (heads-up banner, vibration, sound)
          visibility: 1, // Public on lockscreen
          vibration: true,
          lights: true,
          lightColor: "#EF4444",
        });

        // Also register default channel as fallback
        await LocalNotifications.createChannel({
          id: "hydrax_water_alerts",
          name: "HYDRAXX System Alerts",
          description: "General alerts and flow anomaly notifications.",
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
          lightColor: "#06B6D4",
        });
      }
      return true;
    } catch (err) {
      console.warn("Capacitor LocalNotifications init warning:", err);
      return false;
    }
  } else {
    // Web Browser Notifications API
    if ("Notification" in window) {
      if (Notification.permission === "default" && !permissionsRequested) {
        permissionsRequested = true;
        try {
          await Notification.requestPermission();
        } catch { }
      }
      return Notification.permission === "granted";
    }
  }

  return false;
}

/**
 * Send a notification for water abnormalities (both on Android APK and Web Browser).
 * @param key Unique identifier for the alert type
 * @param title Notification title
 * @param body Notification message
 * @param severity "critical" | "warning" | "info"
 * @param force If true, bypasses the 45-second cooldown (used for state transitions and test alerts)
 */
export async function sendWaterAbnormalityAlert(
  key: string,
  title: string,
  body: string,
  severity: "critical" | "warning" | "info" = "warning",
  force: boolean = false,
): Promise<void> {
  const now = Date.now();
  const lastTime = lastNotificationTime[key] || 0;

  // Enforce cooldown unless explicitly forced (e.g. on new state transition or test button)
  if (!force && now - lastTime < NOTIFICATION_COOLDOWN_MS) {
    return;
  }
  lastNotificationTime[key] = now;

  // Trigger audio chime and tactile haptic vibration
  playContaminationAudioTone(severity);
  triggerContaminationHaptics(severity);

  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();

  // 1. Android Native Push Notification (via Capacitor LocalNotifications)
  if (isNative) {
    try {
      await initNotifications();
      // Generate 32-bit positive integer notification ID
      const notifId = Math.floor(Math.random() * 900000) + 100000;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            largeBody: body,
            summaryText: "HYDRAXX Contamination Alert",
            channelId: ALERT_CHANNEL_ID,
            // Do NOT provide schedule: { at: ... } for immediate alerts to avoid AlarmManager restrictions
            extra: { key, severity, timestamp: now },
          },
        ],
      });
    } catch (err) {
      console.warn("Failed to schedule native Android notification:", err);
    }
  } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    // 2. Web Browser Notification (Desktop & Mobile Web)
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: key,
      });
    } catch { }
  }

  // 3. In-App Toast Alert (Sonner)
  if (severity === "critical") {
    toast.error(title, { description: body, duration: 8000 });
  } else if (severity === "warning") {
    toast.warning(title, { description: body, duration: 6000 });
  } else {
    toast.info(title, { description: body, duration: 4000 });
  }
}

/**
 * Direct tester function for Acidic or Basic phone push notifications.
 */
export async function triggerContaminationTest(type: "acidic" | "basic"): Promise<void> {
  if (type === "acidic") {
    await sendWaterAbnormalityAlert(
      "abnormality_ph_acidic",
      "⚠️ Water Contamination Threshold Detected",
      "Water pH detected at 4.50 (Acidic threshold breached: < 6.5). Elevated Correlated TDS: ~576 ppm (corrosive risk).",
      "critical",
      true, // force immediate delivery
    );
  } else {
    await sendWaterAbnormalityAlert(
      "abnormality_ph_basic",
      "⚠️ Water Contamination Threshold Detected",
      "Water pH detected at 9.00 (Basic threshold breached: > 8.5). Elevated Correlated TDS: ~713 ppm (caustic scaling risk).",
      "critical",
      true, // force immediate delivery
    );
  }
}

/**
 * Evaluates snapshot telemetry and triggers phone alerts if water contamination is detected.
 */
export function checkWaterTelemetryAbnormalities(snapshot: HydraxSnapshot): void {
  const node = snapshot.nodes.testNode || Object.values(snapshot.nodes)[0];
  if (!node) return;

  const ph = node.phValue ?? node.ph;
  const tds = node.tdsPpm;
  const fillPercent = node.tankFillPercent;
  const flow = node.flowRate;
  const threshold = node.threshold ?? 22;

  // 1. Water pH Contamination Detection (< 6.5 Acidic or > 8.5 Basic)
  if (ph != null) {
    if (ph < 6.5) {
      const isNewTransition = lastPhState !== "acidic";
      lastPhState = "acidic";
      sendWaterAbnormalityAlert(
        "abnormality_ph_acidic",
        "⚠️ Water Contamination Threshold Detected",
        `Water pH detected at ${ph.toFixed(2)} (Acidic threshold breached: < 6.5). Elevated Correlated TDS: ${tds != null ? tds.toFixed(0) : "576"} ppm (corrosive risk).`,
        "critical",
        isNewTransition,
      );
    } else if (ph > 8.5) {
      const isNewTransition = lastPhState !== "basic";
      lastPhState = "basic";
      sendWaterAbnormalityAlert(
        "abnormality_ph_basic",
        "⚠️ Water Contamination Threshold Detected",
        `Water pH detected at ${ph.toFixed(2)} (Basic threshold breached: > 8.5). Elevated Correlated TDS: ${tds != null ? tds.toFixed(0) : "713"} ppm (caustic scaling risk).`,
        "critical",
        isNewTransition,
      );
    } else {
      lastPhState = "neutral";
    }
  }

  // 2. TDS Abnormalities
  if (tds != null) {
    if (tds > 500) {
      sendWaterAbnormalityAlert(
        "abnormality_tds_hazard",
        "🚨 Severe TDS Contamination Alert!",
        `Total Dissolved Solids reached ${tds.toFixed(1)} ppm. Exceeds EPA safe drinking limit (500 ppm)!`,
        "critical",
      );
    } else if (tds > 300) {
      sendWaterAbnormalityAlert(
        "abnormality_tds_high",
        "⚠️ High TDS Hardness Alert",
        `Water TDS measured at ${tds.toFixed(1)} ppm. High dissolved minerals; filtration recommended.`,
        "warning",
      );
    }
  }

  // 3. Tank Level Abnormalities
  if (fillPercent != null) {
    if (fillPercent < 15) {
      sendWaterAbnormalityAlert(
        "abnormality_tank_critical",
        "🚨 Critical Reservoir Level Warning!",
        `Main water tank has dropped to ${fillPercent.toFixed(1)}%. Low water supply alert!`,
        "critical",
      );
    } else if (fillPercent >= 98 && node.pumpState === "on") {
      sendWaterAbnormalityAlert(
        "abnormality_tank_overflow",
        "⚠️ Tank Full Overflow Warning!",
        `Water tank is at ${fillPercent.toFixed(1)}% with refill pump active. Cutoff advised.`,
        "warning",
      );
    }
  }

  // 4. Over-Threshold Flow Anomaly
  if (flow != null && flow > threshold && node.online) {
    sendWaterAbnormalityAlert(
      "abnormality_flow_burst",
      "🚨 Excessive Water Flow Detected!",
      `Flow rate is ${flow.toFixed(2)} L/min, exceeding the active ceiling of ${threshold} L/min!`,
      "critical",
    );
  }
}
