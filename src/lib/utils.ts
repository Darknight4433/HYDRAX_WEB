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
 * Formats water volume: shows milliliters (mL) when under 1.0 Litre,
 * and Litres (L) only once it reaches or exceeds 1.0 Litre.
 */
export function formatWaterVolume(litres: number | null | undefined): {
  value: string;
  unit: string;
  formatted: string;
  alternate: string;
  isLitres: boolean;
} {
  const val = typeof litres === "number" && !isNaN(litres) ? Math.max(0, litres) : 0;
  if (val >= 1.0) {
    const ml = Math.round(val * 1000);
    return {
      value: val.toFixed(2),
      unit: "L",
      formatted: `${val.toFixed(2)} L`,
      alternate: `${ml.toLocaleString()} mL`,
      isLitres: true,
    };
  }
  const ml = Math.round(val * 1000);
  return {
    value: String(ml),
    unit: "mL",
    formatted: `${ml} mL`,
    alternate: `${val.toFixed(3)} L`,
  };
}
