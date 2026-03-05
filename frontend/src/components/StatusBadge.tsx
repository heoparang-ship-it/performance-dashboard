"use client";

interface StatusBadgeProps {
  roas: number;
  clicks: number;
  conversions: number;
}

type StatusLevel = "excellent" | "good" | "warning" | "danger" | "nodata";

function getStatus(roas: number, clicks: number, conversions: number): StatusLevel {
  if (clicks < 5) return "nodata";
  if (clicks >= 20 && conversions === 0) return "danger";
  if (roas < 100 && roas > 0) return "danger";
  if (roas >= 300 && conversions >= 1) return "excellent";
  if (roas >= 100) return "good";
  if (roas === 0 && conversions === 0) return "warning";
  return "warning";
}

const STATUS_CONFIG: Record<StatusLevel, { emoji: string; label: string; className: string }> = {
  excellent: { emoji: "🟢", label: "우수", className: "bg-emerald-50 text-emerald-700" },
  good: { emoji: "🟡", label: "보통", className: "bg-amber-50 text-amber-700" },
  warning: { emoji: "🟠", label: "주의", className: "bg-orange-50 text-orange-700" },
  danger: { emoji: "🔴", label: "위험", className: "bg-red-50 text-red-700" },
  nodata: { emoji: "⚪", label: "부족", className: "bg-gray-50 text-gray-500" },
};

export default function StatusBadge({ roas, clicks, conversions }: StatusBadgeProps) {
  const status = getStatus(roas, clicks, conversions);
  const config = STATUS_CONFIG[status];

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.className}`}>
      {config.emoji}
    </span>
  );
}

export { getStatus, STATUS_CONFIG };
export type { StatusLevel };
