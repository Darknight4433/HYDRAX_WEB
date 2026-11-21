import { useState } from "react";
import {
  AlertTriangle,
  Atom,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FlaskConical,
  Gauge,
  Info,
  Microscope,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Waves,
  Wrench,
  Zap,
} from "lucide-react";
import {
  getWaterQualityCorrelation,
  PathogenEntry,
  PathogenRiskLevel,
} from "@/lib/water-pathogens";
import { StatusPill } from "@/components/hydrax/StatusPill";

interface WaterCorrelationPanelProps {
  ph: number;
  tds: number;
  className?: string;
  showDetailsByDefault?: boolean;
}

export function WaterCorrelationPanel({
  ph,
  tds,
  className = "",
  showDetailsByDefault = false,
}: WaterCorrelationPanelProps) {
  const [showAllPathogenCards, setShowAllPathogenCards] = useState(showDetailsByDefault);
  const [selectedPathogenId, setSelectedPathogenId] = useState<string | null>(null);

  const correlation = getWaterQualityCorrelation(ph, tds);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Primary Card */}
      <div className="rounded-2xl border border-border/50 bg-black/40 p-4 sm:p-6 shadow-2xl backdrop-blur-md">
        {/* Module Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`grid h-10 w-10 place-items-center rounded-xl border ${
                correlation.overallRisk === "CRITICAL" || correlation.overallRisk === "HIGH"
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                  : correlation.overallRisk === "MODERATE"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
              }`}
            >
              {correlation.overallRisk === "CRITICAL" || correlation.overallRisk === "HIGH" ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Pathogen Awareness Monitor
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase font-semibold">
                  Surveillance Module
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Surveillance Watchlist &amp; Hydrochemical Diagnostics ·{" "}
                <span className="text-amber-400/90 font-medium">Not a direct clinical diagnosis engine</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg bg-black/40 border border-border/40 px-2.5 py-1 text-xs">
              <span className="text-muted-foreground">pH (Settings): </span>
              <span className="font-mono font-bold text-emerald-400">{ph.toFixed(2)}</span>
            </div>
            <div className="rounded-lg bg-black/40 border border-border/40 px-2.5 py-1 text-xs">
              <span className="text-muted-foreground">Automated TDS: </span>
              <span className="font-mono font-bold text-cyan-400">{tds.toFixed(1)} ppm</span>
            </div>
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                correlation.overallRisk === "CRITICAL"
                  ? "bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-md shadow-rose-500/20 animate-pulse"
                  : correlation.overallRisk === "HIGH"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : correlation.overallRisk === "MODERATE"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }`}
            >
              Risk: {correlation.overallRisk}
            </span>
          </div>
        </div>

        {/* Mandatory Microbiological Status Banner */}
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-black/40 to-black/30 p-3.5 sm:p-4 shadow-inner">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-amber-300 flex items-center gap-2">
                <span>MICROBIOLOGICAL STATUS — NOT TESTED</span>
                <span className="text-[10px] px-2 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                  Mandatory Notice
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground/90">
                Detection status: <span className="text-rose-300">No direct microbial detection hardware connected.</span>
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                pH and TDS readings measure dissolved ions and electrochemical balance; they cannot establish the presence or absence of these organisms. Displayed organisms indicate target surveillance vectors and biological persistence under active chemical conditions.
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 01 — SENSOR OBSERVATION & SYSTEM ALERT MATRIX                             */}
        {/* ========================================================================= */}
        <div className="mt-6 border-t border-border/30 pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">
              01
            </span>
            <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Sensor Observation, Scientific Interpretation &amp; System Alert
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Hydrochemical matrix translating live telemetry into operational system alerts.
          </p>

          {/* Matrix Table */}
          <div className="overflow-x-auto rounded-xl border border-border/40 bg-black/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-black/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="p-3 font-semibold">Sensor Observation</th>
                  <th className="p-3 font-semibold">Scientific Interpretation</th>
                  <th className="p-3 font-semibold">System Alert</th>
                  <th className="p-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {correlation.sensorAlerts.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      row.active
                        ? "bg-rose-500/10 font-medium"
                        : "hover:bg-white/[0.02] text-muted-foreground"
                    }`}
                  >
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          row.active
                            ? row.tone === "danger"
                              ? "bg-rose-500 animate-pulse"
                              : "bg-amber-400"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                      {row.observation}
                    </td>
                    <td className="p-3 text-xs leading-relaxed text-foreground/90">
                      {row.interpretation}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          row.active
                            ? row.tone === "danger"
                              ? "bg-rose-500/25 text-rose-300 border border-rose-500/50"
                              : "bg-amber-500/25 text-amber-300 border border-amber-500/50"
                            : "bg-black/40 text-muted-foreground border border-border/40"
                        }`}
                      >
                        {row.alert}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {row.active ? (
                        <span className="text-[10px] font-mono font-bold uppercase text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                          Active Trigger
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">
                          Clear
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Important Scientific Detail Callout */}
          <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 via-black/30 to-black/40 p-3.5 sm:p-4 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
              <Atom className="h-4 w-4 text-cyan-400" />
              <span>Important Scientific Detail: Chlorine Disinfection Equilibrium</span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed font-normal">
              {correlation.chlorineDisinfectionDetail}
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 02 — DISEASE-AWARENESS WATCHLIST (PATHOGEN AWARENESS WATCHLIST)          */}
        {/* ========================================================================= */}
        <div className="mt-8 border-t border-border/30 pt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">
                02
              </span>
              <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Microscope className="h-4 w-4 text-cyan-400" />
                Disease-Awareness Watchlist
              </h4>
            </div>
            <span className="text-xs text-muted-foreground">
              Module: <strong className="text-foreground">Pathogen Awareness Monitor</strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Target waterborne organisms for institutional risk surveillance and biological survival tracking under current hydrochemistry.
          </p>

          {/* 6 Pathogen Organism Cards with Microscopic Reference Photos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {correlation.pathogens.map((p) => {
              const isSelected = selectedPathogenId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPathogenId(isSelected ? null : p.id)}
                  className={`rounded-2xl border p-3.5 transition-all cursor-pointer flex flex-col justify-between overflow-hidden relative group ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xl"
                      : "border-border/40 bg-black/30 hover:border-border/80 hover:bg-black/50"
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Reference Photo Thumbnail */}
                    <div className="relative h-28 w-full overflow-hidden rounded-xl bg-black/60 border border-border/40">
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        onError={(e) => {
                          // Gracefully hide broken image element if network blocks OpenAI image CDN
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                      <div className="absolute top-2 right-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase backdrop-blur-md ${p.badgeClass}`}
                        >
                          {p.riskLevel}
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="text-[11px] font-bold text-white drop-shadow truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-cyan-200 drop-shadow truncate font-medium">
                          {p.disease}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Header */}
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${p.dotColor}`} />
                          {p.name}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {p.category}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-rose-300/90 mt-0.5">
                        Clinical: {p.disease}
                      </div>
                    </div>

                    {/* Risk Reason Summary */}
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {p.riskReason}
                    </p>
                  </div>

                  {/* Quick Expand Hint */}
                  <div className="mt-3 pt-2 border-t border-border/20 flex items-center justify-between text-[10px] text-primary">
                    <span>{isSelected ? "Hide Clinical Details" : "View Clinical Details & Assay"}</span>
                    {isSelected ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </div>

                  {/* Expanded Detailed Profile */}
                  {isSelected && (
                    <div className="mt-3 pt-2 border-t border-border/30 space-y-2 text-xs text-muted-foreground">
                      <div>
                        <strong className="text-foreground">Clinical Symptoms: </strong>
                        <span>{p.symptoms}</span>
                      </div>
                      <div>
                        <strong className="text-foreground">Vector: </strong>
                        <span>{p.vector}</span>
                      </div>
                      <div>
                        <strong className="text-foreground">Required Lab Assay: </strong>
                        <span className="text-cyan-300 font-mono text-[11px] font-semibold">
                          {p.requiredAssay}
                        </span>
                      </div>
                      <div className="rounded-lg bg-black/40 p-2 text-[11px] border border-border/30">
                        <strong className="text-primary">Survival Mechanism: </strong>
                        <span>{p.survivalProfile}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Toggle All Cards View */}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowAllPathogenCards(!showAllPathogenCards)}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              {showAllPathogenCards ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Collapse Full Pathogen Dossier
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" /> Expand Full Detailed Dossier ({correlation.pathogens.length} Organisms)
                </>
              )}
            </button>
          </div>

          {/* Full Pathogen Dossier Expandable */}
          {showAllPathogenCards && (
            <div className="mt-4 space-y-3 border-t border-border/30 pt-4">
              {correlation.pathogens.map((p) => (
                <div
                  key={`full-${p.id}`}
                  className="rounded-xl border border-border/40 bg-black/30 p-4 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.dotColor}`} />
                      <span className="font-bold text-sm text-foreground">{p.name}</span>
                      <span className="text-xs text-rose-300 font-semibold">({p.disease})</span>
                      <span className="text-[10px] text-muted-foreground font-mono">[{p.category}]</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${p.badgeClass}`}>
                      {p.riskLevel}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div>
                      <strong className="text-foreground">Symptoms: </strong>
                      <span className="text-muted-foreground">{p.symptoms}</span>
                    </div>
                    <div>
                      <strong className="text-foreground">Vector: </strong>
                      <span className="text-muted-foreground">{p.vector}</span>
                    </div>
                    <div>
                      <strong className="text-foreground">Required Lab Assay: </strong>
                      <span className="text-cyan-300 font-mono">{p.requiredAssay}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/40 p-2 text-[11px] border border-border/20">
                    <strong className="text-primary font-semibold">Hydrochemical Survival &amp; Risk: </strong>
                    <span className="text-foreground/90">{p.survivalProfile}</span>{" "}
                    <span className="text-rose-300 font-medium">[{p.riskReason}]</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 03 — INFRASTRUCTURE & PIPE IMPACT INTELLIGENCE                             */}
        {/* ========================================================================= */}
        <div className="mt-8 border-t border-border/30 pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">
              03
            </span>
            <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4 text-cyan-400" />
              Infrastructure &amp; Pipe Impact Intelligence
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Surveillance of distribution plumbing maintenance, mineral encrustation, valve sticking, and internal pipe corrosion.
          </p>

          {/* Conditions & Impact Matrix */}
          <div className="overflow-x-auto rounded-xl border border-border/40 bg-black/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-black/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="p-3 font-semibold">Water Condition</th>
                  <th className="p-3 font-semibold">Potential Infrastructure Impact</th>
                  <th className="p-3 font-semibold text-right">Physical Risk Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {correlation.infrastructureItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.active
                        ? "bg-amber-500/10 font-medium"
                        : "hover:bg-white/[0.02] text-muted-foreground"
                    }`}
                  >
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          item.active
                            ? item.severity === "danger"
                              ? "bg-rose-500 animate-pulse"
                              : "bg-amber-400"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                      {item.condition}
                    </td>
                    <td className="p-3 text-xs leading-relaxed text-foreground/90">
                      {item.impact}
                    </td>
                    <td className="p-3 text-right">
                      {item.active ? (
                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                            item.severity === "danger"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          }`}
                        >
                          Active Impact
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">
                          Minimal Strain
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3 Infrastructure Reference Photography Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
            {correlation.infrastructureImages.map((img) => (
              <div
                key={img.id}
                className="rounded-2xl border border-border/40 bg-black/30 overflow-hidden space-y-2 group"
              >
                <div className="relative h-32 w-full overflow-hidden bg-black/60">
                  <img
                    src={img.imageUrl}
                    alt={img.title}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <span className="text-xs font-bold text-white drop-shadow block truncate">
                      {img.title}
                    </span>
                  </div>
                </div>
                <div className="p-3 pt-0">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {img.caption}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scientific Protocol Disclaimer */}
        <div className="mt-6 rounded-xl border border-border/40 bg-black/40 p-3.5 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <strong className="text-foreground">Scientific Protocol &amp; Potability Standard: </strong>
            {correlation.scientificProtocol}
          </div>
        </div>
      </div>
    </div>
  );
}
