import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Droplets,
  FlaskConical,
  Gauge as GaugeIcon,
  Lock,
  Radio,
  Sliders,
  Timer,
  Unlock,
  Waves,
  Wifi,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { CircularGauge } from "@/components/hydrax/CircularGauge";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { WaterFlowIcon, ValveIcon } from "@/components/hydrax/WaterFlowIcon";
import { Button } from "@/components/ui/button";
import { getPhStatus, getTdsStatus, resetTodayUsage, setValve, useHydrax } from "@/lib/hydrax-store";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";
import { format12HourTime, formatWaterVolume } from "@/lib/utils";
import { WaterCorrelationPanel } from "@/components/hydrax/WaterCorrelationPanel";
import { TankPumpMonitor } from "@/components/hydrax/TankPumpMonitor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HYDRAXX Dashboard · Single Wemos D1 Mini Controller" },
      {
        name: "description",
        content:
          "Realtime water monitoring and valve control for HYDRAXX on Wemos D1 Mini (ESP8266) with Firebase RTDB.",
      },
    ],
  }),
  component: Overview,
});

export function Overview() {
  const data = useHydrax();
  const node = data.nodes.testNode || Object.values(data.nodes)[0];
  const [toggling, setToggling] = useState(false);
  const [resettingUsage, setResettingUsage] = useState(false);

  const handleResetUsage = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setResettingUsage(true);
    try {
      await resetTodayUsage(node?.id);
      toast.success("Today's water usage reset to 0 mL");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Reset failed: ${msg}`);
    } finally {
      setResettingUsage(false);
    }
  };

  // Active threshold based on operating mode with null safety
  const thresholds = data.config.thresholds;
  const currentThreshold = (() => {
    if (!thresholds) return node?.threshold ?? 22;
    switch (node?.operatingMode) {
      case "break":
        return thresholds.breakTime ?? 28;
      case "holiday":
        return thresholds.holiday ?? 10;
      case "emergency":
        return thresholds.emergency ?? 45;
      case "manual":
        return thresholds.custom ?? 20;
      case "auto":
      default:
        return thresholds.normalTime ?? 22;
    }
  })();

  const isOpen = node?.valveState === "open";
  const isPumpActive = node?.pumpState === "on" || Boolean(node?.pumpActive);
  const isOnline = Boolean(node?.online);
  const ph = node?.phValue ?? node?.ph ?? 7.0;
  const phStatus = getPhStatus(ph);
  const tds = node?.tdsPpm ?? 0;
  const tdsStatus = getTdsStatus(tds);

  const handleToggleValve = async () => {
    if (!node) return;
    const nextState = isOpen ? "closed" : "open";
    setToggling(true);
    try {
      await setValve(node.id, nextState);
      toast.success(`Relay command sent: ${nextState.toUpperCase()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update relay: ${msg}`);
    } finally {
      setToggling(false);
    }
  };

  const stats = [
    {
      label: isOnline ? "Live Flow Rate" : "Flow Rate (Offline)",
      value: isOnline ? `${(node?.flowRate ?? 0).toFixed(2)}` : "0.00",
      unit: "L/min",
      icon: Waves,
      accent: isOnline ? "from-primary/30 to-accent/20" : "from-muted/20 to-muted/10",
      caption: isOnline ? "Measured via sensor on pin D7" : "Wemos Standby (Pin D7)",
    },
    {
      label: "Water pH Level",
      value: `${ph.toFixed(2)}`,
      unit: "pH",
      icon: FlaskConical,
      accent:
        phStatus.tone === "danger"
          ? "from-rose-500/30 to-primary/20"
          : phStatus.tone === "warning"
            ? "from-amber-500/30 to-primary/20"
            : "from-emerald-500/30 to-primary/20",
      caption: `${phStatus.status} (${node?.phVoltage != null ? `${node.phVoltage}V` : "--"} · A0)`,
    },
    {
      label: "TDS Purity",
      value: `${tds.toFixed(1)}`,
      unit: "ppm",
      icon: Droplets,
      accent: "from-cyan-500/30 to-primary/20",
      caption: `${tdsStatus.status} (ADC: ${node?.tdsRawADC != null ? node.tdsRawADC : "--"})`,
    },
    {
      label: "Today's Usage",
      value: formatWaterVolume(node?.todayUsage ?? 0).value,
      unit: formatWaterVolume(node?.todayUsage ?? 0).unit,
      icon: Droplets,
      accent: "from-accent/30 to-primary/20",
      caption: "Water consumption (mL)",
      action: (
        <button
          type="button"
          onClick={handleResetUsage}
          disabled={resettingUsage}
          title="Reset Today's Usage counter to 0 mL"
          className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 transition-colors cursor-pointer"
        >
          <RotateCcw className={`h-2.5 w-2.5 ${resettingUsage ? "animate-spin" : ""}`} />
          <span>Reset</span>
        </button>
      ),
    },
    {
      label: "Relay (Valve) State",
      value: isOpen ? "OPEN" : "CLOSED",
      unit: isOpen ? "Energized" : "De-energized",
      icon: isOpen ? Unlock : Lock,
      accent: isOpen ? "from-emerald-500/25 to-primary/15" : "from-rose-500/20 to-black/20",
      caption: "Controlled on pin D5 & button D3",
    },
    {
      label: "Operating Mode",
      value: (node?.operatingMode ?? "auto").toUpperCase(),
      unit: (node?.operatingMode ?? "auto") === "auto" ? "(Normal)" : "(Manual)",
      icon: Cpu,
      accent: "from-sky-400/20 to-primary/10",
      caption: `Active limit: ${currentThreshold} L/min`,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Single-Controller Architecture · Wemos D1 Mini (ESP8266)"
        title="HYDRAXX Smart Water Monitor"
        description="Real-time water flow telemetry, bi-directional relay control, and dual pH & TDS water quality sensing via Firebase."
        actions={
          <>
            <LiveSyncClock variant="pill" lastSyncTimestamp={isOnline ? node?.lastUpdate : undefined} />
            <StatusPill tone={isOnline ? "success" : "danger"} pulse={isOnline}>
              Wemos D1 Mini {isOnline ? "Connected" : "Offline"}
            </StatusPill>
            <StatusPill tone={phStatus.tone} pulse={phStatus.tone !== "success"}>
              pH {ph.toFixed(1)} ({phStatus.status})
            </StatusPill>
            <StatusPill tone={tdsStatus.tone} pulse={tdsStatus.tone !== "success"}>
              TDS {tds.toFixed(0)} ppm
            </StatusPill>
            <StatusPill tone={isOpen ? "success" : "muted"} pulse={isOpen}>
              Relay {isOpen ? "OPEN" : "CLOSED"}
            </StatusPill>
            <StatusPill tone={isPumpActive ? "success" : "muted"} pulse={isPumpActive}>
              Pump {isPumpActive ? "RUNNING" : "OFF"}
            </StatusPill>
            <StatusPill tone="info">
              Tank {(node?.tankFillPercent ?? 80.9).toFixed(0)}%
            </StatusPill>
            {node?.buttonPressed && (
              <StatusPill tone="warning" pulse>
                Push Button D3 Active
              </StatusPill>
            )}
          </>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {stats.map((s, i) => (
          <GlassCard key={s.label} transition={{ delay: i * 0.05, duration: 0.35 }}>
            <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-40`} />
            <div className="relative flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-1">
                  <span className="truncate">{s.label}</span>
                  {"action" in s && s.action}
                </div>
                <div className="mt-1.5 sm:mt-2 flex flex-wrap items-baseline gap-1 sm:gap-1.5">
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums text-foreground">
                    {s.value}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{s.unit}</span>
                </div>
                <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1 sm:line-clamp-none">
                  {s.caption}
                </div>
              </div>
              <div className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-lg sm:rounded-xl bg-white/5 text-primary shrink-0">
                <s.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Main Live Flow & Relay Actuation Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Live Flow Chart */}
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {isOnline ? "Live Telemetry Stream" : "Telemetry Stream (Offline)"}
              </div>
              <div className="text-lg font-semibold">
                Water Flow Rate · {node?.name || "Main Supply Line"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill tone={isOnline ? "info" : "muted"} pulse={isOnline}>
                {isOnline ? `${(node?.flowRate ?? 0).toFixed(2)} L/min` : "Wemos Standby"}
              </StatusPill>
            </div>
          </div>

          <div className="mt-4 h-52 sm:h-64">
            {isOnline && data.analytics.liveFlow && data.analytics.liveFlow.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.analytics.liveFlow}>
                  <defs>
                    <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="t"
                    tickFormatter={(t) =>
                      new Date(t).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })
                    }
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={45}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                    unit=" L/m"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.2 0.02 250 / 90%)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                    labelFormatter={(t) =>
                      new Date(Number(t)).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })
                    }
                    formatter={(v) => [`${Number(v).toFixed(2)} L/min`, "Flow Rate"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="flow"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#flowGrad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-border/40 p-6 text-center text-muted-foreground">
                <div>
                  <Waves className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <div className="text-sm font-medium text-foreground/80">
                    {isOnline ? "Awaiting Flow Pulses" : "Wemos Controller Offline"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 max-w-sm">
                    {isOnline
                      ? "Wemos connected. Water flow sensor on Pin D7 is awaiting pulses."
                      : "Connect Wemos D1 Mini to Wi-Fi & Firebase RTDB to begin streaming live telemetry."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Primary Relay Actuator Card */}
        <GlassCard>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Primary Valve (Relay D5)
              </div>
              <div className="mt-1 text-lg font-semibold">{node?.name || "Main Supply Line"}</div>
            </div>
            <StatusPill tone={isOpen ? "success" : "danger"} pulse={isOpen}>
              {isOpen ? "OPEN" : "CLOSED"}
            </StatusPill>
          </div>

          <div className="mt-4 flex items-center justify-center gap-4 py-2">
            <ValveIcon open={isOpen} size={64} />
            <div>
              <div className="text-2xl font-bold tracking-tight capitalize">{node?.valveState}</div>
              <div className="text-xs text-muted-foreground">Hardware: Relay module on pin D5</div>
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center">
            <CircularGauge
              value={node?.flowRate ?? 0}
              max={currentThreshold}
              unit="L/min"
              decimals={2}
              label={`Current / Ceiling (${currentThreshold} L/min)`}
            />
          </div>

          <div className="mt-4 space-y-2">
            <Button
              className="w-full"
              variant={isOpen ? "destructive" : "default"}
              size="lg"
              disabled={toggling}
              onClick={handleToggleValve}
            >
              {isOpen ? (
                <>
                  <Lock className="mr-2 h-4 w-4" /> Close Valve (De-energize Relay)
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" /> Open Valve (Energize Relay)
                </>
              )}
            </Button>
            <div className="text-center text-[11px] text-muted-foreground">
              Synced with push button on Wemos pin D3
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main Reservoir & Automated Pump Controller (HYDRAXX v0.3.0) */}
      <div className="mt-4">
        <TankPumpMonitor node={node} />
      </div>

      {/* Realtime Water Quality (pH & TDS) Monitoring Banner */}
      <GlassCard className="mt-4 border-primary/30 bg-gradient-to-br from-primary/10 via-transparent to-accent/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">
                  {isOnline ? "Live Water Quality & Sensor Diagnostics" : "Water Quality & Sensor Diagnostics"}
                </h3>
                {isOnline ? (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 shadow-sm shadow-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ESP8266 Live Telemetry
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-rose-300 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500/60" />
                    Wemos Offline · Awaiting Data
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Realtime hydrochemical telemetry: pH sensor and automated correlated Total Dissolved Solids (TDS) variation.
              </p>
            </div>
          </div>

          <Link to="/settings">
            <Button variant="outline" size="sm" className="gap-2">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              <span>Calibrate pH in Settings</span>
            </Button>
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* pH Sensor Card */}
          <div className="rounded-2xl border border-border/40 bg-black/25 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className={`h-4 w-4 ${phStatus.color}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Water pH Level
                </span>
              </div>
              <StatusPill tone={phStatus.tone} pulse>
                {phStatus.status}
              </StatusPill>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums text-foreground">
                {ph.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">pH (0.0–14.0)</span>
              <span className="text-xs font-mono ml-auto text-muted-foreground">
                {node?.phVoltage ? `${node.phVoltage}V` : "2.57V"} · ADC Pin A0
              </span>
            </div>

            {/* Spectrum Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="text-rose-400 font-medium">0 (Acidic)</span>
                <span className="text-emerald-400 font-medium">6.5–8.5 (Safe Tap Range)</span>
                <span className="text-indigo-400 font-medium">14 (Alkaline)</span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-rose-500 via-amber-400 via-emerald-400 to-indigo-600">
                <div
                  className="absolute -top-0.5 bottom-0 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-black shadow-md transition-all duration-300"
                  style={{
                    left: `${Math.max(0, Math.min(100, (ph / 14) * 100))}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {phStatus.description}
            </p>
          </div>

          {/* TDS Sensor Card */}
          <div className="rounded-2xl border border-border/40 bg-black/25 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplets className={`h-4 w-4 ${tdsStatus.color}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Dissolved Solids (TDS)
                </span>
              </div>
              <StatusPill tone={tdsStatus.tone} pulse>
                {tdsStatus.status}
              </StatusPill>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tabular-nums text-foreground">
                {tds.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">ppm (mg/L)</span>
              <span className="text-xs font-mono ml-auto text-muted-foreground">
                Correlated: {node?.tdsVoltage != null ? `${node.tdsVoltage}V` : "0.43V"} (ADC: {node?.tdsRawADC != null ? node.tdsRawADC : "133"})
              </span>
            </div>

            {/* TDS Level Indicator */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span className="text-emerald-400 font-medium">0–50 Pure RO</span>
                <span className="text-cyan-400">50–150 Good</span>
                <span className="text-sky-400">150–300 Fair</span>
                <span className="text-rose-400">&gt;500 Limit</span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 via-sky-400 to-rose-500">
                <div
                  className="absolute -top-0.5 bottom-0 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-black shadow-md transition-all duration-300"
                  style={{
                    left: `${Math.max(0, Math.min(100, (tds / 500) * 100))}%`,
                  }}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {tdsStatus.grade}: {tdsStatus.description}
            </p>
          </div>
        </div>

        {/* Real-time Water Quality Correlation & Waterborne Pathogen Risk Analysis */}
        <div className="mt-5 border-t border-border/40 pt-5">
          <WaterCorrelationPanel ph={ph} tds={tds} showDetailsByDefault={false} />
        </div>
      </GlassCard>

      {/* Thresholds, Hardware Diagnostics, & Usage Row */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Active Thresholds Card */}
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <GaugeIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Flow Ceilings
              </div>
              <div className="text-lg font-semibold">{currentThreshold} L/min · Active</div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Row
              label="Normal Time"
              value={`${thresholds?.normalTime ?? "—"} L/min`}
              highlight={node?.operatingMode === "auto"}
            />
            <Row
              label="Break Time"
              value={`${thresholds?.breakTime ?? "—"} L/min`}
              highlight={node?.operatingMode === "break"}
            />
            <Row
              label="Holiday"
              value={`${thresholds?.holiday ?? "—"} L/min`}
              highlight={node?.operatingMode === "holiday"}
            />
            <Row label="Special Event" value={`${thresholds?.specialEvent ?? "—"} L/min`} />
            <Row
              label="Emergency Cutoff"
              value={`${thresholds?.emergency ?? "—"} L/min`}
              highlight={node?.operatingMode === "emergency"}
            />
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Enforced locally in Wemos firmware on D5 relay.
          </div>
        </GlassCard>

        {/* Wemos Hardware & Telemetry Status Card */}
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Controller Telemetry
              </div>
              <div className="text-lg font-semibold">Wemos D1 Mini</div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Controller Model" value="ESP8266 (USB Powered)" />
            <Row label="Flow Sensor" value="Pin D7 (GPIO 13)" />
            <Row label="Relay Module" value="Pin D5 (GPIO 14)" />
            <Row
              label="Push Button"
              value={node?.buttonPressed ? "PRESSED (D3)" : "IDLE (Pin D3)"}
            />
            <Row
              label="pH Sensor (A0)"
              value={
                <span className="font-mono text-emerald-400">
                  {ph.toFixed(2)} pH ({node?.phVoltage != null ? `${node.phVoltage}V` : "--"})
                </span>
              }
            />
            <Row
              label="TDS Sensor (A0)"
              value={
                <span className="font-mono text-cyan-400">
                  {tds.toFixed(1)} ppm (ADC: {node?.tdsRawADC != null ? node.tdsRawADC : "--"})
                </span>
              }
            />
            <Row label="Wi-Fi Signal" value={node?.signal ? `${node.signal}%` : "—"} />
            <Row label="Uptime" value={node?.uptimeSec ? formatUptime(node.uptimeSec) : "—"} />
            <Row
              label="Last Heartbeat"
              value={
                node?.lastUpdate
                  ? `${format12HourTime(node.lastUpdate, { includeSeconds: true })} (${formatDistanceToNowStrict(node.lastUpdate, { addSuffix: true })})`
                  : "Never"
              }
            />
            <Row
              label="12-Hr Sync Clock"
              value={<LiveSyncClock variant="pill" lastSyncTimestamp={node?.lastUpdate} />}
            />
          </div>
        </GlassCard>

        {/* Consumption Breakdown Card */}
        <GlassCard>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/15 text-sky-400">
                <Droplets className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Consumption Tracking
                </div>
                <div className="text-lg font-semibold">
                  {formatWaterVolume(node?.todayUsage ?? 0).formatted} Today
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetUsage}
              disabled={resettingUsage}
              className="text-xs gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer"
            >
              <RotateCcw className={`h-3 w-3 ${resettingUsage ? "animate-spin" : ""}`} />
              Reset to 0 mL
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-black/20 p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Today's Total</div>
                <div className="text-lg font-bold text-foreground">
                  {formatWaterVolume(node?.todayUsage ?? 0).value}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatWaterVolume(node?.todayUsage ?? 0).unit}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-xs text-muted-foreground">This Week</div>
                <div className="text-sm font-semibold">
                  {node?.weeklyUsage ? formatWaterVolume(node.weeklyUsage).formatted : "Tracking..."}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-xs text-muted-foreground">This Month</div>
                <div className="text-sm font-semibold">
                  {node?.monthlyUsage ? formatWaterVolume(node.monthlyUsage).formatted : "Tracking..."}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Period totals are calculated from sensor volume measurements.
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${highlight
        ? "border border-primary/40 bg-primary/10 text-primary-foreground font-semibold"
        : "bg-black/15 text-foreground"
        }`}
    >
      <span className={highlight ? "text-primary" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}
