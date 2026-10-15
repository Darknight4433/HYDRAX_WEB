import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Calendar,
  Coffee,
  Info,
  Lock,
  Power,
  ShieldAlert,
  Unlock,
  Wand2,
} from "lucide-react";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { ValveIcon } from "@/components/hydrax/WaterFlowIcon";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { setNodeMode, setValve, useHydrax } from "@/lib/hydrax-store";
import type { HydraxNode, OperatingMode, ValveState } from "@/lib/hydrax-types";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";

export const Route = createFileRoute("/control")({
  head: () => ({
    meta: [
      { title: "Valve & Relay Control · HYDRAXX" },
      {
        name: "description",
        content:
          "Manual valve and relay control for Wemos D1 Mini on HYDRAXX. Open, close, and set operating modes with physical button sync.",
      },
    ],
  }),
  component: ControlPage,
});

type Pending =
  | { kind: "valve"; nodeId: string; state: ValveState; label: string }
  | { kind: "mode"; nodeId: string; mode: OperatingMode; label: string }
  | null;

function ControlPage() {
  const data = useHydrax();
  const node = data.nodes.testNode || Object.values(data.nodes)[0];
  const [pending, setPending] = useState<Pending>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Single-Controller Remote Actuation"
        title="Valve & Relay Control Center"
        description="Direct remote control of the Wemos D1 Mini relay module on pin D5. The physical push button on pin D3 and this interface control the same state."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={node?.lastUpdate} />
            <StatusPill tone={node?.online ? "success" : "danger"} pulse={node?.online}>
              Wemos {node?.online ? "Online" : "Offline"}
            </StatusPill>
            <StatusPill tone="warning">Requires confirmation</StatusPill>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Relay Controller Card */}
        <div className="lg:col-span-2 space-y-4">
          {node && <SingleNodeControlCard node={node} onAction={setPending} />}
        </div>

        {/* Hardware & Sync Notice Card */}
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center gap-2 text-primary">
              <Info className="h-5 w-5" />
              <div className="text-base font-semibold">Hardware Specification</div>
            </div>
            <div className="mt-3 space-y-3 text-xs text-muted-foreground leading-relaxed">
              <p>
                HYDRAXX operates on a single{" "}
                <strong className="text-foreground">Wemos D1 Mini (ESP8266)</strong>.
              </p>
              <div className="rounded-lg bg-black/25 p-3 space-y-1.5 font-mono text-[11px] text-foreground">
                <div>• Pin D7 (GPIO 13): Water Flow Sensor</div>
                <div>• Pin D5 (GPIO 14): Relay Module (Valve)</div>
                <div>• Pin D3 (GPIO 0): Push Button (Local Toggle)</div>
              </div>
              <p>
                The relay module is binary:{" "}
                <strong className="text-foreground">OPEN (Energized)</strong> or{" "}
                <strong className="text-foreground">CLOSED (De-energized)</strong>. Proportional /
                partial positions are not supported by the relay hardware.
              </p>
              <p>
                When the physical push button on D3 is toggled on the bench, the Wemos immediately
                publishes the new state to{" "}
                <code className="text-foreground bg-white/5 px-1 py-0.5 rounded">
                  /nodes/testNode/valveState
                </code>
                .
              </p>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              <div className="text-base font-semibold">Emergency Protocols</div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Emergency shutdown immediately sets mode to{" "}
              <code className="text-foreground">emergency</code> and sends a de-energize command to
              close the relay on D5.
            </p>
            <Button
              variant="destructive"
              className="mt-4 w-full"
              onClick={() =>
                setPending({
                  kind: "mode",
                  nodeId: node?.id || "testNode",
                  mode: "emergency",
                  label: `Emergency SHUTDOWN on ${node?.name || "Main Supply Line"}`,
                })
              }
            >
              <ShieldAlert className="mr-2 h-4 w-4" /> Trigger Emergency Shutdown
            </Button>
          </GlassCard>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="glass-strong border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Hardware Actuation</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.label}
              <br />
              <span className="mt-2 block text-xs text-muted-foreground">
                This will write directly to Firebase RTDB at{" "}
                <code className="text-foreground">
                  {pending?.kind === "valve"
                    ? `/nodes/${pending.nodeId}/valveState`
                    : `/nodes/${pending?.nodeId}/operatingMode`}
                </code>{" "}
                and actuate the Wemos D1 Mini pin D5.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pending) return;
                try {
                  if (pending.kind === "valve") {
                    await setValve(pending.nodeId, pending.state);
                    toast.success(`Relay commanded to ${pending.state.toUpperCase()}`);
                  } else {
                    await setNodeMode(pending.nodeId, pending.mode);
                    toast.success(`Operating mode set to ${pending.mode.toUpperCase()}`);
                  }
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.error(`Action failed: ${msg}`);
                }
                setPending(null);
              }}
            >
              Confirm Actuation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SingleNodeControlCard({
  node,
  onAction,
}: {
  node: HydraxNode;
  onAction: (p: Pending) => void;
}) {
  const isOpen = node.valveState === "open";

  return (
    <GlassCard>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/30 pb-4">
        <div className="flex items-center gap-4">
          <ValveIcon open={isOpen} size={56} />
          <div>
            <div className="text-xl font-bold">{node.name}</div>
            <div className="text-xs text-muted-foreground">
              {node.location} · Device ID: <code className="text-foreground">{node.id}</code>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={isOpen ? "success" : "danger"} pulse={isOpen}>
            Relay: {node.valveState.toUpperCase()}
          </StatusPill>
          <StatusPill tone="info">Mode: {node.operatingMode.toUpperCase()}</StatusPill>
        </div>
      </div>

      {/* Primary Valve Actuators */}
      <div className="mt-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
          Direct Relay Actuation (Pin D5)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            size="lg"
            variant={isOpen ? "outline" : "default"}
            className="justify-start h-14"
            disabled={isOpen}
            onClick={() =>
              onAction({
                kind: "valve",
                nodeId: node.id,
                state: "open",
                label: `Energize relay (OPEN valve) on ${node.name}`,
              })
            }
          >
            <Unlock className="mr-3 h-5 w-5 text-emerald-400" />
            <div className="text-left">
              <div className="font-semibold">Open Valve</div>
              <div className="text-[11px] text-muted-foreground">Energize relay on D5</div>
            </div>
          </Button>

          <Button
            size="lg"
            variant={!isOpen ? "outline" : "destructive"}
            className="justify-start h-14"
            disabled={!isOpen}
            onClick={() =>
              onAction({
                kind: "valve",
                nodeId: node.id,
                state: "closed",
                label: `De-energize relay (CLOSE valve) on ${node.name}`,
              })
            }
          >
            <Lock className="mr-3 h-5 w-5" />
            <div className="text-left">
              <div className="font-semibold">Close Valve</div>
              <div className="text-[11px] text-muted-foreground">De-energize relay on D5</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Operating Mode Selection */}
      <div className="mt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
          Operating Mode Selection
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            variant={node.operatingMode === "auto" ? "default" : "secondary"}
            className="justify-start h-12"
            onClick={() =>
              onAction({
                kind: "mode",
                nodeId: node.id,
                mode: "auto",
                label: `Set AUTO mode on ${node.name}`,
              })
            }
          >
            <Wand2 className="mr-2 h-4 w-4" /> Auto
          </Button>

          <Button
            variant={node.operatingMode === "manual" ? "default" : "secondary"}
            className="justify-start h-12"
            onClick={() =>
              onAction({
                kind: "mode",
                nodeId: node.id,
                mode: "manual",
                label: `Set MANUAL mode on ${node.name}`,
              })
            }
          >
            <Power className="mr-2 h-4 w-4" /> Manual
          </Button>

          <Button
            variant={node.operatingMode === "break" ? "default" : "secondary"}
            className="justify-start h-12"
            onClick={() =>
              onAction({
                kind: "mode",
                nodeId: node.id,
                mode: "break",
                label: `Set BREAK TIME mode on ${node.name}`,
              })
            }
          >
            <Coffee className="mr-2 h-4 w-4" /> Break Time
          </Button>

          <Button
            variant={node.operatingMode === "holiday" ? "default" : "secondary"}
            className="justify-start h-12"
            onClick={() =>
              onAction({
                kind: "mode",
                nodeId: node.id,
                mode: "holiday",
                label: `Set HOLIDAY mode on ${node.name}`,
              })
            }
          >
            <Calendar className="mr-2 h-4 w-4" /> Holiday
          </Button>
        </div>
      </div>

      {/* Telemetry Status Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 p-3 text-xs text-muted-foreground">
        <div>
          Flow: <strong className="text-foreground">{node.flowRate.toFixed(2)} L/min</strong>
        </div>
        <div>
          Active Threshold: <strong className="text-foreground">{node.threshold} L/min</strong>
        </div>
        <div>
          Button (D3):{" "}
          <strong className="text-foreground">{node.buttonPressed ? "Pressed" : "Idle"}</strong>
        </div>
        <div>
          Manual Override:{" "}
          <strong className="text-foreground">{node.manualOverride ? "Active" : "None"}</strong>
        </div>
      </div>
    </GlassCard>
  );
}
