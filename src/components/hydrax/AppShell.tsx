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
  MoreHorizontal,
  Search,
  Settings,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Download,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useHydrax } from "@/lib/hydrax-store";
import { StatusPill } from "./StatusPill";
import { firebaseConfigured } from "@/lib/firebase";
import { LiveSyncClock } from "./LiveSyncClock";
import { Capacitor } from "@capacitor/core";

const allNav = [
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
  const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const data = useHydrax();
  const nodes = Object.values(data.nodes);
  const primaryNode = data.nodes.testNode || nodes[0];
  const lastSync = primaryNode?.lastUpdate || data.controller?.lastUpdate;
  const isOnline = Boolean(data.controller?.online || primaryNode?.online);
  const isOpen = primaryNode?.valveState === "open";

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignore if unsupported
      }
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground antialiased">
      {/* Desktop Sidebar (lg:flex) */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 w-72 shrink-0 border-r border-border/50 p-4 backdrop-blur-xl",
          "bg-[color:var(--sidebar)]",
        )}
      >
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent glow-primary shadow-lg shadow-primary/25">
              <Droplets className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold tracking-tight text-gradient">HYDRAX</div>
              <div className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Smart Water OS
              </div>
            </div>
          </Link>
        </div>

        {/* Desktop Mini Status Box */}
        <div className="mt-6 rounded-2xl border border-border/50 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Wemos D1 Mini</div>
            <StatusPill tone={isOnline ? "success" : "danger"} pulse={isOnline}>
              {isOnline ? "Online" : "Offline"}
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
                {isOpen ? "open" : "closed"}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="mt-6 space-y-1 overflow-y-auto flex-1 pr-1">
          {allNav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-foreground font-semibold"
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
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop Sidebar Footer */}
        <div className="pt-3 space-y-2">
          {!isNative && (
            <a
              href="/hydrax.apk"
              download="HYDRAX.apk"
              className="flex items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-r from-primary/15 to-accent/10 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/60 hover:from-primary/25 hover:to-accent/20 transition-all glow-sm group"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-lg bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Smartphone className="h-3.5 w-3.5" />
                </div>
                <div className="text-left">
                  <div className="leading-tight text-xs font-medium">Download APK</div>
                  <div className="text-[10px] font-normal text-muted-foreground">Android Mobile App</div>
                </div>
              </div>
              <Download className="h-3.5 w-3.5 text-primary group-hover:translate-y-0.5 transition-transform" />
            </a>
          )}

          <div className="rounded-xl border border-border/40 bg-black/20 p-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              {firebaseConfigured ? "Firebase RTDB Connected" : "Local Mode"}
            </div>
            <div className="mt-0.5 truncate text-[11px]">Wemos D1 Mini · ESP8266</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col lg:pl-72">
        {/* Top Header */}
        <header
          className="sticky top-0 z-20 border-b border-border/50 bg-background/95 backdrop-blur-xl transition-all"
          style={{
            paddingTop: isNative
              ? "max(env(safe-area-inset-top, 0px), 42px)"
              : "max(env(safe-area-inset-top, 0px), 0px)",
          }}
        >
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-6 sm:py-3">
            {/* Mobile Brand / Desktop Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex lg:hidden items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/20 shrink-0">
                  <Droplets className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold tracking-tight text-gradient text-base block leading-tight">
                    HYDRAX
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-mono">
                    Smart Water OS
                  </span>
                </div>
              </div>

              <div className="hidden lg:block min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {data.config.institutionName}
                </div>
                <div className="truncate text-xs text-muted-foreground/70">
                  Wemos D1 Mini · ESP8266 Smart Water Management
                </div>
              </div>
            </div>

            {/* Right Action Cluster */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Desktop Search */}
              <div className="hidden items-center gap-2 rounded-full border border-border/50 bg-white/5 px-3 py-1.5 md:flex">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  placeholder="Search nodes, alerts…"
                  className="w-40 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Live Sync Clock */}
              <LiveSyncClock
                lastSyncTimestamp={lastSync}
                className="hidden sm:flex border-l border-border/40 pl-3"
              />

              {/* Status Pill */}
              <StatusPill tone={isOnline ? "success" : "danger"} pulse={isOnline}>
                <span className="hidden sm:inline">Wemos </span>
                {isOnline ? "Live" : "Offline"}
              </StatusPill>

              {/* Direct APK Download Button (Web Only - Hidden inside Native APK) */}
              {!isNative && (
                <a
                  href="/hydrax.apk"
                  download="HYDRAX.apk"
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-gradient-to-r from-primary/15 to-accent/15 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-primary hover:bg-primary/25 hover:border-primary transition-all glow-sm"
                  title="Download HYDRAX Android APK"
                  onClick={triggerHaptic}
                >
                  <Smartphone className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>APK</span>
                  <Download className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-80" />
                </a>
              )}

              {/* Mobile Drawer Toggle */}
              <button
                onClick={() => {
                  triggerHaptic();
                  setDrawerOpen(true);
                }}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border/40 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground lg:hidden"
                aria-label="Open menu drawer"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto w-full max-w-[1500px] p-3 sm:p-6 pb-28 sm:pb-32 lg:pb-8 flex-1"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Tab Navigation Bar (lg:hidden) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-2xl shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
      >
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {/* Tab 1: Overview */}
          <Link
            to="/"
            onClick={triggerHaptic}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors",
              pathname === "/" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Gauge className={cn("h-5 w-5", pathname === "/" && "scale-110 text-primary")} />
            <span>Home</span>
          </Link>

          {/* Tab 2: Nodes */}
          <Link
            to="/nodes"
            onClick={triggerHaptic}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors",
              pathname.startsWith("/nodes") ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Boxes className={cn("h-5 w-5", pathname.startsWith("/nodes") && "scale-110 text-primary")} />
            <span>Nodes</span>
          </Link>

          {/* Tab 3: Valve Control (Featured Center Action Button) */}
          <Link
            to="/control"
            onClick={triggerHaptic}
            className="flex flex-col items-center justify-center -mt-4 relative group"
          >
            <div
              className={cn(
                "grid h-12 w-12 place-items-center rounded-2xl shadow-lg transition-transform",
                pathname.startsWith("/control")
                  ? "bg-gradient-to-tr from-primary to-accent text-primary-foreground shadow-primary/30 scale-105"
                  : "bg-secondary text-foreground hover:bg-secondary/80",
              )}
            >
              <Droplets className="h-6 w-6" />
            </div>
            <span
              className={cn(
                "mt-1 text-[10px] font-medium tracking-tight",
                pathname.startsWith("/control") ? "text-primary font-bold" : "text-muted-foreground",
              )}
            >
              Valve
            </span>
          </Link>

          {/* Tab 4: Analytics */}
          <Link
            to="/analytics"
            onClick={triggerHaptic}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium transition-colors",
              pathname.startsWith("/analytics") ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Brain className={cn("h-5 w-5", pathname.startsWith("/analytics") && "scale-110 text-primary")} />
            <span>Analytics</span>
          </Link>

          {/* Tab 5: More Drawer */}
          <button
            onClick={() => {
              triggerHaptic();
              setDrawerOpen(true);
            }}
            className="flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
            aria-label="Open more menu"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Slide-Over Drawer Modal (lg:hidden) */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 260 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-xs bg-[color:var(--sidebar)] border-l border-border/50 p-5 shadow-2xl flex flex-col lg:hidden"
              style={{
                paddingTop: isNative
                  ? "max(env(safe-area-inset-top, 0px), 44px)"
                  : "1.25rem",
              }}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent">
                    <Droplets className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-gradient">HYDRAX</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      Navigation & Tools
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Hardware Quick Status Card */}
              <div className="my-4 rounded-xl border border-border/40 bg-black/25 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Wemos Controller</span>
                  <StatusPill tone={isOnline ? "success" : "danger"} pulse={isOnline}>
                    {isOnline ? "Online" : "Offline"}
                  </StatusPill>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Relay D5 Valve</span>
                  <span className="font-semibold capitalize text-primary">
                    {isOpen ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Heartbeat</span>
                  <LiveSyncClock variant="pill" lastSyncTimestamp={lastSync} />
                </div>
              </div>

              {/* Navigation Items in Drawer */}
              <div className="space-y-1 overflow-y-auto flex-1 py-1">
                {allNav.map(({ to, label, icon: Icon }) => {
                  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => {
                        triggerHaptic();
                        setDrawerOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/20 text-primary font-bold"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active && "text-primary")} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Drawer Footer with APK Download / Native App Info */}
              <div className="pt-3 border-t border-border/40 space-y-2.5">
                {!isNative ? (
                  <a
                    href="/hydrax.apk"
                    download="HYDRAX.apk"
                    onClick={() => {
                      triggerHaptic();
                      setDrawerOpen(false);
                    }}
                    className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary to-accent p-3 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/25"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="h-4 w-4" />
                      <div className="text-left">
                        <div>Download HYDRAX APK</div>
                        <div className="text-[10px] opacity-80">v1.0 for Android (4.6 MB)</div>
                      </div>
                    </div>
                    <Download className="h-4 w-4" />
                  </a>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/20 text-primary">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-xs">HYDRAX Android App</div>
                        <div className="text-[10px] text-muted-foreground">Version 1.0.0 · Active</div>
                      </div>
                    </div>
                    <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5 font-medium border border-emerald-500/30">
                      Installed
                    </span>
                  </div>
                )}

                <div className="text-[10px] text-center text-muted-foreground/70">
                  HYDRAX Smart Water Monitor · ESP8266 IoT OS
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
