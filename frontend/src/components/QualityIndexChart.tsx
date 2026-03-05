"use client";

import type { QualityIndexDistribution, QualityIndexDetail } from "@/lib/api";
import { useState } from "react";

interface QualityIndexChartProps {
  distribution: QualityIndexDistribution;
  details: QualityIndexDetail[];
  loading?: boolean;
  error?: boolean;
}

export default function QualityIndexChart({ distribution, details, loading, error }: QualityIndexChartProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
        <div className="h-4 bg-gray-100 rounded w-24 mb-3" />
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">품질지수 분포</p>
        <p className="text-xs text-gray-400">품질지수를 불러올 수 없습니다</p>
      </div>
    );
  }

  const { high, medium, low, total } = distribution;

  const bars = [
    { label: "우수 (8-10)", count: high, color: "bg-emerald-500", textColor: "text-emerald-700" },
    { label: "보통 (4-7)", count: medium, color: "bg-amber-400", textColor: "text-amber-700" },
    { label: "낮음 (1-3)", count: low, color: "bg-red-400", textColor: "text-red-700" },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">품질지수 분포</p>
        <span className="text-[10px] text-gray-400">총 {total}개</span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-gray-400">품질지수 데이터 없음</p>
      ) : (
        <>
          {/* 스택 바 */}
          <div className="h-3 rounded-full overflow-hidden flex mb-3">
            {bars.map((b) => (
              b.count > 0 && (
                <div
                  key={b.label}
                  className={`${b.color} transition-all`}
                  style={{ width: `${(b.count / total) * 100}%` }}
                />
              )
            ))}
          </div>

          {/* 범례 */}
          <div className="space-y-1">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${b.color}`} />
                  <span className="text-gray-600">{b.label}</span>
                </div>
                <span className={`font-medium ${b.textColor}`}>
                  {b.count}개 ({total > 0 ? Math.round((b.count / total) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>

          {/* 상세 토글 */}
          {details.length > 0 && (
            <>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="mt-2 text-[10px] text-blue-500 hover:text-blue-700"
              >
                {showDetails ? "접기" : `낮은 품질 키워드 보기 (${low}개)`}
              </button>
              {showDetails && (
                <div className="mt-2 max-h-32 overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="text-left py-1 font-medium">키워드</th>
                        <th className="text-right py-1 font-medium">QI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.filter(d => d.quality_index <= 3).map((d, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1 text-gray-700">{d.keyword}</td>
                          <td className="py-1 text-right">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-white text-[9px] font-bold ${
                              d.quality_index <= 3 ? "bg-red-400" : d.quality_index <= 7 ? "bg-amber-400" : "bg-emerald-500"
                            }`}>
                              {d.quality_index}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
