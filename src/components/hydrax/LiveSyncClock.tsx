import { useState, useEffect } from "react";
import { Clock, RefreshCw, CheckCircle2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { format12HourTime } from "@/lib/utils";

export interface LiveSyncClockProps {
  lastSyncTimestamp?: number;
  className?: string;
  variant?: "header" | "pill" | "detail";
  showDate?: boolean;
}

/**
 * Live-ticking 12-hour clock component with Wemos hardware sync indicator.
 * Completely immune to SSR hydration mismatch by deferring client time until mount.
 */
export function LiveSyncClock({
  lastSyncTimestamp,
  className = "",
  variant = "header",
  showDate = true,
}: LiveSyncClockProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    setMounted(true);
    // Ticking every 1s
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!mounted) {
    // SSR fallback to prevent layout shift & hydration mismatch
    return (
      <div
        className={`inline-flex items-center gap-2 text-muted-foreground/70 text-xs ${className}`}
      >
        <Clock className="h-3.5 w-3.5 animate-pulse text-primary/60" />
        <span className="tabular-nums">--:--:-- --</span>
      </div>
    );
  }

  const timeString12 = format12HourTime(currentTime, { includeSeconds: true });
  const dateString = currentTime.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const hasRecentSync =
    lastSyncTimestamp &&
    lastSyncTimestamp > 0 &&
    Math.abs(currentTime.getTime() - lastSyncTimestamp) < 60000;

  const syncTime12 =
    lastSyncTimestamp && lastSyncTimestamp > 0
      ? format12HourTime(lastSyncTimestamp, { includeSeconds: true })
      : null;

  const syncTimeAgo =
    lastSyncTimestamp && lastSyncTimestamp > 0
      ? formatDistanceToNowStrict(lastSyncTimestamp, { addSuffix: true })
      : null;

  if (variant === "pill") {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-border/60 bg-black/25 px-3 py-1 text-xs backdrop-blur-md ${className}`}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
              hasRecentSync ? "bg-emerald-400" : "bg-sky-400"
            }`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              hasRecentSync ? "bg-emerald-500" : "bg-sky-500"
            }`}
          />
        </span>
        <Clock className="h-3 w-3 text-primary" />
        <span className="font-semibold tabular-nums text-foreground">{timeString12}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">12-hr</span>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" /> System 12h Clock
          </span>
          <span className="font-semibold tabular-nums text-foreground">{timeString12}</span>
        </div>
        {syncTime12 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-accent" /> Controller Sync
            </span>
            <span className="font-mono text-muted-foreground tabular-nums">
              {syncTime12} <span className="text-[10px]">({syncTimeAgo})</span>
            </span>
          </div>
        )}
      </div>
    );
  }

  // Default "header" variant
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="hidden sm:flex flex-col text-right">
        <div className="flex items-center justify-end gap-1.5 text-xs font-semibold tabular-nums text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>{timeString12}</span>
          <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold text-primary">
            12H
          </span>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          {showDate && <span>{dateString}</span>}
          {syncTime12 && (
            <>
              <span className="opacity-40">·</span>
              <span
                className="truncate inline-flex items-center gap-1"
                title={`Last Wemos Heartbeat: ${syncTime12} (${syncTimeAgo})`}
              >
                <CheckCircle2
                  className={`h-2.5 w-2.5 ${hasRecentSync ? "text-emerald-400" : "text-amber-400"}`}
                />
                Sync: {syncTime12}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
