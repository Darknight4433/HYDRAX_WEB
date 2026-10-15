import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coffee,
  Info,
  Loader2,
  PartyPopper,
  RotateCcw,
  Save,
  Siren,
  Sliders,
  Sun,
  WifiOff,
} from "lucide-react";
import { GlassCard } from "@/components/hydrax/GlassCard";
import { PageHeader } from "@/components/hydrax/PageHeader";
import { StatusPill } from "@/components/hydrax/StatusPill";
import { Button } from "@/components/ui/button";
import { updateThresholds, useHydrax } from "@/lib/hydrax-store";
import type { OperatingMode, Thresholds } from "@/lib/hydrax-types";
import { LiveSyncClock } from "@/components/hydrax/LiveSyncClock";

export const Route = createFileRoute("/thresholds")({
  head: () => ({
    meta: [
      { title: "Flow Ceilings & Threshold Management · HYDRAXX" },
      {
        name: "description",
        content:
          "Manage flow thresholds stored at /config/thresholds for HYDRAXX Wemos D1 Mini firmware.",
      },
    ],
  }),
  component: ThresholdsPage,
});

interface ThresholdFieldConfig {
  key: keyof Thresholds;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  associatedMode?: OperatingMode;
  note?: string;
}

const FIELD_CONFIGS: ThresholdFieldConfig[] = [
  {
    key: "normalTime",
    label: "Normal Time",
    hint: "Default working hours baseline flow ceiling",
    icon: Sun,
    associatedMode: "auto",
  },
  {
    key: "breakTime",
    label: "Break Time",
    hint: "Recess / lunch period elevated flow ceiling",
    icon: Coffee,
    associatedMode: "break",
  },
  {
    key: "holiday",
    label: "Holiday",
    hint: "Minimal threshold when facility/campus is vacant",
    icon: CalendarDays,
    associatedMode: "holiday",
  },
  {
    key: "emergency",
    label: "Emergency",
    hint: "High ceiling before automatic emergency shutoff",
    icon: Siren,
    associatedMode: "emergency",
  },
  {
    key: "custom",
    label: "Custom / Manual",
    hint: "Threshold applied during manual override mode",
    icon: Sliders,
    associatedMode: "manual",
  },
  {
    key: "specialEvent",
    label: "Special Event",
    hint: "High-capacity events (Configurable ceiling in Firebase)",
    icon: PartyPopper,
    note: "Configurable threshold stored in Firebase. Not currently mapped to an automatic operating mode in Wemos firmware.",
  },
];

const DEFAULT_INITIAL_THRESHOLDS: Thresholds = {
  normalTime: 22,
  breakTime: 28,
  holiday: 10,
  specialEvent: 35,
  emergency: 45,
  custom: 20,
};

export function ThresholdsPage() {
  const data = useHydrax();
  const node = data.nodes.testNode || Object.values(data.nodes)[0];
  const { thresholds, thresholdsStatus, thresholdsError } = data.config;

  // Form input string states to allow editing decimals freely
  const [inputs, setInputs] = useState<Record<keyof Thresholds, string>>({
    normalTime: "",
    breakTime: "",
    holiday: "",
    specialEvent: "",
    emergency: "",
    custom: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Thresholds, string>>>({});
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);

  // Sync inputs from live Firebase data when loaded
  useEffect(() => {
    if (thresholds) {
      setInputs({
        normalTime: String(thresholds.normalTime),
        breakTime: String(thresholds.breakTime),
        holiday: String(thresholds.holiday),
        specialEvent: String(thresholds.specialEvent),
        emergency: String(thresholds.emergency),
        custom: String(thresholds.custom),
      });
      setFieldErrors({});
    }
  }, [thresholds]);

  // Validate a single field
  const validateField = (val: string): string | null => {
    if (!val || val.trim() === "") return "Field cannot be empty";
    const num = Number(val);
    if (isNaN(num)) return "Must be a valid number";
    if (num <= 0) return "Value must be greater than 0 L/min";
    if (num > 100) return "Value cannot exceed 100 L/min";
    return null;
  };

  const handleInputChange = (key: keyof Thresholds, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    const err = validateField(value);
    setFieldErrors((prev) => ({ ...prev, [key]: err || undefined }));
  };

  // Check if current form is valid
  const hasValidationErrors = Object.values(fieldErrors).some(Boolean);
  const isFormComplete = FIELD_CONFIGS.every(
    (f) => inputs[f.key] !== "" && !validateField(inputs[f.key]),
  );

  // Check if inputs differ from live Firebase data
  const isDirty =
    thresholds &&
    FIELD_CONFIGS.some((f) => {
      const live = thresholds[f.key];
      const current = Number(inputs[f.key]);
      return !isNaN(current) && current !== live;
    });

  // Save handler
  const handleSave = async () => {
    // 1. Validate all fields
    const newErrors: Partial<Record<keyof Thresholds, string>> = {};
    let hasErr = false;

    for (const f of FIELD_CONFIGS) {
      const err = validateField(inputs[f.key]);
      if (err) {
        newErrors[f.key] = err;
        hasErr = true;
      }
    }

    if (hasErr) {
      setFieldErrors(newErrors);
      toast.error("Please correct the threshold values before saving.");
      return;
    }

    // 2. Convert to numbers
    const payload: Thresholds = {
      normalTime: Number(inputs.normalTime),
      breakTime: Number(inputs.breakTime),
      holiday: Number(inputs.holiday),
      specialEvent: Number(inputs.specialEvent),
      emergency: Number(inputs.emergency),
      custom: Number(inputs.custom),
    };

    setSaving(true);
    try {
      // 3. Update Firebase at /config/thresholds
      await updateThresholds(payload);
      setLastSavedTime(Date.now());
      toast.success(
        "Thresholds saved to Firebase. The Wemos will pick up the updated configuration during its next configuration poll.",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // Determine active threshold based on current operatingMode
  const currentMode = node?.operatingMode || "auto";
  const configuredThresholdForMode = (() => {
    if (!thresholds) return null;
    switch (currentMode) {
      case "break":
        return thresholds.breakTime;
      case "holiday":
        return thresholds.holiday;
      case "emergency":
        return thresholds.emergency;
      case "manual":
        return thresholds.custom;
      case "auto":
      default:
        return thresholds.normalTime;
    }
  })();

  const hardwareReportedThreshold = node?.threshold;
  const isHardwareInSync =
    configuredThresholdForMode != null &&
    hardwareReportedThreshold != null &&
    Math.abs(configuredThresholdForMode - hardwareReportedThreshold) < 0.05;

  return (
    <div>
      <PageHeader
        eyebrow="Flow Protection Limits · /config/thresholds"
        title="Threshold Management"
        description="Configure flow ceilings stored at /config/thresholds. The Wemos D1 Mini polls this path every 15 seconds and trips the relay (D5) if flow (D7) exceeds the active ceiling."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncClock variant="pill" lastSyncTimestamp={node?.lastUpdate} />
            <StatusPill
              tone={
                thresholdsStatus === "loaded"
                  ? isDirty
                    ? "warning"
                    : "success"
                  : thresholdsStatus === "missing"
                    ? "warning"
                    : thresholdsStatus === "error"
                      ? "danger"
                      : "muted"
              }
              pulse={isDirty || thresholdsStatus === "loading"}
            >
              {thresholdsStatus === "loading"
                ? "Connecting to Firebase..."
                : thresholdsStatus === "missing"
                  ? "Missing from Firebase"
                  : thresholdsStatus === "error"
                    ? "Firebase Error"
                    : isDirty
                      ? "Unsaved local changes"
                      : "Synchronized with Firebase"}
            </StatusPill>

            <Button
              disabled={!isFormComplete || hasValidationErrors || saving}
              onClick={handleSave}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Thresholds
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Sync Status Banner */}
      {lastSavedTime && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Thresholds saved to Firebase:</strong> The Wemos polls{" "}
              <code className="text-emerald-300">/config/thresholds</code> every 15 seconds and may
              take up to the next polling interval to enforce the updated limit.
            </span>
          </div>
          <span className="text-muted-foreground whitespace-nowrap ml-2">Just now</span>
        </div>
      )}

      {/* Loading State */}
      {thresholdsStatus === "loading" && (
        <GlassCard className="py-12 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <div className="text-base font-semibold text-foreground">
            Loading Thresholds from Firebase
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Querying <code className="text-foreground">/config/thresholds</code> on asia-southeast1
            Realtime Database...
          </div>
        </GlassCard>
      )}

      {/* Missing Configuration State */}
      {thresholdsStatus === "missing" && (
        <GlassCard className="mb-6 border-warning/40 bg-warning/5 p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-base font-semibold text-foreground">
                No Threshold Configuration Found in Firebase
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                The path <code className="text-foreground">/config/thresholds</code> does not exist
                in your Firebase Realtime Database yet. Click below to initialize the standard
                baseline thresholds (22, 28, 10, 35, 45, 20 L/min).
              </p>
              <div className="mt-4 flex items-center gap-3">
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await updateThresholds(DEFAULT_INITIAL_THRESHOLDS);
                      toast.success("Standard thresholds initialized at /config/thresholds");
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : String(err);
                      toast.error(`Init failed: ${msg}`);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Initialize Standard Ceilings
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Firebase Error State */}
      {thresholdsStatus === "error" && (
        <GlassCard className="mb-6 border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
              <WifiOff className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-destructive">
                Firebase Connection / Read Error
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {thresholdsError ||
                  "Unable to read /config/thresholds from Firebase Realtime Database."}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Active Threshold vs Hardware Reported Comparison Panel */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Operating Mode Sync
              </div>
              <div className="text-base font-bold text-foreground">
                Current Operating Mode:{" "}
                <span className="text-primary capitalize">{currentMode}</span>
              </div>
            </div>
            <StatusPill tone={isHardwareInSync ? "success" : "warning"} pulse={!isHardwareInSync}>
              {isHardwareInSync ? "Hardware In Sync" : "Pending Hardware Poll"}
            </StatusPill>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/40 bg-black/20 p-4">
              <div className="text-xs text-muted-foreground">Configured Threshold (Firebase)</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {configuredThresholdForMode != null ? `${configuredThresholdForMode} L/min` : "—"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Mapped to mode <code className="text-foreground">{currentMode}</code> at
                /config/thresholds
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-black/20 p-4">
              <div className="text-xs text-muted-foreground">Reported Active on Wemos</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-primary">
                {hardwareReportedThreshold != null ? `${hardwareReportedThreshold} L/min` : "—"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Read from <code className="text-foreground">/nodes/testNode/threshold</code>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              The Wemos polls /config/thresholds every 15 seconds. If you save changes, please allow
              up to 15s for the hardware reported value to update.
            </span>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 text-primary">
            <Info className="h-5 w-5" />
            <div className="text-base font-semibold">Mode Mappings</div>
          </div>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between py-1 border-b border-border/30">
              <span>auto</span>
              <strong className="text-foreground">
                normalTime ({inputs.normalTime || "22"} L/min)
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-border/30">
              <span>break</span>
              <strong className="text-foreground">
                breakTime ({inputs.breakTime || "28"} L/min)
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-border/30">
              <span>holiday</span>
              <strong className="text-foreground">holiday ({inputs.holiday || "10"} L/min)</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-border/30">
              <span>emergency</span>
              <strong className="text-foreground">
                emergency ({inputs.emergency || "45"} L/min)
              </strong>
            </div>
            <div className="flex justify-between py-1">
              <span>manual</span>
              <strong className="text-foreground">custom ({inputs.custom || "20"} L/min)</strong>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 6 Editable Numeric Inputs Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FIELD_CONFIGS.map((f) => {
          const isActiveMode = f.associatedMode && currentMode === f.associatedMode;
          const currentVal = inputs[f.key];
          const hasError = Boolean(fieldErrors[f.key]);
          const numVal = Number(currentVal);
          const sliderVal = isNaN(numVal) ? 0 : Math.min(100, Math.max(0, numVal));

          return (
            <GlassCard
              key={f.key}
              className={`transition-all ${
                isActiveMode
                  ? "border-primary/60 ring-1 ring-primary/40 bg-primary/5"
                  : hasError
                    ? "border-destructive/60"
                    : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-xl ${
                      isActiveMode
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-foreground">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.hint}</div>
                  </div>
                </div>
                {isActiveMode && <StatusPill tone="info">ACTIVE MODE</StatusPill>}
              </div>

              {f.note && (
                <div className="mt-3 rounded-lg bg-black/20 p-2 text-[11px] text-muted-foreground">
                  {f.note}
                </div>
              )}

              {/* Input row with L/min suffix */}
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Flow Ceiling ({f.key})
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      value={currentVal}
                      onChange={(e) => handleInputChange(f.key, e.target.value)}
                      placeholder="e.g. 22"
                      className={`w-full rounded-xl border bg-black/30 px-3.5 py-2.5 text-xl font-bold tabular-nums text-foreground outline-none transition-colors ${
                        hasError
                          ? "border-destructive focus:border-destructive"
                          : "border-border/50 focus:border-primary"
                      }`}
                    />
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                    L/min
                  </span>
                </div>

                {hasError && (
                  <div className="mt-1 text-xs text-destructive font-medium">
                    {fieldErrors[f.key]}
                  </div>
                )}
              </div>

              {/* Interactive Range Slider */}
              <div className="mt-4">
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="0.5"
                  value={sliderVal}
                  onChange={(e) => handleInputChange(f.key, e.target.value)}
                  className="w-full accent-[color:var(--primary)]"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>1 L/min</span>
                  <span>50 L/min</span>
                  <span>100 L/min</span>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
