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
