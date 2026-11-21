import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Droplets,
  ExternalLink,
  FlaskConical,
  Layers,
  Minus,
  Palette,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Sliders,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { firebaseConfigured } from "@/lib/firebase";
import { sendWaterAbnormalityAlert } from "@/lib/notifications";
import {
  calculateCorrelatedTds,
  calibrateTankLevel,
  getPhStatus,
  getTankStatusBadge,
  getTdsStatus,
  resetTankCalculatedVolume,
  setPumpMode,
  setPumpState,
  setTankLevelSource,
  updateInstitution,
  updateNodePh,
  updatePumpThresholds,
  useHydrax,
} from "@/lib/hydrax-store";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";
import { format12HourTime } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { Capacitor } from "@capacitor/core";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "System Settings · HYDRAXX" },
      {
        name: "description",
        content:
          "Configure institution settings, Wemos D1 Mini controller hardware, and Firebase connection for HYDRAXX.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();
  const data = useHydrax();
  const [name, setName] = useState(data.config.institutionName);
  const [notif, setNotif] = useState(true);
  const [saving, setSaving] = useState(false);
  const node = data.nodes.testNode || Object.values(data.nodes)[0];

  const currentPh = node?.phValue ?? node?.ph ?? 6.6;
  const [phInput, setPhInput] = useState(String(currentPh));
  const [isDragging, setIsDragging] = useState(false);
  const [savingPh, setSavingPh] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const lastWriteTimeRef = useRef<number>(0);
  const pendingPhRef = useRef<number | null>(null);

  // Tank & Pump Hysteresis Settings (HYDRAXX v0.3.0)
  const [startLevel, setStartLevel] = useState(node?.pumpStartLevelPercent ?? 20);
  const [stopLevel, setStopLevel] = useState(node?.pumpStopLevelPercent ?? 90);
  const [savingPump, setSavingPump] = useState(false);

  useEffect(() => {
    if (node?.pumpStartLevelPercent != null) setStartLevel(node.pumpStartLevelPercent);
    if (node?.pumpStopLevelPercent != null) setStopLevel(node.pumpStopLevelPercent);
  }, [node?.pumpStartLevelPercent, node?.pumpStopLevelPercent]);

  useEffect(() => {
    if (!isDragging && (node?.phValue != null || node?.ph != null)) {
      setPhInput(String(node.phValue ?? node.ph));
    }
  }, [node?.phValue, node?.ph, isDragging]);

  const applyPhFromPointer = useCallback(
    (clientX: number, isFinal: boolean = false) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newPh = Math.round(ratio * 14 * 10) / 10;
      setPhInput(newPh.toFixed(1));
      pendingPhRef.current = newPh;

      const now = Date.now();
      if (isFinal || now - lastWriteTimeRef.current > 75) {
        lastWriteTimeRef.current = now;
        updateNodePh(node?.id || "testNode", newPh);
      }
    },
    [node?.id],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { }
    applyPhFromPointer(e.clientX, false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      applyPhFromPointer(e.clientX, false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch { }
      if (pendingPhRef.current != null) {
        updateNodePh(node?.id || "testNode", pendingPhRef.current);
        const s = getPhStatus(pendingPhRef.current);
        toast.success(
          `pH set to ${pendingPhRef.current.toFixed(1)} (${s.status}) — Synced to Dashboard!`,
        );
      }
    }
  };

  const activePhStatus = getPhStatus(currentPh);
  const selectedPhStatus = getPhStatus(parseFloat(phInput) || currentPh);
  const liveTds = calculateCorrelatedTds(parseFloat(phInput) || currentPh);
  const currentTds = node?.tdsPpm ?? liveTds.tdsPpm;
  const tdsStatus = getTdsStatus(liveTds.tdsPpm);

  return (
    <div>
      <PageHeader
        eyebrow="Configuration & Hardware"
        title="System Settings"
        description="Manage campus institution parameters, Wemos D1 Mini hardware mapping, and Firebase Realtime Database connectivity."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={node?.online ? node?.lastUpdate : undefined} />
            <StatusPill tone={node?.online ? "success" : "danger"} pulse={node?.online}>
              {node?.online ? "Wemos Online" : "Wemos Standby"}
            </StatusPill>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Main Reservoir & Automatic Pump Hysteresis Calibration Card (HYDRAXX v0.3.0) */}
        <GlassCard className="lg:col-span-2 border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-black/40 to-blue-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Droplets className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  Autonomous Reservoir Monitoring &amp; Automatic Water Level
                </h3>
                <p className="text-xs text-muted-foreground">
                  Continuous flow-rate depletion tracking (-flowRate L/min) &amp; automated pump hysteresis refills.
                </p>
              </div>
            </div>
            <Link to="/">
              <Button variant="secondary" size="sm" className="gap-1.5 shrink-0">
                View Reservoir in Dashboard <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Automatic Dynamic Hydrodynamic Water Level Depletion Engine */}
          <div className="mt-4 rounded-2xl border border-cyan-500/40 bg-black/40 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Automated Dynamic Reservoir Hydrodynamics</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Water level depletes automatically in real time as water flows through the supply line (-flowRate L/min), with automated hysteresis pump refills.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 text-xs text-cyan-300 font-mono">
                <TrendingDown className="h-4 w-4" />
                <span>Auto-Level Active</span>
              </div>
            </div>

            {/* Live Depletion Rate Metrics */}
            <div className="rounded-xl border border-border/40 bg-black/30 p-3.5 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    Active Water Outflow:{" "}
                    <strong className="text-cyan-300 font-mono">
                      {(node?.flowRate ?? (node?.valveState === "open" ? 5.2 : 0)).toFixed(2)} L/min
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-muted-foreground">Water Column Drop Rate:</span>
                  <span className="font-bold text-rose-400">
                    -{((node?.flowRate ?? (node?.valveState === "open" ? 5.2 : 0)) / 5.0).toFixed(2)} cm/min
                  </span>
                </div>
              </div>

              <div className="text-muted-foreground leading-relaxed">
                Water level decreases automatically every second when water flows through Pin D7 or when the valve is open.
                Current decrease rate:{" "}
                <strong className="text-rose-400 font-mono">
                  -{(node?.flowRate ?? (node?.valveState === "open" ? 5.2 : 0)).toFixed(2)} L/min
                </strong>{" "}
                (<strong className="text-rose-300 font-mono">-{((node?.flowRate ?? (node?.valveState === "open" ? 5.2 : 0)) / 5.0).toFixed(2)} cm/min</strong> water level reduction).
              </div>

              {/* Volume Baseline Presets */}
              <div className="pt-2 border-t border-border/30 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 text-cyan-400" /> Reset Starting Tank Volume:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: "Full (1.24L / 128mm)", vol: 1.24 },
                    { label: "Normal (1.00L / 108mm)", vol: 1.00 },
                    { label: "Half (0.62L / 73mm)", vol: 0.62 },
                    { label: "Refill (0.25L / 34mm)", vol: 0.25 },
                  ].map((preset) => (
                    <Button
                      key={preset.vol}
                      size="xs"
                      variant="ghost"
                      className="text-[10px] h-6 px-2 border border-border/40 hover:bg-white/10"
                      onClick={async () => {
                        await resetTankCalculatedVolume(node?.id || "testNode", preset.vol);
                        toast.success(`Tank volume calibrated to ${preset.vol} Litres!`);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            {/* Left: Hysteresis Threshold Configuration */}
            <div className="rounded-2xl border border-border/40 bg-black/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Pump Hysteresis Thresholds</span>
                </div>
                <StatusPill tone="info">
                  {node?.pumpMode === "manual" ? "Manual Override" : "Auto Hysteresis"}
                </StatusPill>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Pump Start Level (Refill ON):</span>
                    <span className="font-mono font-bold text-amber-400">{startLevel}%</span>
                  </div>
                  <Slider
                    min={5}
                    max={40}
                    step={1}
                    value={[startLevel]}
                    onValueChange={(val) => setStartLevel(val[0])}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    When water level falls below this value, the pump activates automatically.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Pump Stop Level (Overflow Cutoff):</span>
                    <span className="font-mono font-bold text-cyan-400">{stopLevel}%</span>
                  </div>
                  <Slider
                    min={60}
                    max={98}
                    step={1}
                    value={[stopLevel]}
                    onValueChange={(val) => setStopLevel(val[0])}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    When water level reaches this cutoff, the pump deactivates immediately.
                  </span>
                </div>

                <Button
                  size="sm"
                  className="w-full mt-2"
                  disabled={savingPump}
                  onClick={async () => {
                    setSavingPump(true);
                    try {
                      await updatePumpThresholds(node?.id || "testNode", startLevel, stopLevel);
                      toast.success(
                        `Hysteresis thresholds saved to Firebase: Start at ${startLevel}%, Stop at ${stopLevel}%!`,
                      );
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err);
                      toast.error(`Save failed: ${msg}`);
                    } finally {
                      setSavingPump(false);
                    }
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Save Hysteresis Thresholds
                </Button>
              </div>
            </div>

            {/* Right: Real Hardware Telemetry from Firebase */}
            <div className="rounded-2xl border border-border/40 bg-black/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2">
                  <Droplets className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Live Hardware Telemetry (From Firebase)</span>
                </div>
                <StatusPill tone={node?.online ? "success" : "muted"}>
                  {node?.online ? "Live ESP8266" : "Awaiting Sensor"}
                </StatusPill>
              </div>

              {/* Status & Metrics Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-black/40 p-3 text-center text-xs">
                <div>
                  <div className="text-[10px] text-muted-foreground">Water Level</div>
                  <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                    {(node?.online ? (node?.tankWaterLevelCm ?? 0) : 0).toFixed(1)} cm
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {Math.round((node?.online ? (node?.tankWaterLevelCm ?? 0) : 0) * 10)} mm / 128 mm
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Air Gap (Distance)</div>
                  <div className="font-mono font-bold text-cyan-400 text-sm mt-0.5">
                    {(node?.online ? (node?.tankDistanceCm ?? 12.8) : 12.8).toFixed(1)} cm
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {Math.round((node?.online ? (node?.tankDistanceCm ?? 12.8) : 12.8) * 10)} mm air gap
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Fill Percentage</div>
                  <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                    {(node?.online ? (node?.tankFillPercent ?? 0) : 0).toFixed(1)}%
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {node?.online ? "Active telemetry" : "Offline (0%)"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Water Volume</div>
                  <div className="font-mono font-bold text-foreground text-sm mt-0.5">
                    {(node?.online ? (node?.tankWaterVolumeLitres ?? 0) : 0).toFixed(2)} L
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {Math.round((node?.online ? (node?.tankWaterVolumeLitres ?? 0) : 0) * 1000)} mL of 1236 mL
                  </div>
                </div>
              </div>

              {/* Progress bar of real fill percentage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Tank Fullness</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {(node?.tankFillPercent ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, node?.tankFillPercent ?? 0))}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30 pt-2">
                <span>Firebase Read Path:</span>
                <code className="text-foreground text-[10px]">
                  /nodes/testNode/tankWaterLevelCm &amp; /tankDistanceCm
                </code>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Water Quality (pH & Correlated TDS) Calibration Card */}
        <GlassCard className="lg:col-span-2 border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  Automated Water Quality Hydrochemistry (pH &amp; Correlated TDS)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Dynamic electrochemical pH spectrum with automated, realistic TDS variation for acidic pipe leaching &amp; caustic mineral scaling.
                </p>
              </div>
            </div>
            <Link to="/">
              <Button variant="secondary" size="sm" className="gap-1.5 shrink-0">
                View Dashboard <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Current Live State Banner */}
          <div className="rounded-2xl border border-border/40 bg-black/30 p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
                  <span>Current Hydrochemical Telemetry</span>
                  {node?.online ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      ● Live Stream
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                      ● Standby (Saved)
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tabular-nums text-foreground">
                    {currentPh.toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">pH</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ml-2 ${activePhStatus.badgeClass}`}>
                    {activePhStatus.title}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  pH Electrode Voltage: <span className="font-mono text-foreground font-semibold">{node?.phVoltage ? `${node.phVoltage}V` : `${liveTds.tdsVoltage.toFixed(2)}V`}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Automated Correlated TDS: <span className="font-mono text-cyan-400 font-semibold">{liveTds.tdsPpm.toFixed(1)} ppm</span> ({tdsStatus.status}) · <span className="font-mono text-muted-foreground">{liveTds.tdsVoltage.toFixed(3)}V</span>
                </div>
              </div>
            </div>

            {/* Interactive Draggable Spectrum Bar */}
            <div className="mt-4 rounded-xl border border-border/40 bg-black/40 p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-rose-400">🔴 Acidic (&lt; 6.5)</span>
                <span className="text-emerald-400">🟢 Safe Neutral (6.5 – 8.5)</span>
                <span className="text-purple-400">🟣 Basic / Alkaline (&gt; 8.5)</span>
              </div>

              {/* The Draggable Bar Track Container */}
              <div className="relative w-full pt-7 pb-2">
                <div
                  ref={trackRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="relative h-11 w-full rounded-2xl bg-gradient-to-r from-rose-500 via-amber-400 via-emerald-400 to-indigo-600 shadow-inner border border-white/20 select-none cursor-pointer touch-none flex items-center px-1"
                >
                  {/* Graduation marks inside track */}
                  <div className="w-full flex justify-between px-3 text-[10px] sm:text-[11px] font-extrabold text-black/75 select-none pointer-events-none">
                    <span>0</span>
                    <span>2</span>
                    <span>4</span>
                    <span>6</span>
                    <span className="bg-white/95 px-2 py-0.5 rounded text-black font-extrabold shadow-sm">
                      7 Neutral
                    </span>
                    <span>8</span>
                    <span>10</span>
                    <span>12</span>
                    <span>14</span>
                  </div>

                  {/* Draggable Thumb Indicator */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 rounded-full border-2 border-white bg-black/90 shadow-2xl flex items-center justify-center pointer-events-none transition-transform"
                    style={{
                      left: `${Math.max(2, Math.min(98, (parseFloat(phInput || "7.2") / 14) * 100))}%`,
                    }}
                  >
                    <div
                      className={`h-4 w-4 rounded-full ${parseFloat(phInput || "7.2") < 6.5
                        ? "bg-rose-500 shadow-rose-500/80 shadow-md"
                        : parseFloat(phInput || "7.2") > 8.5
                          ? "bg-purple-500 shadow-purple-500/80 shadow-md"
                          : "bg-emerald-400 shadow-emerald-400/80 shadow-md"
                        } animate-pulse`}
                    />

                    {/* Floating Tooltip Pill Above Thumb */}
                    <div
                      className="absolute -top-8 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono shadow-xl whitespace-nowrap border pointer-events-none"
                      style={{
                        backgroundColor:
                          parseFloat(phInput || "7.2") < 6.5
                            ? "rgba(225, 29, 72, 0.95)"
                            : parseFloat(phInput || "7.2") > 8.5
                              ? "rgba(147, 51, 234, 0.95)"
                              : "rgba(16, 185, 129, 0.95)",
                        borderColor: "rgba(255, 255, 255, 0.4)",
                        color: "#ffffff",
                      }}
                    >
                      {parseFloat(phInput || "7.2").toFixed(1)} pH · {liveTds.tdsPpm} ppm
                      <div
                        className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
                        style={{
                          borderTopColor:
                            parseFloat(phInput || "7.2") < 6.5
                              ? "rgba(225, 29, 72, 0.95)"
                              : parseFloat(phInput || "7.2") > 8.5
                                ? "rgba(147, 51, 234, 0.95)"
                                : "rgba(16, 185, 129, 0.95)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Overlaid transparent range input for accessibility and keyboard navigation */}
                  <input
                    type="range"
                    min="0"
                    max="14"
                    step="0.1"
                    value={phInput}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        applyPhFromPointer(e.target.valueAsNumber, false);
                      }
                    }}
                    onPointerDown={() => setIsDragging(true)}
                    onPointerUp={() => {
                      setIsDragging(false);
                      const val = parseFloat(phInput);
                      if (!isNaN(val)) {
                        updateNodePh(node?.id || "testNode", val);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize touch-none"
                    title="Drag directly across this colored bar to change water pH"
                    aria-label="Water pH Drag Slider"
                  />
                </div>
              </div>

              {/* Realtime Bar Controls & Nudge Stepper */}
              <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-primary">
                    👆 Drag Bar to Calibrate:
                  </span>
                  <span className="text-foreground font-mono font-bold text-sm bg-black/50 border border-border/40 px-2.5 py-0.5 rounded-lg">
                    {parseFloat(phInput || "7.2").toFixed(2)} pH
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(phInput || "7.2");
                        const next = Math.max(0, Math.round((cur - 0.1) * 10) / 10);
                        setPhInput(next.toFixed(1));
                        updateNodePh(node?.id || "testNode", next);
                      }}
                      className="h-7 w-7 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold text-foreground transition-all"
                      title="Step down 0.1 pH"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(phInput || "7.2");
                        const next = Math.min(14, Math.round((cur + 0.1) * 10) / 10);
                        setPhInput(next.toFixed(1));
                        updateNodePh(node?.id || "testNode", next);
                      }}
                      className="h-7 w-7 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold text-foreground transition-all"
                      title="Step up 0.1 pH"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <span className={`font-semibold flex items-center gap-1.5 text-xs ${selectedPhStatus.color}`}>
                  <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                  {selectedPhStatus.title}
                </span>
              </div>
            </div>
          </div>

          {/* THREE PRIMARY MODE SELECTOR BUTTONS: ACIDIC, NEUTRAL, BASIC */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Select Preset Water pH Mode (Instant Update to Firebase & Dashboard)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. ACIDIC MODE */}
              <div
                className={`rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${currentPh < 6.5
                  ? "border-rose-500/80 bg-rose-500/15 ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/20"
                  : "border-border/40 bg-black/25 hover:border-rose-500/50 hover:bg-rose-500/5"
                  }`}
                onClick={async () => {
                  setSavingPh(true);
                  try {
                    await updateNodePh(node?.id || "testNode", 4.5);
                    setPhInput("4.5");
                    toast.success("Switched to ACIDIC (4.50 pH) — Synced to Firebase & APK in realtime!");
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(`Failed to update pH: ${msg}`);
                  } finally {
                    setSavingPh(false);
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      ACIDIC WATER MODE (pH 4.5)
                    </span>
                    <span className="text-xs font-mono text-cyan-300 font-semibold">TDS ~576 ppm · 1.57V</span>
                  </div>
                  <div className="mt-2 text-xl font-bold text-rose-400">
                    High Acidity · Corrosive Leaching Standard
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Corrosive pipe leaching anomaly. Elevated TDS (~576 ppm) from metallic dissolving (Cu, Fe, Pb) and heavy acidic ion mobility.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={currentPh < 6.5 ? "default" : "outline"}
                  className="mt-3 w-full border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
                  disabled={savingPh}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSavingPh(true);
                    try {
                      await updateNodePh(node?.id || "testNode", 4.5);
                      setPhInput("4.5");
                      toast.success("Switched to ACIDIC (4.50 pH) — Dashboard updated in realtime!");
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err);
                      toast.error(`Failed to update pH: ${msg}`);
                    } finally {
                      setSavingPh(false);
                    }
                  }}
                >
                  {currentPh < 6.5 ? "✓ Active (Acidic Mode)" : "Simulate Acidic (pH 4.5)"}
                </Button>
              </div>

              {/* 2. NEUTRAL / SAFE MODE */}
              <div
                className={`rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${currentPh >= 6.5 && currentPh <= 8.5
                  ? "border-emerald-500/80 bg-emerald-500/15 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20"
                  : "border-border/40 bg-black/25 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                  }`}
                onClick={async () => {
                  setSavingPh(true);
                  try {
                    await updateNodePh(node?.id || "testNode", 7.0);
                    setPhInput("7.0");
                    toast.success("Switched to NEUTRAL (7.00 pH) — Dashboard updated in realtime!");
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(`Failed to update pH: ${msg}`);
                  } finally {
                    setSavingPh(false);
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      NEUTRAL WATER STANDARD (pH 7.0)
                    </span>
                    <span className="text-xs font-mono text-cyan-300 font-semibold">TDS ~160 ppm · 0.43V</span>
                  </div>
                  <div className="mt-2 text-xl font-bold text-emerald-400">
                    Optimal EPA Safe Potability Standard
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Balanced hydrochemistry. TDS remains within pristine mineral range (160–220 ppm) with peak disinfection efficacy and zero corrosion.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={currentPh >= 6.5 && currentPh <= 8.5 ? "default" : "outline"}
                  className="mt-3 w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                  disabled={savingPh}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSavingPh(true);
                    try {
                      await updateNodePh(node?.id || "testNode", 7.0);
                      setPhInput("7.0");
                      toast.success("Switched to NEUTRAL (7.00 pH) — Dashboard updated in realtime!");
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err);
                      toast.error(`Failed to update pH: ${msg}`);
                    } finally {
                      setSavingPh(false);
                    }
                  }}
                >
                  {currentPh >= 6.5 && currentPh <= 8.5 ? "✓ Active (Safe Neutral)" : "Simulate Neutral (pH 7.0)"}
                </Button>
              </div>

              {/* 3. BASIC / ALKALINE MODE */}
              <div
                className={`rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${currentPh > 8.5
                  ? "border-purple-500/80 bg-purple-500/15 ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/20"
                  : "border-border/40 bg-black/25 hover:border-purple-500/50 hover:bg-purple-500/5"
                  }`}
                onClick={async () => {
                  setSavingPh(true);
                  try {
                    await updateNodePh(node?.id || "testNode", 9.0);
                    setPhInput("9.0");
                    toast.success("Switched to ALKALINE (9.00 pH) — Dashboard updated in realtime!");
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(`Failed to update pH: ${msg}`);
                  } finally {
                    setSavingPh(false);
                  }
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                      ALKALINE WATER MODE (pH 9.0)
                    </span>
                    <span className="text-xs font-mono text-cyan-300 font-semibold">TDS ~713 ppm · 1.95V</span>
                  </div>
                  <div className="mt-2 text-xl font-bold text-purple-400">
                    High Alkalinity · Caustic Scaling Standard
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Caustic scaling anomaly. TDS climbs to ~713 ppm due to calcium carbonate (CaCO₃) precipitation, mineral hardness, and pipe fouling.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={currentPh > 8.5 ? "default" : "outline"}
                  className="mt-3 w-full border-purple-500/40 text-purple-300 hover:bg-purple-500/20"
                  disabled={savingPh}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSavingPh(true);
                    try {
                      await updateNodePh(node?.id || "testNode", 9.0);
                      setPhInput("9.0");
                      toast.success("Switched to ALKALINE (9.00 pH) — Dashboard updated in realtime!");
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err);
                      toast.error(`Failed to update pH: ${msg}`);
                    } finally {
                      setSavingPh(false);
                    }
                  }}
                >
                  {currentPh > 8.5 ? "✓ Active (Alkaline Mode)" : "Simulate Alkaline (pH 9.0)"}
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Institution Info */}
        <GlassCard>
          <SectionTitle icon={Building2} label="Campus & Facility" />
          <div className="space-y-4">
            <Field label="Institution Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HYDRAXX Water Lab"
              />
            </Field>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Saved to /config/institutionName
              </span>
              <Button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await updateInstitution(name);
                    toast.success("Institution updated in Firebase");
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(`Update failed: ${msg}`);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save Name
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Controller Hardware */}
        <GlassCard>
          <SectionTitle icon={Cpu} label="Controller Hardware" />
          <div className="space-y-3">
            <Row
              label="Hardware Model"
              value={<span className="text-sm font-semibold">Wemos D1 Mini (ESP8266)</span>}
            />
            <Row
              label="Connection State"
              value={
                <StatusPill tone={node?.online ? "success" : "danger"} pulse={node?.online}>
                  {node?.online ? "Online & Polling" : "Offline / Awaiting Hardware Data"}
                </StatusPill>
              }
            />
            <Row
              label="Flow Sensor Pin"
              value={<span className="text-sm font-mono text-primary">Pin D7 (GPIO 13)</span>}
            />
            <Row
              label="Relay Module Pin"
              value={<span className="text-sm font-mono text-primary">Pin D5 (GPIO 14)</span>}
            />
            <Row
              label="Push Button Pin"
              value={<span className="text-sm font-mono text-primary">Pin D3 (GPIO 0)</span>}
            />
            <Row
              label="Ultrasonic Trig Pin"
              value={<span className="text-sm font-mono text-cyan-400">Pin D1 (GPIO 5)</span>}
            />
            <Row
              label="Ultrasonic Echo Pin"
              value={<span className="text-sm font-mono text-cyan-400">Pin D2 (GPIO 4)</span>}
            />
            <Row
              label="pH Sensor Pin"
              value={<span className="text-sm font-mono text-primary">Pin A0 (ADC0 Analog)</span>}
            />
            <Row
              label="TDS Sensor Pin"
              value={<span className="text-sm font-mono text-primary">Pin A0 (TDS Sensor ADC)</span>}
            />
            <Row
              label="Power Configuration"
              value={<span className="text-sm">5V Micro-USB</span>}
            />
          </div>
        </GlassCard>

        {/* Connectivity */}
        <GlassCard>
          <SectionTitle icon={Wifi} label="Firebase Realtime Database" />
          <div className="space-y-3">
            <Row
              label="Database Status"
              value={
                <StatusPill tone={firebaseConfigured ? "success" : "danger"}>
                  {firebaseConfigured ? "Connected (Live RTDB)" : "Disconnected"}
                </StatusPill>
              }
            />
            <Row label="Database Region" value={<span className="text-sm">asia-southeast1</span>} />
            <Row
              label="Primary Device Node"
              value={<span className="text-sm font-mono">/nodes/testNode</span>}
            />
            <Row
              label="Config Endpoint"
              value={<span className="text-sm font-mono">/config/thresholds</span>}
            />
            <div className="rounded-lg border border-border/40 bg-black/20 p-3 text-xs text-muted-foreground">
              Endpoint:{" "}
              <code className="text-foreground break-all text-[11px]">
                https://hydrax-f65d9-default-rtdb.asia-southeast1.firebasedatabase.app
              </code>
            </div>
          </div>
        </GlassCard>

        {/* Flow Ceilings & Alerts Shortcut */}
        <GlassCard>
          <SectionTitle icon={Sliders} label="Flow Limits & Notifications" />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Configure Flow Ceilings</span>
              <Link to="/thresholds">
                <Button variant="secondary" size="sm">
                  Thresholds <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <Row
              label="Toast Notifications"
              value={<Switch checked={notif} onCheckedChange={setNotif} />}
            />
            <Row
              label="Water Anomaly Push Alerts"
              value={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 gap-1.5"
                  onClick={() => {
                    sendWaterAbnormalityAlert(
                      `test_alert_${Date.now()}`,
                      "⚠️ Water Anomaly Test Alert",
                      "Simulated water quality alert: pH 4.5 acidic corrosion warning dispatched to device notification tray.",
                      "warning",
                    );
                    toast.success("Push notification dispatched to device!");
                  }}
                >
                  <Bell className="h-3 w-3" /> Test Push Alert
                </Button>
              }
            />
            <Row
              label="Interface Theme"
              value={
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Palette className="h-3.5 w-3.5 text-primary" /> Dark Futuristic
                </span>
              }
            />
          </div>
        </GlassCard>

        {/* Time Synchronization & 12-Hour Clock */}
        <GlassCard className="lg:col-span-2">
          <SectionTitle icon={Clock} label="Time Synchronization & 12-Hour Clock" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Row
              label="Clock Display Format"
              value={
                <span className="text-sm font-semibold text-primary">12-Hour Clock (AM / PM)</span>
              }
            />
            <Row
              label="Live Synchronized Time"
              value={<LiveSyncClock variant="pill" lastSyncTimestamp={node?.lastUpdate} />}
            />
            <Row
              label="Hardware Heartbeat Cycle"
              value={<span className="text-sm">~15–20 Seconds Polling</span>}
            />
            <Row
              label="Controller Last Sync"
              value={
                <span className="text-xs font-mono">
                  {node?.lastUpdate
                    ? `${format12HourTime(node.lastUpdate, { includeSeconds: true })} (${formatDistanceToNowStrict(node.lastUpdate, { addSuffix: true })})`
                    : "No heartbeat yet"}
                </span>
              }
            />
          </div>
        </GlassCard>

        {/* Android Mobile Application (.APK) */}
        <GlassCard className="lg:col-span-2 border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">HYDRAX Mobile Application</h3>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Android .APK
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Control valves, monitor IoT nodes, and receive instant leak alerts directly on your Android smartphone.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Version: v0.3.0 (Tank &amp; Pump Actuation)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Size: ~4.4 MB
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Requirements: Android 8.0+
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex sm:flex-col items-center justify-end gap-2">
              {!isNative ? (
                <>
                  <a
                    href="/hydrax.apk"
                    download="HYDRAX.apk"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95 transition-opacity glow-sm"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download APK</span>
                  </a>
                  <span className="text-[11px] text-muted-foreground">Direct APK Installer</span>
                </>
              ) : (
                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-4 py-2.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Running on Android</span>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-base font-semibold">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div>{value}</div>
    </div>
  );
}
