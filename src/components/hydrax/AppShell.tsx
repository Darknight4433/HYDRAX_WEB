import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bell,
  Boxes,
  Brain,
  Droplets,
  Gauge,
  LineChart,
  Menu,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useHydrax } from "@/lib/hydrax-store";
import { StatusPill } from "./StatusPill";
import { firebaseConfigured } from "@/lib/firebase";
import { LiveSyncClock } from "./LiveSyncClock";

const nav = [
  { to: "/", label: "Overview", icon: Gauge },
  { to: "/nodes", label: "Live Nodes", icon: Boxes },
  { to: "/analytics", label: "AI Analytics", icon: Brain },
  { to: "/thresholds", label: "Thresholds", icon: SlidersHorizontal },
  { to: "/control", label: "Valve Control", icon: Droplets },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/graphs", label: "Graphs", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const data = useHydrax();
  const nodes = Object.values(data.nodes);
  const onlineCount = nodes.filter((n) => n.online).length;
  const primaryNode = data.nodes.testNode || nodes[0];
  const lastSync = primaryNode?.lastUpdate || data.controller?.lastUpdate;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 shrink-0 border-r border-border/50 p-4 backdrop-blur-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          "bg-[color:var(--sidebar)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent glow-primary">
              <Droplets className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight text-gradient">HYDRAX</div>
              <div className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Smart Water OS
              </div>
            </div>
          </Link>
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-border/50 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Wemos D1 Mini</div>
            <StatusPill tone={data.controller?.online ? "success" : "danger"} pulse>
              {data.controller?.online ? "Online" : "Offline"}
            </StatusPill>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-black/20 p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Node</div>
              <div className="text-sm font-semibold truncate">testNode</div>
            </div>
            <div className="rounded-lg bg-black/20 p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Relay (D5)
              </div>
              <div className="text-sm font-semibold capitalize text-primary">
                {data.nodes.testNode?.valveState ?? "closed"}
              </div>
            </div>
          </div>
        </div>

        <nav className="mt-6 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-primary to-accent"
                  />
                )}
                <Icon className={cn("h-4 w-4", active && "text-primary")} />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-4 bottom-4 rounded-xl border border-border/40 bg-black/20 p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            {firebaseConfigured ? "Firebase RTDB Connected" : "Local Mode"}
          </div>
          <div className="mt-1 truncate text-[11px]">Wemos D1 Mini · ESP8266</div>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close overlay"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border/50 bg-background/60 backdrop-blur-xl">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden min-w-0 sm:block">
                <div className="truncate text-sm font-medium text-foreground">
                  {data.config.institutionName}
                </div>
                <div className="truncate text-xs text-muted-foreground/70">
                  Wemos D1 Mini · ESP8266 Monitoring System
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-full border border-border/50 bg-white/5 px-3 py-1.5 md:flex">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  placeholder="Search nodes, alerts…"
                  className="w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Live 12-Hour Sync Clock */}
              <LiveSyncClock
                lastSyncTimestamp={lastSync}
                className="hidden sm:flex border-l border-border/40 pl-3"
              />
              <LiveSyncClock lastSyncTimestamp={lastSync} variant="pill" className="sm:hidden" />

              <StatusPill
                tone={data.controller?.online ? "success" : "muted"}
                pulse={data.controller?.online}
              >
                Wemos {data.controller?.online ? "Live" : "Standby"}
              </StatusPill>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mx-auto w-full max-w-[1500px] p-4 sm:p-6"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
