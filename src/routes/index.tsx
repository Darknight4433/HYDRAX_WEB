import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Droplets,
  Gauge as GaugeIcon,
  Lock,
  Radio,
  Timer,
  Unlock,
  Waves,
  Wifi,
  Sparkles,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { CircularGauge } from "@/components/hydrax/CircularGauge";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { WaterFlowIcon, ValveIcon } from "@/components/hydrax/WaterFlowIcon";
import { Button } from "@/components/ui/button";
import { setValve, useHydrax } from "@/lib/hydrax-store";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";
import { format12HourTime } from "@/lib/utils";

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
  const isOnline = Boolean(node?.online);

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
      label: "Live Flow Rate",
      value: `${(node?.flowRate ?? 0).toFixed(2)}`,
      unit: "L/min",
      icon: Waves,
      accent: "from-primary/30 to-accent/20",
      caption: "Measured via sensor on pin D7",
    },
    {
      label: "Today's Usage",
      value: `${(node?.todayUsage ?? 0).toFixed(2)}`,
      unit: "Litres",
      icon: Droplets,
      accent: "from-accent/30 to-primary/20",
      caption: "Calculated actual consumption",
    },
    {
      label: "Relay (Valve) State",
      value: isOpen ? "OPEN" : "CLOSED",
      unit: isOpen ? "Energized" : "De-energized",
      icon: isOpen ? Unlock : Lock,
      accent: isOpen ? "from-emerald-500/25 to-primary/15" : "from-rose-500/20 to-black/20",
      caption: "Controlled on pin D5 & push button D3",
    },
    {
      label: "Operating Mode",
      value: (node?.operatingMode ?? "auto").toUpperCase(),
      unit: node?.manualOverride ? "(Manual Override)" : "(Automatic)",
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
        description="Real-time water flow telemetry, bi-directional relay control, and physical button synchronisation via Firebase."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={node?.lastUpdate} />
            <StatusPill tone={isOnline ? "success" : "danger"} pulse={isOnline}>
              Wemos D1 Mini {isOnline ? "Connected" : "Offline"}
            </StatusPill>
            <StatusPill tone={isOpen ? "success" : "muted"} pulse={isOpen}>
              Relay {isOpen ? "OPEN" : "CLOSED"}
            </StatusPill>
            {node?.buttonPressed && (
              <StatusPill tone="warning" pulse>
                Push Button D3 Active
              </StatusPill>
            )}
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <GlassCard key={s.label} transition={{ delay: i * 0.05, duration: 0.35 }}>
            <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-40`} />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums text-foreground">{s.value}</span>
                  <span className="text-xs text-muted-foreground">{s.unit}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{s.caption}</div>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-primary">
                <s.icon className="h-5 w-5" />
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
                Live Telemetry Stream
              </div>
              <div className="text-lg font-semibold">
                Water Flow Rate · {node?.name || "Main Supply Line"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill tone={isOnline ? "info" : "muted"} pulse={isOnline}>
                {(node?.flowRate ?? 0).toFixed(2)} L/min
              </StatusPill>
            </div>
          </div>

          <div className="mt-4 h-64">
            {data.analytics.liveFlow && data.analytics.liveFlow.length > 0 ? (
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
                  <Waves className="mx-auto mb-2 h-8 w-8 text-primary/50 animate-pulse" />
                  <div className="text-sm font-medium">Awaiting Live Telemetry</div>
                  <div className="text-xs text-muted-foreground">
                    Connect Wemos D1 Mini to Firebase RTDB to stream sensor pulses on D7.
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
              unit="L/m"
              label={`Current / Ceiling (${currentThreshold} L/m)`}
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
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/15 text-sky-400">
              <Droplets className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Consumption Tracking
              </div>
              <div className="text-lg font-semibold">
                {(node?.todayUsage ?? 0).toFixed(2)} L Today
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-black/20 p-3">
              <div className="text-xs text-muted-foreground">Today's Total</div>
              <div className="text-lg font-bold text-foreground">
                {(node?.todayUsage ?? 0).toFixed(2)}{" "}
                <span className="text-xs font-normal text-muted-foreground">Litres</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-xs text-muted-foreground">This Week</div>
                <div className="text-sm font-semibold">
                  {node?.weeklyUsage ? `${node.weeklyUsage.toFixed(1)} L` : "Tracking..."}
                </div>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-xs text-muted-foreground">This Month</div>
                <div className="text-sm font-semibold">
                  {node?.monthlyUsage ? `${node.monthlyUsage.toFixed(1)} L` : "Tracking..."}
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
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
        highlight
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
