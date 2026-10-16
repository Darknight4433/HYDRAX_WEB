import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Download, Droplets, Waves } from "lucide-react";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { Button } from "@/components/ui/button";
import { useHydrax } from "@/lib/hydrax-store";
import { exportCSV, exportPDF } from "@/lib/export";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";

export const Route = createFileRoute("/graphs")({
  head: () => ({
    meta: [
      { title: "Water Usage Graphs · HYDRAXX" },
      {
        name: "description",
        content: "Live and historical water consumption graphs for Wemos D1 Mini on HYDRAXX.",
      },
    ],
  }),
  component: GraphsPage,
});

const tooltip = {
  contentStyle: {
    background: "oklch(0.2 0.02 250 / 90%)",
    border: "1px solid var(--border)",
    borderRadius: 12,
  },
  labelFormatter: (t: unknown) => {
    const num = Number(t);
    if (!isNaN(num) && num > 1000000000) {
      return new Date(num).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    }
    return String(t);
  },
};

export function GraphsPage() {
  const data = useHydrax();
  const a = data.analytics;
  const node = data.nodes.testNode || Object.values(data.nodes)[0];

  const hasLive = Array.isArray(a.liveFlow) && a.liveFlow.length > 0;
  const hasHourly = Array.isArray(a.hourlyToday) && a.hourlyToday.length > 0;
  const hasWeekly = Array.isArray(a.weeklyByDay) && a.weeklyByDay.length > 0;
  const hasMonthly = Array.isArray(a.monthlyByWeek) && a.monthlyByWeek.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Flow & Consumption Records"
        title="Water Usage Graphs"
        description="Visualise live flow rate from Wemos D1 Mini pin D7 and periodic consumption totals."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={node?.lastUpdate} />
            <Button
              variant="secondary"
              onClick={() => {
                if (hasHourly) {
                  exportCSV("hydraxx-hourly.csv", a.hourlyToday!);
                } else if (hasLive) {
                  exportCSV("hydraxx-live-flow.csv", a.liveFlow!);
                } else {
                  exportCSV("hydraxx-telemetry.csv", [
                    {
                      node: node?.id,
                      flowRate: node?.flowRate,
                      todayLitres: node?.todayUsage,
                      valve: node?.valveState,
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button
              onClick={() =>
                exportPDF("HYDRAXX Water Telemetry Report", [
                  {
                    heading: "Controller Details",
                    lines: [
                      `Hardware: Wemos D1 Mini (ESP8266)`,
                      `Node: ${node?.name || "testNode"}`,
                      `Relay State: ${node?.valveState?.toUpperCase() || "CLOSED"}`,
                      `Flow Sensor: Pin D7 (GPIO 13)`,
                    ],
                  },
                  {
                    heading: "Measured Consumption",
                    lines: [
                      `Current Flow Rate: ${(node?.flowRate ?? 0).toFixed(2)} L/min`,
                      `Today's Volume: ${(node?.todayUsage ?? 0).toFixed(2)} Litres`,
                      `Active Flow Ceiling: ${node?.threshold ?? 22} L/min`,
                    ],
                  },
                ])
              }
            >
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Live Flow Area Chart */}
        <ChartCard title="Live Flow Rate (Pin D7 Telemetry)">
          {hasLive ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={a.liveFlow}>
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
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
                  axisLine={false}
                  tickLine={false}
                  minTickGap={45}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                  unit=" L/m"
                />
                <Tooltip {...tooltip} />
                <Area
                  type="monotone"
                  dataKey="flow"
                  stroke="var(--primary)"
                  fill="url(#g1)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState
              icon={Waves}
              title="Awaiting Live Flow Stream"
              description="Real-time flow ticks from Wemos D1 Mini will graph here as water passes through sensor D7."
            />
          )}
        </ChartCard>

        {/* Hourly Binned Today */}
        <ChartCard title="Hourly Consumption Today">
          {hasHourly ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.hourlyToday}>
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
                  width={40}
                  unit=" L"
                />
                <Tooltip {...tooltip} />
                <Bar dataKey="liters" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState
              icon={Droplets}
              title="Hourly Bins Accumulating"
              description="Today's measured usage totals are aggregated into hourly slots at /analytics/hourlyToday."
            />
          )}
        </ChartCard>

        {/* Weekly Consumption by Day */}
        <ChartCard title="Weekly Consumption by Day">
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
                  width={40}
                  unit=" L"
                />
                <Tooltip {...tooltip} />
                <Bar dataKey="liters" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState
              icon={Droplets}
              title="Weekly History Pending"
              description="Daily consumption logs will graph across Mon–Sun as weekly historical data accumulates."
            />
          )}
        </ChartCard>

        {/* Monthly Trend by Week */}
        <ChartCard title="Monthly Consumption by Week">
          {hasMonthly ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={a.monthlyByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="week"
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
                  width={40}
                  unit=" L"
                />
                <Tooltip {...tooltip} />
                <Line
                  type="monotone"
                  dataKey="liters"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState
              icon={Droplets}
              title="Monthly Trends Pending"
              description="Aggregated 4-week consumption curves populate from Firebase /analytics/monthlyByWeek."
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard>
      <div className="mb-2 text-xs sm:text-sm font-semibold text-muted-foreground">{title}</div>
      <div className="h-56 sm:h-64">{children}</div>
    </GlassCard>
  );
}

function EmptyChartState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-dashed border-border/40 p-6 text-center text-muted-foreground">
      <div>
        <Icon className="mx-auto mb-2 h-7 w-7 text-muted-foreground/60" />
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground max-w-xs mt-1">{description}</div>
      </div>
    </div>
  );
}
