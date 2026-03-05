"use client";

import type { AdCreativesSummary as AdCreativesData } from "@/lib/api";
import { useState } from "react";

interface AdCreativesSummaryProps {
  data: AdCreativesData | null;
  loading?: boolean;
  error?: boolean;
}

const STATUS_MAP: Record<string, { label: string; emoji: string; color: string }> = {
  ELIGIBLE: { label: "활성", emoji: "\u{1F7E2}", color: "text-emerald-600" },
  SERVING: { label: "활성", emoji: "\u{1F7E2}", color: "text-emerald-600" },
  PAUSED: { label: "중지", emoji: "\u26AA", color: "text-gray-500" },
  PENDING_REVIEW: { label: "심사중", emoji: "\u{1F7E1}", color: "text-amber-600" },
  REJECTED: { label: "거부", emoji: "\u{1F534}", color: "text-red-600" },
  DELETED: { label: "삭제", emoji: "\u26AB", color: "text-gray-400" },
};

function getStatusInfo(status: string) {
  return STATUS_MAP[status] || { label: status, emoji: "\u2753", color: "text-gray-500" };
}

export default function AdCreativesSummaryView({ data, loading, error }: AdCreativesSummaryProps) {
  const [showAds, setShowAds] = useState(false);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-24 mb-3" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">광고소재 현황</p>
        <p className="text-xs text-gray-400">광고소재를 불러올 수 없습니다</p>
      </div>
    );
  }

  const entries = Object.entries(data.status_counts);

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">광고소재 현황</p>
        <span className="text-[10px] text-gray-400">총 {data.total}개</span>
      </div>

      {data.total === 0 ? (
        <p className="text-xs text-gray-400">등록된 광고소재가 없습니다</p>
      ) : (
        <>
          <div className="space-y-1">
            {entries.map(([status, count]) => {
              const info = getStatusInfo(status);
              return (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{info.emoji} {info.label}</span>
                  <span className={`font-medium ${info.color}`}>{count}개</span>
                </div>
              );
            })}
          </div>

          {data.recent_ads.length > 0 && (
            <>
              <button
                onClick={() => setShowAds(!showAds)}
                className="mt-2 text-[10px] text-blue-500 hover:text-blue-700"
              >
                {showAds ? "접기" : "최근 소재 보기"}
              </button>
              {showAds && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
                  {data.recent_ads.map((ad, i) => (
                    <div key={i} className="text-[10px] p-1.5 bg-gray-50 rounded">
                      <div className="flex items-center gap-1">
                        <span>{getStatusInfo(ad.inspect_status || ad.status).emoji}</span>
                        <span className="font-medium text-gray-700 truncate">{ad.headline || "(제목 없음)"}</span>
                      </div>
                      {ad.description && (
                        <p className="text-gray-400 truncate mt-0.5">{ad.description}</p>
                      )}
                      <p className="text-gray-400 mt-0.5">{ad.campaign_name} &gt; {ad.adgroup_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
