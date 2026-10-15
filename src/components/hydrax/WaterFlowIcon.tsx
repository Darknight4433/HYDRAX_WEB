export function WaterFlowIcon({ active = true, size = 44 }: { active?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <defs>
        <linearGradient id="wf" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r="20" stroke="url(#wf)" strokeOpacity="0.35" strokeWidth="1.5" />
      <path
        d="M22 8c5 6 8 11 8 15a8 8 0 1 1-16 0c0-4 3-9 8-15Z"
        stroke="url(#wf)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="url(#wf)"
        fillOpacity={active ? 0.25 : 0.08}
      />
      {active && (
        <path
          d="M22 8c5 6 8 11 8 15a8 8 0 1 1-16 0c0-4 3-9 8-15Z"
          stroke="url(#wf)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray="6 8"
          className="animate-flow"
        />
      )}
    </svg>
  );
}

export function ValveIcon({ open, size = 40 }: { open: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="4" y="16" width="32" height="8" rx="2" fill="var(--muted)" stroke="var(--border)" />
      <circle
        cx="20"
        cy="20"
        r="7"
        fill={open ? "var(--primary)" : "var(--muted)"}
        stroke={open ? "var(--primary)" : "var(--border)"}
        style={{
          transition: "all .4s ease",
          filter: open ? "drop-shadow(0 0 6px var(--primary))" : "none",
        }}
      />
      <rect
        x="19"
        y="5"
        width="2"
        height="30"
        rx="1"
        fill={open ? "var(--accent)" : "var(--muted-foreground)"}
        style={{
          transformOrigin: "20px 20px",
          transform: `rotate(${open ? 0 : 90}deg)`,
          transition: "transform .5s ease",
        }}
      />
    </svg>
  );
}
