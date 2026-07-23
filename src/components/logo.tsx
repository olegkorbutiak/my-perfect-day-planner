function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect
        width="40"
        height="40"
        rx="10"
        fill="#04170f"
        className="animate-logo-badge"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <path
        d="M9 24 16 14 20.5 20 24 15 31 24"
        fill="none"
        stroke="#00a650"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        style={{ animation: "logo-draw 0.65s 0.35s ease-out both" }}
      />
      <path
        d="m14 27 4 4 9-10"
        fill="none"
        stroke="white"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        style={{ animation: "logo-draw 0.4s 0.95s ease-out both" }}
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark className="h-9 w-9 shrink-0" />
      <p className="font-condensed text-sm font-bold uppercase leading-none tracking-wide text-brand-text">
        My Perfect
        <br />
        Day Planner
      </p>
    </div>
  );
}
