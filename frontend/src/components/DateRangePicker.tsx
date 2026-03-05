"use client";

import { useStore } from "./StoreProvider";

const PRESETS = [
  { days: 7, label: "주간", desc: "이번 주 vs 지난 주" },
  { days: 14, label: "14일", desc: "최근 14일 vs 이전 14일" },
  { days: 30, label: "30일", desc: "최근 30일 vs 이전 30일" },
];

export default function DateRangePicker() {
  const { periodDays, setPeriodDays } = useStore();
  const active = PRESETS.find((p) => p.days === periodDays);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          실시간
        </span>
      </div>
      <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => setPeriodDays(p.days)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              periodDays === p.days
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {active && (
        <span className="text-[10px] text-gray-400">{active.desc}</span>
      )}
    </div>
  );
}
