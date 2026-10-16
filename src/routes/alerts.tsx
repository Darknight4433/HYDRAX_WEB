import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Filter } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { Button } from "@/components/ui/button";
import { alertTypeLabel, resolveAlert, severityColor, useHydrax } from "@/lib/hydrax-store";
import type { AlertItem, AlertSeverity } from "@/lib/hydrax-types";
import { exportCSV } from "@/lib/export";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts · HYDRAX" },
      {
        name: "description",
        content: "Realtime leak, anomaly and system alerts across the HYDRAX water network.",
      },
    ],
  }),
  component: AlertsPage,
});

const severityFilters: (AlertSeverity | "all")[] = ["all", "critical", "high", "medium", "low"];

function AlertsPage() {
  const data = useHydrax();
  const [sev, setSev] = useState<AlertSeverity | "all">("all");
  const active = data.alerts.active.filter((a) => sev === "all" || a.severity === sev);
  const history = data.alerts.history.filter((a) => sev === "all" || a.severity === sev);

  return (
    <div>
      <PageHeader
        eyebrow="Alerts & anomalies"
        title="Water system alerts"
        description="Leaks, valve failures, offline nodes and AI predictions. Resolve alerts once addressed on-site."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={data.nodes.testNode?.lastUpdate} />
            <div className="flex items-center gap-1 rounded-full border border-border/50 bg-white/5 p-1">
              <Filter className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
              {severityFilters.map((s) => (
                <button
                  key={s}
                  onClick={() => setSev(s)}
                  className={`rounded-full px-2.5 py-1 text-xs capitalize ${sev === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                exportCSV(
                  "hydrax-alerts.csv",
                  [...data.alerts.active, ...data.alerts.history].map((a) => ({
                    time: new Date(a.time).toISOString(),
                    severity: a.severity,
                    type: a.type,
                    node: a.nodeId,
                    message: a.message,
                    resolved: a.resolved,
                  })),
                )
              }
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Active — {active.length}
      </div>
      <div className="grid grid-cols-1 gap-3">
        {active.length === 0 && (
          <GlassCard className="text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-[color:var(--success)]" />
            No active alerts. All systems nominal.
          </GlassCard>
        )}
        {active.map((a) => (
          <AlertRow
            key={a.id}
            a={a}
            onResolve={() => resolveAlert(a.id).then(() => toast.success("Alert resolved"))}
          />
        ))}
      </div>

      <div className="mb-3 mt-6 text-xs uppercase tracking-wider text-muted-foreground">
        History — {history.length}
      </div>
      <div className="grid grid-cols-1 gap-3">
        {history.map((a) => (
          <AlertRow key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

function AlertRow({ a, onResolve }: { a: AlertItem; onResolve?: () => void }) {
  return (
    <GlassCard className="!p-3.5 sm:!p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl bg-white/5 shrink-0 ${severityColor(a.severity)}`}
          >
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-semibold text-sm sm:text-base">{alertTypeLabel(a.type)}</span>
              <StatusPill
                tone={
                  a.severity === "high" || a.severity === "critical"
                    ? "danger"
                    : a.severity === "medium"
                      ? "warning"
                      : "info"
                }
              >
                {a.severity}
              </StatusPill>
              <span className="text-[11px] sm:text-xs text-muted-foreground">
                {formatDistanceToNowStrict(a.time, { addSuffix: true })} · {format(a.time, "PP p")}
              </span>
            </div>
            <div className="mt-1 text-xs sm:text-sm text-foreground/90 break-words">{a.message}</div>
            <div className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
              Node · <span className="text-foreground/80">{a.nodeId}</span> · Suggested:{" "}
              {a.suggestion}
            </div>
          </div>
        </div>
        <div className="self-end sm:self-center shrink-0">
          {onResolve ? (
            <Button size="sm" variant="secondary" onClick={onResolve}>
              Resolve
            </Button>
          ) : (
            <StatusPill tone="success">Resolved</StatusPill>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
