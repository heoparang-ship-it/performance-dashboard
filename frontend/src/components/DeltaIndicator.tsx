"use client";

interface DeltaIndicatorProps {
  value: number | null | undefined;
  /** true면 감소가 좋음 (비용 등) */
  inverse?: boolean;
  size?: "sm" | "md";
}

export default function DeltaIndicator({
  value,
  inverse,
  size = "sm",
}: DeltaIndicatorProps) {
  if (value == null) return <span className="text-gray-300 text-[10px]">-</span>;

  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;
  const colorClass = isPositive
    ? "text-emerald-600"
    : isNegative
      ? "text-red-500"
      : "text-gray-400";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "─";
  const sizeClass = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span className={`${colorClass} ${sizeClass} font-medium`}>
      {arrow} {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}
