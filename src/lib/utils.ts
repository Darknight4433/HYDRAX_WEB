import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a given Date or timestamp into a strictly 12-hour clock format (hh:mm:ss AM/PM).
 */
export function format12HourTime(
  dateOrMs: Date | number,
  options?: { includeSeconds?: boolean; includeDate?: boolean },
): string {
  const date = typeof dateOrMs === "number" ? new Date(dateOrMs) : dateOrMs;
  if (isNaN(date.getTime())) return "—";

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: options?.includeSeconds !== false ? "2-digit" : undefined,
    hour12: true,
  });

  if (options?.includeDate) {
    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${dateStr} · ${timeStr}`;
  }

  return timeStr;
}

/**
 * Formats water volume directly in milliliters (mL) from Firebase.
 * Shows milliliter (mL) directly for the value from Firebase.
 * If the value reaches or exceeds 1,000 mL (1 Litre), automatically displays Litres (L).
 */
export function formatWaterVolume(firebaseValue: number | null | undefined): {
  value: string;
  unit: string;
  formatted: string;
} {
  const val = typeof firebaseValue === "number" && !isNaN(firebaseValue) ? Math.max(0, firebaseValue) : 0;
  if (val >= 1000) {
    const litres = val / 1000;
    return {
      value: litres.toFixed(2),
      unit: "L",
      formatted: `${litres.toFixed(2)} L`,
    };
  }
  const str = Number.isInteger(val) ? val.toString() : val.toFixed(2);
  return {
    value: str,
    unit: "mL",
    formatted: `${str} mL`,
  };
}

/**
 * Formats tank water volume: Converts reservoir volume (stored in Litres in Firebase)
 * directly into milliliters (mL) for clean, unified display.
 */
export function formatTankVolume(litres: number | null | undefined): {
  value: string;
  unit: string;
  formatted: string;
} {
  const val = typeof litres === "number" && !isNaN(litres) ? Math.max(0, litres) : 0;
  const ml = Math.round(val * 1000);
  return {
    value: String(ml),
    unit: "mL",
    formatted: `${ml} mL`,
  };
}
