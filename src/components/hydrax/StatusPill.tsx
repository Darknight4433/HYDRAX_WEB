import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted";

const map: Record<Tone, string> = {
  success:
    "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
  warning:
    "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-primary/15 text-primary border-primary/30",
  muted: "bg-muted text-muted-foreground border-border",
};

export function StatusPill({
  tone = "info",
  children,
  pulse,
}: {
  tone?: Tone;
  children: React.ReactNode;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        map[tone],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && "animate-pulse")} />
      {children}
    </span>
  );
}
