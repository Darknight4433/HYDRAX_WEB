import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Brain, Clock, Droplets, Info, Sparkles, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { useHydrax } from "@/lib/hydrax-store";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Water Analytics · HYDRAXX" },
      {
        name: "description",
        content:
          "Consumption telemetry, flow analysis and model predictions for HYDRAXX on Wemos D1 Mini.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const tooltip = {
  contentStyle: {
    background: "oklch(0.2 0.02 250 / 90%)",
    border: "1px solid var(--border)",
    borderRadius: 12,
  },
  labelStyle: { color: "var(--muted-foreground)" },
};

export function AnalyticsPage() {
  const data = useHydrax();
  const a = data.analytics;
  const node = data.nodes.testNode || Object.values(data.nodes)[0];

  const hasHourly = Array.isArray(a.hourlyToday) && a.hourlyToday.length > 0;
  const hasWeekly = Array.isArray(a.weeklyByDay) && a.weeklyByDay.length > 0;
  const hasForecast = Array.isArray(a.forecastNext24h) && a.forecastNext24h.length > 0;
  const hasAnomalies = Array.isArray(a.anomalyScore) && a.anomalyScore.length > 0;

  const peakHour = hasHourly
    ? a.hourlyToday!.reduce((m, h) => (h.liters > m.liters ? h : m), a.hourlyToday![0])
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="Consumption & Predictive Modeling"
        title="Water Analytics & Insights"
        description="Distinguishes measured field data on Wemos D1 Mini from cloud forecasts and scheduled aggregation."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={node?.lastUpdate} />
            <StatusPill tone={hasForecast ? "info" : "muted"}>
              <Brain className="mr-1.5 h-3.5 w-3.5" />
              {hasForecast ? "AI Forecast Active" : "Telemetry Mode"}
            </StatusPill>
            <StatusPill tone={node?.online ? "success" : "danger"} pulse={node?.online}>
              {node?.online ? "Wemos Online" : "Wemos Offline"}
            </StatusPill>
          </div>
        }
      />

      {/* Measured vs Predicted Legend Alert */}
      <GlassCard className="mb-6 border-accent/30 bg-accent/5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Data Transparency: </span>
            Values under <strong className="text-foreground">Measured Telemetry</strong> are derived
            from physical pulses on Wemos pin D7. Predictions and anomaly models require continuous
            historical data and are served from <code className="text-foreground">/analytics</code>{" "}
            once backend computation jobs are scheduled.
          </div>
        </div>
      </GlassCard>

      {/* Measured KPIs Grid */}
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">
        Measured Telemetry (Wemos D1 Mini)
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlassCard className="!p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Today's Consumption
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {(node?.todayUsage ?? 0).toFixed(2)}{" "}
            <span className="text-xs font-normal text-muted-foreground">L</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Measured via pin D7</div>
        </GlassCard>

        <GlassCard className="!p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Current Flow Rate
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-primary">
            {(node?.flowRate ?? 0).toFixed(2)}{" "}
            <span className="text-xs font-normal text-muted-foreground">L/min</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Real-time sensor pulse</div>
        </GlassCard>

        <GlassCard className="!p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Relay Position
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums capitalize text-foreground">
            {node?.valveState || "closed"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Pin D5 relay state</div>
        </GlassCard>

        <GlassCard className="!p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Hardware Uptime
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {node?.uptimeSec ? `${Math.floor(node.uptimeSec / 60)}m` : "—"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Wemos controller uptime</div>
        </GlassCard>
      </div>

      {/* Analytics & Predictions Section */}
      <div className="mt-8 text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">
        Model Predictions & Hourly Distribution
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Forecast / Hourly Chart */}
        <GlassCard className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                24h Forecast vs Actual
              </div>
              <div className="text-lg font-semibold">Hourly Water Demand</div>
            </div>
            <StatusPill tone={hasForecast ? "info" : "muted"}>
              {hasForecast ? "Forecast Active" : "Awaiting Model"}
            </StatusPill>
          </div>

          <div className="h-64">
            {hasForecast ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={a.forecastNext24h}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => {
                      const num = Number(h);
                      if (isNaN(num)) return `${h}`;
                      const period = num >= 12 ? "PM" : "AM";
                      const hour12 = num % 12 === 0 ? 12 : num % 12;
                      return `${hour12} ${period}`;
                    }}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip {...tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                  <Line
                    type="monotone"
                    dataKey="liters"
                    name="Forecast"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-border/40 p-6 text-center text-muted-foreground">
                <div>
                  <Clock className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
                  <div className="text-sm font-medium">No 24h Forecast Recorded Yet</div>
                  <div className="text-xs text-muted-foreground max-w-sm mt-1">
                    Once the backend analytics worker aggregates 24 hours of Wemos telemetry,
                    forecasts will be published to{" "}
                    <code className="text-foreground">/analytics/forecastNext24h</code>.
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Peak & Leak Risk Summary */}
        <GlassCard>
          <div className="mb-2 text-lg font-semibold">Model Status</div>
          <div className="space-y-3 mt-4 text-xs">
            <div className="rounded-lg bg-black/20 p-3">
              <div className="text-muted-foreground">Calculated Peak Hour</div>
              <div className="text-base font-bold text-foreground mt-1">
                {peakHour ? `${peakHour.hour}:00 (${peakHour.liters} L)` : "Awaiting hourly data"}
              </div>
            </div>

            <div className="rounded-lg bg-black/20 p-3">
              <div className="text-muted-foreground">Leak Risk Score</div>
              <div className="text-base font-bold text-foreground mt-1">
                {node?.leakProbability != null
                  ? `${(node.leakProbability * 100).toFixed(1)}%`
                  : "Not configured (0.00)"}
              </div>
            </div>

            <div className="rounded-lg bg-black/20 p-3">
              <div className="text-muted-foreground">Estimated Water Savings</div>
              <div className="text-base font-bold text-foreground mt-1">
                {a.savingsEstimate ? `${a.savingsEstimate.toLocaleString()} L` : "Pending baseline"}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Weekly & Anomaly Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-lg font-semibold">Weekly Consumption by Day</div>
            <StatusPill tone="muted">Daily Aggregations</StatusPill>
          </div>
          <div className="h-64">
            {hasWeekly ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.weeklyByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="liters" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-border/40 p-6 text-center text-muted-foreground">
                <div>
                  <Droplets className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
                  <div className="text-sm font-medium">Awaiting Weekly Consumption Totals</div>
                  <div className="text-xs text-muted-foreground max-w-xs mt-1">
                    Daily bins populate as continuous usage logs accumulate in Firebase.
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-lg font-semibold">Anomaly Scores</div>
            <StatusPill tone={hasAnomalies ? "warning" : "muted"}>
              {hasAnomalies ? "Scoring Live" : "Nominal"}
            </StatusPill>
          </div>
          <div className="h-64">
            {hasAnomalies ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.anomalyScore}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `${h}h`}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                    domain={[0, 1]}
                  />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {a.anomalyScore!.map((r, i) => (
                      <Cell
                        key={i}
                        fill={r.score > 0.5 ? "var(--destructive)" : "var(--primary)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-border/40 p-6 text-center text-muted-foreground">
                <div>
                  <Activity className="mx-auto mb-2 h-7 w-7 text-emerald-400/60" />
                  <div className="text-sm font-medium">No Flow Anomalies Flagged</div>
                  <div className="text-xs text-muted-foreground max-w-xs mt-1">
                    Continuous monitoring on D7 detects no off-schedule flow or unexpected pressure
                    drops.
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
