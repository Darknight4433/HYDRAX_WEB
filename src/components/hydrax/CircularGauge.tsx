import { motion } from "framer-motion";

interface Props {
  value: number;
  max?: number;
  label?: string;
  unit?: string;
  size?: number;
  color?: string;
}

export function CircularGauge({
  value,
  max = 100,
  label,
  unit,
  size = 160,
  color = "var(--primary)",
}: Props) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--border)"
          strokeWidth={10}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-semibold tabular-nums text-foreground">
          {value.toFixed(value < 10 ? 1 : 0)}
          {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
        </div>
        {label && (
          <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        )}
      </div>
    </div>
  );
}
