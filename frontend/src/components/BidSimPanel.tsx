"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { formatKRW, formatNum } from "@/lib/format";

interface BidSimPanelProps {
  storeId: number;
}

export default function BidSimPanel({ storeId }: BidSimPanelProps) {
  const [keywordId, setKeywordId] = useState("");
  const [bid, setBid] = useState("");
  const [device, setDevice] = useState("PC");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSimulate = async () => {
    if (!keywordId || !bid) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getBidSimulation(storeId, {
        keyword_id: keywordId,
        bid: parseInt(bid, 10),
        device,
      });
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "시뮬레이션 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <input
          type="text"
          value={keywordId}
          onChange={(e) => setKeywordId(e.target.value)}
          placeholder="키워드 ID"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <input
          type="number"
          value={bid}
          onChange={(e) => setBid(e.target.value)}
          placeholder="입찰가 (원)"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <select
          value={device}
          onChange={(e) => setDevice(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="PC">PC</option>
          <option value="MOBILE">모바일</option>
        </select>
        <button
          onClick={handleSimulate}
          disabled={loading || !keywordId || !bid}
          className="px-4 py-1.5 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "계산 중..." : "시뮬레이션"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {result && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-blue-500 mb-1">예상 노출수</p>
            <p className="text-sm font-bold text-blue-700">
              {formatNum(Number(result.impCnt || result.estimated_impressions || 0))}
            </p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-emerald-500 mb-1">예상 클릭수</p>
            <p className="text-sm font-bold text-emerald-700">
              {formatNum(Number(result.clkCnt || result.estimated_clicks || 0))}
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-amber-500 mb-1">예상 비용</p>
            <p className="text-sm font-bold text-amber-700">
              {formatKRW(Number(result.salesAmt || result.estimated_cost || 0))}
            </p>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <p className="text-xs text-gray-400">키워드 ID와 입찰가를 입력하고 시뮬레이션 버튼을 클릭하세요</p>
      )}
    </div>
  );
}
