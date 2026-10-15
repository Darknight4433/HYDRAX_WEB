import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, Building2, Clock, Cpu, ExternalLink, Palette, Sliders, Wifi } from "lucide-react";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { firebaseConfigured } from "@/lib/firebase";
import { updateInstitution, useHydrax } from "@/lib/hydrax-store";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";
import { format12HourTime } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";

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
  const data = useHydrax();
  const [name, setName] = useState(data.config.institutionName);
  const [notif, setNotif] = useState(true);
  const [saving, setSaving] = useState(false);
  const node = data.nodes.testNode || Object.values(data.nodes)[0];

  return (
    <div>
      <PageHeader
        eyebrow="Configuration & Hardware"
        title="System Settings"
        description="Manage campus institution parameters, Wemos D1 Mini hardware mapping, and Firebase Realtime Database connectivity."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={node?.lastUpdate} />
            <StatusPill tone={node?.online ? "success" : "danger"} pulse={node?.online}>
              {node?.online ? "Wemos Online" : "Wemos Standby"}
            </StatusPill>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                  {node?.online ? "Online & Polling" : "Offline / Stale"}
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
