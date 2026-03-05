"use client";

import { useState } from "react";
import { api, type KeywordToolResult } from "@/lib/api";
import { formatNum } from "@/lib/format";

interface KeywordToolPanelProps {
  storeId: number;
}

export default function KeywordToolPanel({ storeId }: KeywordToolPanelProps) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<KeywordToolResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const keywords = input
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) return;

    setLoading(true);
    setError("");
    try {
      const data = await api.getKeywordTool(storeId, keywords);
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "키워드 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  const compLabel = (idx: string) => {
    switch (idx) {
      case "HIGH": return "높음";
      case "MEDIUM": return "보통";
      case "LOW": return "낮음";
      default: return idx || "-";
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="키워드 입력 (쉼표로 구분)"
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-1.5 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "조회 중..." : "조회"}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b text-left">
                <th className="py-2 font-medium">키워드</th>
                <th className="py-2 font-medium text-right">PC 검색량</th>
                <th className="py-2 font-medium text-right">모바일 검색량</th>
                <th className="py-2 font-medium text-right">경쟁정도</th>
                <th className="py-2 font-medium text-right">추천입찰가</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 text-gray-700 font-medium">{r.keyword}</td>
                  <td className="py-2 text-right text-gray-600">{formatNum(r.monthly_pc_qc_cnt)}</td>
                  <td className="py-2 text-right text-gray-600">{formatNum(r.monthly_mobile_qc_cnt)}</td>
                  <td className="py-2 text-right">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      r.comp_idx === "HIGH" ? "bg-red-100 text-red-700" :
                      r.comp_idx === "MEDIUM" ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {compLabel(r.comp_idx)}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-600">{formatNum(r.pl_avg_depth)}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.length === 0 && !loading && !error && (
        <p className="text-xs text-gray-400">키워드를 입력하고 조회 버튼을 클릭하세요</p>
      )}
    </div>
  );
}
