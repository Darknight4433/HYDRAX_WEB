import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Cpu, MapPin, Radio, Signal, Timer, Zap } from "lucide-react";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { ValveIcon, WaterFlowIcon } from "@/components/hydrax/WaterFlowIcon";
import { useHydrax } from "@/lib/hydrax-store";
import type { HydraxNode } from "@/lib/hydrax-types";
import { formatDistanceToNowStrict } from "date-fns";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";
import { format12HourTime } from "@/lib/utils";

export const Route = createFileRoute("/nodes")({
  head: () => ({
    meta: [
      { title: "Device Telemetry & Node · HYDRAXX" },
      {
        name: "description",
        content:
          "Live telemetry and device status for Wemos D1 Mini testNode on HYDRAXX: flow rate, relay state, signal and consumption.",
      },
    ],
  }),
  component: NodesPage,
});

function NodesPage() {
  const data = useHydrax();
  const nodes = Object.values(data.nodes);
  const primaryNode = data.nodes.testNode || nodes[0];

  return (
    <div>
      <PageHeader
        eyebrow="Single Device Telemetry"
        title="Hardware Node Monitoring"
        description="Live telemetry stream from Wemos D1 Mini (/nodes/testNode). Reports flow sensor, relay state, Wi-Fi RSSI and volume."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={primaryNode?.lastUpdate} />
            <StatusPill
              tone={primaryNode?.online ? "success" : "danger"}
              pulse={primaryNode?.online}
            >
              {primaryNode?.online ? "Online & Reporting" : "Offline / Stale"}
            </StatusPill>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Node Card */}
        <div className="lg:col-span-2">{primaryNode && <NodeDetailCard node={primaryNode} />}</div>

        {/* Hardware Wiring & Pinout Details */}
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center gap-2 text-primary">
              <Cpu className="h-5 w-5" />
              <div className="text-base font-semibold">Controller Specifications</div>
            </div>
            <div className="mt-4 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex justify-between py-1 border-b border-border/30">
                <span>Microcontroller:</span>
                <strong className="text-foreground">Wemos D1 Mini (ESP8266)</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span>Power Source:</span>
                <strong className="text-foreground">USB 5V (USB-Powered)</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span>Flow Sensor Pin:</span>
                <strong className="text-foreground">Pin D7 (GPIO 13)</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span>Relay Module Pin:</span>
                <strong className="text-foreground">Pin D5 (GPIO 14)</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span>Push Button Pin:</span>
                <strong className="text-foreground">Pin D3 (GPIO 0)</strong>
              </div>
              <div className="flex justify-between py-1">
                <span>Database Path:</span>
                <code className="text-foreground text-[11px]">/nodes/testNode</code>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 text-accent">
              <Zap className="h-5 w-5" />
              <div className="text-base font-semibold">Hardware Sensors Status</div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="rounded-lg bg-black/20 p-2.5">
                <div className="text-foreground font-medium">Battery Level:</div>
                <div className="text-[11px]">USB Powered — No battery sensor connected.</div>
              </div>
              <div className="rounded-lg bg-black/20 p-2.5">
                <div className="text-foreground font-medium">Temperature:</div>
                <div className="text-[11px]">No temperature sensor connected to Wemos.</div>
              </div>
              <div className="rounded-lg bg-black/20 p-2.5">
                <div className="text-foreground font-medium">Leak Detection AI:</div>
                <div className="text-[11px]">Awaiting local / cloud risk model evaluation.</div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function NodeDetailCard({ node }: { node: HydraxNode }) {
  const isOpen = node.valveState === "open";

  return (
    <GlassCard className="!p-0 overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <WaterFlowIcon active={isOpen && node.online} size={36} />
            <div>
              <div className="text-xl font-bold text-foreground">{node.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{node.location}</span>
                <span>·</span>
                <span>
                  ID: <code className="text-foreground">{node.id}</code>
                </span>
              </div>
            </div>
          </div>
          <StatusPill tone={node.online ? "success" : "danger"} pulse={node.online}>
            {node.online ? "Online & Synchronized" : "Offline / Stale"}
          </StatusPill>
        </div>

        {/* Primary Metrics Grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Flow Rate" value={`${node.flowRate.toFixed(2)}`} unit="L/min" />
          <Metric label="Active Ceiling" value={`${node.threshold}`} unit="L/min" />
          <Metric label="Today's Litres" value={`${node.todayUsage.toFixed(2)}`} unit="L" />
          <Metric label="WiFi Quality" value={node.signal ? `${node.signal}%` : "—"} unit="" />
        </div>

        {/* Valve and Mode Panel */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-border/40 bg-black/20 p-4">
          <div className="flex items-center gap-3">
            <ValveIcon open={isOpen} size={48} />
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Relay Module (D5)
              </div>
              <div className="text-base font-bold capitalize text-foreground">
                {node.valveState}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {isOpen ? "Energized (Pass Flow)" : "De-energized (Cut Flow)"}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-6 sm:border-l sm:border-border/30 sm:pl-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Operating Mode
              </div>
              <div className="text-base font-bold capitalize text-foreground">
                {node.operatingMode}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {node.manualOverride ? "Manual Override Active" : "Automatic Control"}
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Diagnostics Grid */}
        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
            Field Diagnostics & Timestamps
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            <Diag
              icon={<Signal className="h-3.5 w-3.5" />}
              label="Wi-Fi Signal"
              value={node.signal ? `${node.signal}%` : "—"}
            />
            <Diag icon={<Radio className="h-3.5 w-3.5" />} label="Power" value="USB 5V (Board)" />
            <Diag
              icon={<Timer className="h-3.5 w-3.5" />}
              label="Last Heartbeat"
              value={
                node.lastUpdate
                  ? `${format12HourTime(node.lastUpdate, { includeSeconds: true })} (${formatDistanceToNowStrict(node.lastUpdate, { addSuffix: true })})`
                  : "Never"
              }
            />
            <Diag
              label="Weekly Total"
              value={node.weeklyUsage ? `${node.weeklyUsage.toFixed(1)} L` : "Awaiting data"}
            />
            <Diag
              label="Monthly Total"
              value={node.monthlyUsage ? `${node.monthlyUsage.toFixed(1)} L` : "Awaiting data"}
            />
            <Diag
              label="Leak Probability"
              value={
                node.leakProbability != null
                  ? `${(node.leakProbability * 100).toFixed(1)}%`
                  : "Not configured"
              }
            />
            <Diag label="Physical Button" value={node.buttonPressed ? "PRESSED (D3)" : "IDLE"} />
            <Diag label="Uptime" value={node.uptimeSec ? formatUptime(node.uptimeSec) : "—"} />
            <Diag label="Firmware" value={node.firmware || "HYDRAXX-v1.0"} />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-black/20 p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-foreground">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function Diag({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/15 px-3 py-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}
