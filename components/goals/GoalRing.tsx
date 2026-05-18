"use client";

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
}

function ringColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 70) return "#2563eb";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export function GoalRing({ score, size = 56, strokeWidth = 5 }: Props) {
  const pct     = Math.min(score / 100, 1);
  const r       = (size - strokeWidth) / 2;
  const circ    = 2 * Math.PI * r;
  const dash    = circ * pct;
  const color   = ringColor(score);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Score ${Math.round(score)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/25"
        />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <span
        className="absolute text-[10px] font-bold tabular-nums leading-none"
        style={{ color }}
      >
        {Math.round(score)}%
      </span>
    </div>
  );
}
