import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { toast } from "sonner";
import type { HydraxSnapshot } from "@/lib/hydrax-types";

let permissionsRequested = false;
let channelCreated = false;
const lastNotificationTime: Record<string, number> = {};
const NOTIFICATION_COOLDOWN_MS = 45000; // 45 seconds cooldown per distinct abnormality key

/**
 * Initialize Notification permissions and high-priority Android channel.
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
        await LocalNotifications.createChannel({
          id: "hydrax_water_alerts",
          name: "HYDRAXX Water Safety & Anomaly Alerts",
          description: "High priority alarms for pH abnormalities, toxic TDS, and reservoir overflow/emptying.",
          importance: 5, // High / Urgent (makes sound and pops on screen)
          visibility: 1, // Public on lockscreen
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
 */
export async function sendWaterAbnormalityAlert(
  key: string,
  title: string,
  body: string,
  severity: "critical" | "warning" | "info" = "warning",
): Promise<void> {
  const now = Date.now();
  const lastTime = lastNotificationTime[key] || 0;

  // Enforce cooldown so users aren't spammed while a condition remains active
  if (now - lastTime < NOTIFICATION_COOLDOWN_MS) {
    return;
  }
  lastNotificationTime[key] = now;

  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();

  // 1. Android Native Notification (via Capacitor)
  if (isNative) {
    try {
      await initNotifications();
      const notifId = Math.floor(Math.random() * 100000) + 1;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            channelId: "hydrax_water_alerts",
            schedule: { at: new Date(Date.now() + 100) },
            sound: undefined,
            extra: { key, severity },
          },
        ],
      });
    } catch (err) {
      console.warn("Failed to schedule native Android notification:", err);
    }
  } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    // 2. Web Browser Notification
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: key,
      });
    } catch { }
  }

  // 3. In-App Sonner Toast
  if (severity === "critical") {
    toast.error(title, { description: body, duration: 6000 });
  } else if (severity === "warning") {
    toast.warning(title, { description: body, duration: 5000 });
  } else {
    toast.info(title, { description: body, duration: 4000 });
  }
}

/**
 * Evaluates snapshot telemetry and triggers alerts if abnormalities are sensed in the water.
 */
export function checkWaterTelemetryAbnormalities(snapshot: HydraxSnapshot): void {
  const node = snapshot.nodes.testNode || Object.values(snapshot.nodes)[0];
  if (!node) return;

  const ph = node.phValue ?? node.ph;
  const tds = node.tdsPpm;
  const fillPercent = node.tankFillPercent;
  const flow = node.flowRate;
  const threshold = node.threshold ?? 22;

  // 1. pH Abnormalities
  if (ph != null) {
    if (ph < 6.5) {
      sendWaterAbnormalityAlert(
        "abnormality_ph_acidic",
        "⚠️ Acidic Water Anomaly Detected!",
        `Water pH measured at ${ph.toFixed(2)} (< 6.5). High corrosion hazard & heavy metal leaching risk!`,
        "critical",
      );
    } else if (ph > 8.5) {
      sendWaterAbnormalityAlert(
        "abnormality_ph_alkaline",
        "⚠️ High Alkaline / Basic Water Anomaly!",
        `Water pH measured at ${ph.toFixed(2)} (> 8.5). Caustic mineral scaling & disinfectant loss alert.`,
        "warning",
      );
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
