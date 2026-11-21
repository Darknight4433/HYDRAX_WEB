import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  Cpu,
  Droplets,
  ExternalLink,
  Gauge,
  Layers,
  Power,
  Radio,
  RotateCw,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  calibrateTankLevel,
  getTankStatusBadge,
  setPumpMode,
  setPumpState,
  setTankLevelSource,
} from "@/lib/hydrax-store";
import type { HydraxNode } from "@/lib/hydrax-types";
import { toast } from "sonner";

interface TankPumpMonitorProps {
  node?: HydraxNode | null;
  compact?: boolean;
  showControls?: boolean;
}

export function TankPumpMonitor({
  node,
  compact = false,
  showControls = true,
}: TankPumpMonitorProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Real reservoir telemetry (the tank retains water even when there is no flow)
  const isOnline = Boolean(node?.online);
  const fillPct = node?.tankFillPercent ?? 80.9;
  const capacity = node?.tankCapacityLitres ?? 1.24;
  const volume = node?.tankWaterVolumeLitres ?? 1.00;
  const waterLevelCm = node?.tankWaterLevelCm ?? 10.8;
  const distanceCm = node?.tankDistanceCm ?? 2.0;
  const statusInfo = getTankStatusBadge(node?.tankStatus, fillPct);

  const flowRate = node?.flowRate ?? 0;
  const isPumpActive = node?.pumpState === "on" || Boolean(node?.pumpActive);
  const isAuto = (node?.pumpMode ?? "auto") === "auto";
  const startPct = node?.pumpStartLevelPercent ?? 20;
  const stopPct = node?.pumpStopLevelPercent ?? 90;

  // Rate calculations for frustum tank (128mm height, 95mm bottom, 126mm top)
  const pumpRate = isPumpActive ? 0.60 : 0;
  const netRate = pumpRate - flowRate;
  const avgAreaCm2 = Math.PI * 5.525 * 5.525;
  const levelDropRateCmMin = Number(((flowRate * 1000.0) / avgAreaCm2).toFixed(2));
  const depletionRateLpm = flowRate;

  // Estimated depletion ETA
  const minutesToEmpty =
    flowRate > 0 && netRate < 0 && volume > 0 ? Math.round(volume / Math.abs(netRate)) : null;
  const etaHours = minutesToEmpty ? Math.floor(minutesToEmpty / 60) : 0;
  const etaMins = minutesToEmpty ? minutesToEmpty % 60 : 0;

  const handleTogglePump = async () => {
    if (!node) return;
    const nextState = isPumpActive ? "off" : "on";
    setIsUpdating(true);
    try {
      await setPumpState(node.id, nextState);
      toast.success(
        nextState === "on"
          ? "Refill Pump Activated (Relay D2 Energized)"
          : "Refill Pump Deactivated (Relay D2 Idle)",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Pump command error: ${msg}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleLevelSource = async () => {
    const nextSource = isCalculatedMode ? "ultrasonic" : "calculated";
    setIsUpdating(true);
    try {
      await setTankLevelSource(nextSource);
      toast.success(
        nextSource === "ultrasonic"
          ? "Switched to Real Ultrasonic Sensor Mode (HC-SR04 Pins D6/D8)"
          : "Switched to Flow-Calculated Dynamic Level Mode (Decreases with Flow)",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Mode change error: ${msg}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleMode = async () => {
    if (!node) return;
    const nextMode = isAuto ? "manual" : "auto";
    setIsUpdating(true);
    try {
      await setPumpMode(node.id, nextMode);
      toast.success(
        nextMode === "auto"
          ? "Switched to Automatic Hysteresis Mode"
          : "Switched to Manual Pump Control",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Mode change error: ${msg}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <GlassCard className="border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-black/40 to-blue-950/20 overflow-hidden">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
            <Droplets className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                Main Reservoir &amp; Automatic Refill Pump
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated Dynamic Level Depletion (-flowRate L/min) &amp; Automated Hysteresis Pump Refill.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Automatic Level Status Pill */}
          <div
            className="text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 border bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
            title="Water level automatically reduces as flow is detected, refilling via automated hysteresis"
          >
            <Radio className="h-3 w-3 animate-pulse" />
            <span>Automatic Level Engine</span>
          </div>

          <StatusPill tone={isPumpActive ? "success" : "muted"} pulse={isPumpActive}>
            Pump {isPumpActive ? "RUNNING" : "STANDBY"}
          </StatusPill>
          <StatusPill tone="info">
            Mode: {isAuto ? "AUTO (20%–90%)" : "MANUAL"}
          </StatusPill>
        </div>
      </div>

      {/* Main Grid: Water Tank Cylinder + Telemetry & Pump Controller */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        {/* Left: 3D Visual Water Tank Reservoir (4 cols) */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col items-center justify-between rounded-2xl border border-cyan-500/30 bg-black/40 p-4 shadow-inner">
          <div className="w-full flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1 font-semibold text-cyan-400">
              <Layers className="h-3.5 w-3.5" /> Storage Tank (128mm × 95–126mm)
            </span>
            <span className="font-mono text-[11px] text-foreground">
              {capacity.toFixed(2)} Litres Total (1236 mL)
            </span>
          </div>

          {/* Animated Water Cylinder (Frustum: 95mm base to 126mm top, 128mm height) */}
          <div className="relative w-36 sm:w-44 h-56 rounded-2xl border-2 border-cyan-500/40 bg-slate-950/80 shadow-2xl overflow-hidden flex flex-col justify-end p-1">
            {/* Level Sensor Cap at top */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded-full border border-cyan-500/40 z-20">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[9px] font-mono text-cyan-300">Auto-Level (128mm)</span>
            </div>

            {/* Ultrasonic Sonic Waves Graphic */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-16 flex flex-col items-center gap-1 opacity-40 z-10">
              <div className="w-4 h-0.5 bg-cyan-400 rounded-full" />
              <div className="w-8 h-0.5 bg-cyan-400 rounded-full" />
              <div className="w-12 h-0.5 bg-cyan-400 rounded-full" />
            </div>

            {/* Scale Markings on right (128mm tank height) */}
            <div className="absolute inset-y-3 right-1 flex flex-col justify-between text-[8px] font-mono font-semibold text-muted-foreground/80 z-20 pointer-events-none pr-1">
              <span>128mm (100%)</span>
              <span className="text-cyan-400">90% Stop</span>
              <span>75%</span>
              <span>73mm (50%)</span>
              <span className="text-amber-400">20% Start</span>
              <span>0mm (0%)</span>
            </div>

            {/* Hysteresis Threshold Guideline: Stop Cutoff (90%) */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-cyan-400/80 z-20 pointer-events-none"
              style={{ bottom: `${stopPct}%` }}
              title={`Pump Cutoff: ${stopPct}%`}
            />

            {/* Hysteresis Threshold Guideline: Start Refill (20%) */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-amber-400/80 z-20 pointer-events-none"
              style={{ bottom: `${startPct}%` }}
              title={`Pump Start: ${startPct}%`}
            />

            {/* Liquid Body with Dynamic Height */}
            <div
              className="relative w-full rounded-b-xl transition-all duration-700 ease-out flex flex-col justify-end overflow-hidden"
              style={{
                height: `${Math.max(4, Math.min(100, fillPct))}%`,
                background:
                  fillPct < 15
                    ? "linear-gradient(to top, rgba(225, 29, 72, 0.85), rgba(244, 63, 94, 0.6))"
                    : fillPct < 25
                      ? "linear-gradient(to top, rgba(217, 119, 6, 0.85), rgba(245, 158, 11, 0.6))"
                      : "linear-gradient(to top, rgba(6, 182, 212, 0.85), rgba(59, 130, 246, 0.6))",
              }}
            >
              {/* Surface Wave Effect */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-white/30 backdrop-blur-xs animate-pulse" />

              {/* Water Volume In-Tank Pill */}
              <div className="z-10 py-2 text-center text-white drop-shadow-md">
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight leading-none">
                  {fillPct.toFixed(1)}%
                </div>
                <div className="text-[10px] font-medium text-white/90 mt-0.5">
                  {volume.toFixed(2)} L ({Math.round(volume * 1000)} mL)
                </div>
              </div>
            </div>
          </div>

          {/* Quick status pill under tank */}
          <div className="mt-3 text-center">
            <p className="text-[11px] text-muted-foreground">{statusInfo.description}</p>
          </div>
        </div>

        {/* Right: Telemetry Metrics & Automated Pump Controller (7/8 cols) */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col justify-between gap-4">
          {/* Key Metric Tiles (5 responsive columns including Level Decrease Rate) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="rounded-xl border border-border/40 bg-black/30 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Water Level
              </div>
              <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-foreground">
                {waterLevelCm.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">cm</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{Math.round(waterLevelCm * 10)} mm of 128 mm</div>
            </div>

            <div className="rounded-xl border border-border/40 bg-black/30 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Air Distance
              </div>
              <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-cyan-400">
                {distanceCm.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">cm</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{Math.round(distanceCm * 10)} mm air gap</div>
            </div>

            <div className="rounded-xl border border-border/40 bg-black/30 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Water Stored
              </div>
              <div className="mt-1 text-lg sm:text-xl font-bold font-mono text-emerald-400">
                {volume.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">L</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{Math.round(volume * 1000)} mL of {capacity.toFixed(2)}L</div>
            </div>

            {/* Level Decrease Rate Tile */}
            <div className="rounded-xl border border-border/40 bg-black/30 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Decrease Rate</span>
                {flowRate > 0 && <TrendingDown className="h-3 w-3 text-rose-400 animate-pulse" />}
              </div>
              <div
                className={`mt-1 text-lg sm:text-xl font-bold font-mono ${
                  flowRate > 0
                    ? "text-rose-400"
                    : isPumpActive
                      ? "text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                {flowRate > 0 ? `-${depletionRateLpm.toFixed(2)}` : isPumpActive ? `+${(pumpRate - flowRate).toFixed(2)}` : "0.00"}{" "}
                <span className="text-xs font-normal text-muted-foreground">L/m</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {flowRate > 0
                  ? `-${levelDropRateCmMin} cm/min drop`
                  : isPumpActive
                    ? "+1.5 cm/min refill"
                    : "Static (No flow)"}
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-black/30 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Pump State
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${isPumpActive ? "bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50" : "bg-muted-foreground/60"}`}
                />
                <span className={`text-base font-bold uppercase ${isPumpActive ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {isPumpActive ? "Active" : "Idle"}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">Relay on Pin D2</div>
            </div>
          </div>

          {/* Live Hydrodynamic Rate & Depletion Banner */}
          <div className="rounded-xl border border-cyan-500/30 bg-black/40 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              {flowRate > 0 ? (
                <TrendingDown className="h-4 w-4 text-rose-400 shrink-0 animate-bounce" />
              ) : isPumpActive ? (
                <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <Waves className="h-4 w-4 text-cyan-400 shrink-0" />
              )}
              <div>
                <span className="font-bold text-foreground">
                  Automated Hydrodynamic Flow Model:{" "}
                </span>
                <span className="text-muted-foreground">
                  {flowRate > 0
                    ? `Level decreasing at -${depletionRateLpm.toFixed(2)} L/min (-${levelDropRateCmMin} cm/min) as Pin D7 flow rate rises.`
                    : isPumpActive
                      ? `Refill active at +${(15.0 - flowRate).toFixed(2)} L/min via Pump Relay D2.`
                      : "No active outflow or inflow; reservoir level is static."}
                </span>
              </div>
            </div>

            {minutesToEmpty != null && minutesToEmpty > 0 && (
              <div className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-mono text-rose-300 font-semibold">
                Depletes in: ~{etaHours > 0 ? `${etaHours}h ` : ""}{etaMins}m
              </div>
            )}
          </div>

          {/* Automatic Hysteresis Controller Box */}
          <div className="rounded-2xl border border-border/40 bg-black/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Dual-Threshold Hysteresis Control
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-muted-foreground">Control Logic:</span>
                <span className="font-semibold text-cyan-300">
                  Refill below {startPct}% · Cutoff above {stopPct}%
                </span>
              </div>
            </div>

            {/* Visual Hysteresis Threshold Bar */}
            <div className="space-y-1.5">
              <div className="relative h-6 w-full rounded-xl bg-slate-900 border border-white/10 overflow-hidden flex items-center">
                {/* Hysteresis Refill Window (0% to 20%) */}
                <div
                  className="h-full bg-rose-500/25 border-r border-rose-500/40 flex items-center justify-center text-[9px] font-bold text-rose-300"
                  style={{ width: `${startPct}%` }}
                >
                  &lt;{startPct}% Refill ON
                </div>

                {/* Hysteresis Inactive Buffer Window (20% to 90%) */}
                <div
                  className="h-full bg-emerald-500/10 flex items-center justify-center text-[9px] text-emerald-400/80 font-medium"
                  style={{ width: `${stopPct - startPct}%` }}
                >
                  Hysteresis Deadband (Maintains State)
                </div>

                {/* Overflow Cutoff Window (90% to 100%) */}
                <div
                  className="h-full bg-cyan-500/25 border-l border-cyan-500/40 flex items-center justify-center text-[9px] font-bold text-cyan-300"
                  style={{ width: `${100 - stopPct}%` }}
                >
                  &gt;{stopPct}% Stop
                </div>

                {/* Current Level Marker Needle */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all duration-500 z-10"
                  style={{ left: `${Math.max(0, Math.min(100, fillPct))}%` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-md" />
                </div>
              </div>

              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0% Tank Empty</span>
                <span className="text-amber-400 font-semibold">Start Pump ({startPct}%)</span>
                <span className="text-cyan-400 font-semibold">Stop Pump ({stopPct}%)</span>
                <span>100% Full</span>
              </div>
            </div>
          </div>

          {/* Pump Control Action Buttons */}
          {showControls && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <Button
                variant={isAuto ? "outline" : "secondary"}
                size="sm"
                onClick={handleToggleMode}
                disabled={isUpdating}
                className="gap-2 border-border/60"
              >
                <Cpu className="h-4 w-4 text-primary" />
                <span>Mode: {isAuto ? "Switch to Manual Mode" : "Switch to Auto Hysteresis"}</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant={isPumpActive ? "destructive" : "default"}
                  size="sm"
                  onClick={handleTogglePump}
                  disabled={isUpdating}
                  className="gap-2 font-bold shadow-md w-full sm:w-auto"
                >
                  {isPumpActive ? (
                    <>
                      <Power className="h-4 w-4" /> Stop Pump Relay (D2)
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" /> Start Refill Pump (D2)
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
