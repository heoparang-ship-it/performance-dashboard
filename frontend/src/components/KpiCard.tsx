"use client";

import { deltaColor, formatDelta } from "@/lib/format";

interface KpiCardProps {
  title: string;
  value: string;
  delta?: number | null;
  inverseDelta?: boolean;
}

export default function KpiCard({
  title,
  value,
  delta,
  inverseDelta,
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">{title}</p>
      <p className="text-xl font-black text-gray-900 tracking-tight">{value}</p>
      {delta !== undefined && delta !== null && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${deltaColor(delta, inverseDelta)}`}>
          <span>{delta > 0 ? "▲" : delta < 0 ? "▼" : "─"}</span>
          <span>전일 대비 {formatDelta(delta)}</span>
        </div>
      )}
    </div>
  );
}
