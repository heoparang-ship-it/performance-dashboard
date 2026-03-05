"use client";

import { formatKRW } from "@/lib/format";

interface BizMoneyBadgeProps {
  bizmoney: number;
  budgetLock: number;
  loading?: boolean;
  error?: boolean;
}

export default function BizMoneyBadge({ bizmoney, budgetLock, loading, error }: BizMoneyBadgeProps) {
  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-sm text-gray-400">
        비즈머니 정보를 불러올 수 없습니다
      </div>
    );
  }

  const available = bizmoney - budgetLock;
  const level =
    available >= 500_000 ? "safe" :
    available >= 100_000 ? "warning" :
    "danger";

  const colors = {
    safe: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500", icon: "text-emerald-600" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", bar: "bg-amber-500", icon: "text-amber-600" },
    danger: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", bar: "bg-red-500", icon: "text-red-600" },
  }[level];

  // 게이지: bizmoney 중 available 비율
  const pct = bizmoney > 0 ? Math.round((available / bizmoney) * 100) : 0;

  return (
    <div className={`${colors.bg} rounded-lg border ${colors.border} px-4 py-3 flex items-center gap-4`}>
      <span className={`text-lg ${colors.icon}`}>
        {level === "safe" ? "\u{1F4B0}" : level === "warning" ? "\u26A0\uFE0F" : "\u{1F6A8}"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500">비즈머니 잔액</span>
          <span className={`text-sm font-bold ${colors.text}`}>
            {formatKRW(available)}
          </span>
          {budgetLock > 0 && (
            <span className="text-[10px] text-gray-400">
              (예약 {formatKRW(budgetLock)})
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} rounded-full transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className={`text-xs font-medium ${colors.text}`}>{pct}%</span>
    </div>
  );
}
