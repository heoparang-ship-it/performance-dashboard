"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, Line, ComposedChart,
} from "recharts";
import {
  api, KpiSummary, TrendPoint, ActionItem,
  CampaignPerfWithDelta, AdgroupPerf,
} from "@/lib/api";
import { useStore } from "@/components/StoreProvider";
import Modal from "@/components/Modal";
import DeltaIndicator from "@/components/DeltaIndicator";
import DateRangePicker from "@/components/DateRangePicker";
import StatusBadge from "@/components/StatusBadge";
import { formatKRW, formatKRWShort, formatPct, formatNum } from "@/lib/format";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export default function DashboardPage() {
  const { selectedStoreId, stores, hasLinkedStores, periodDays } = useStore();
  const [summary, setSummary] = useState<KpiSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = useState<ActionItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignPerfWithDelta[]>([]);
  const [adgroups, setAdgroups] = useState<AdgroupPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<KpiSummary[]>([]);

  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  const currentStoreName = useMemo(
    () => stores.find((s) => s.id === selectedStoreId)?.name ?? "대시보드",
    [stores, selectedStoreId]
  );

  // 메인 데이터 로드
  useEffect(() => {
    if (!selectedStoreId) return;
    setLoading(true);
    Promise.all([
      api.getDashboardSummary(selectedStoreId),
      api.getDashboardTrend(selectedStoreId, periodDays),
      api.getDashboardAlerts(selectedStoreId),
      api.getCampaignsWithDelta(selectedStoreId, periodDays),
      api.getAdgroups(selectedStoreId),
    ])
      .then(([s, t, a, c, ag]) => {
        setSummary(s);
        setTrend(t);
        setAlerts(a);
        setCampaigns(c);
        setAdgroups(ag);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedStoreId, periodDays]);

  // 7일 일별 데이터 로드 (전일대비 delta 포함)
  useEffect(() => {
    if (!selectedStoreId) return;
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    Promise.all(dates.map((date) => api.getDashboardSummary(selectedStoreId, date)))
      .then((results) => setDailyData(results))
      .catch(() => {});
  }, [selectedStoreId]);

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => b.cost - a.cost),
    [campaigns]
  );
  const sortedAdgroups = useMemo(
    () => [...adgroups].sort((a, b) => b.cost - a.cost),
    [adgroups]
  );
  const highAlerts = useMemo(
    () => alerts.filter((a) => a.level === "HIGH"),
    [alerts]
  );

  if (!hasLinkedStores) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="text-5xl">📊</div>
          <h2 className="text-xl font-bold text-gray-800">데이터가 없습니다</h2>
          <p className="text-sm text-gray-500">
            설정에서 광고주를 연결하면<br />실시간 성과 데이터를 확인할 수 있습니다.
          </p>
          <Link
            href="/settings"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            광고주 연결하기
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">실시간 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  // trend API가 비어있으면 dailyData를 fallback으로 사용
  const rawTrend = trend.length > 0
    ? trend
    : dailyData.length > 0
      ? [...dailyData].reverse().map((d) => ({
          date: d.date,
          cost: d.cost,
          revenue: d.revenue,
          clicks: d.clicks,
          impressions: d.impressions ?? 0,
          conversions: d.conversions,
          ctr: d.ctr,
          roas: d.roas,
        }))
      : [];

  const trendForChart = rawTrend.map((t) => ({
    ...t,
    date: t.date.slice(5),
    광고비: t.cost,
    매출: t.revenue,
    클릭수: t.clicks,
  }));

  const healthMetrics = summary ? getHealthMetrics(summary) : [];

  return (
    <div className="p-4 max-w-[1400px] h-[calc(100vh)] flex flex-col overflow-hidden">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight">
            {currentStoreName}
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {summary?.date ? `${summary.date} 기준` : ""} · 최근 {periodDays}일 실시간 성과
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* ─── KPI 스트립 ─── */}
      <div className="grid grid-cols-5 gap-3 mb-3">
        <CompactKpi title="광고비" value={formatKRW(summary?.cost ?? 0)} delta={summary?.deltas?.cost} inverseDelta />
        <CompactKpi title="클릭수" value={formatNum(summary?.clicks ?? 0) + "회"} delta={summary?.deltas?.clicks} />
        <CompactKpi title="CTR" value={formatPct(summary?.ctr ?? 0)} delta={summary?.deltas?.ctr} />
        <CompactKpi title="ROAS" value={formatPct(summary?.roas ?? 0)} delta={summary?.deltas?.roas} />
        <CompactKpi title="전환수" value={formatNum(summary?.conversions ?? 0) + "건"} delta={summary?.deltas?.conversions} />
      </div>

      {/* ─── 메인 그리드 ─── */}
      <div className="grid grid-cols-5 gap-3 flex-1 min-h-0">
        {/* 왼쪽 3/5 */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0">
          {/* 추이 차트 */}
          <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-700">{periodDays}일 추이</h3>
              <div className="flex gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" />광고비</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" />매출</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full" />클릭수</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <ComposedChart data={trendForChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tickFormatter={(v) => formatKRWShort(v)} tick={{ fontSize: 9 }} stroke="#94a3b8" axisLine={false} tickLine={false} width={45} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} stroke="#94a3b8" axisLine={false} tickLine={false} width={30} hide />
                <Tooltip formatter={(v: number, name: string) => name === "클릭수" ? formatNum(v) : formatKRW(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11, padding: "6px 10px" }} />
                <Area yAxisId="left" type="monotone" dataKey="광고비" fill="#3b82f620" stroke="#3b82f6" strokeWidth={1.5} />
                <Area yAxisId="left" type="monotone" dataKey="매출" fill="#10b98120" stroke="#10b981" strokeWidth={1.5} />
                <Line yAxisId="right" type="monotone" dataKey="클릭수" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 캠페인 성과 테이블 */}
          <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-700">
                캠페인 성과
                <span className="ml-1.5 text-[10px] font-normal text-gray-400">{periodDays}일 기준 · 이전 {periodDays}일 대비</span>
              </h3>
              <button onClick={() => setShowCampaignModal(true)} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">전체보기</button>
            </div>
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100 text-gray-400">
                    <th className="text-left py-1.5 px-2 font-medium">캠페인</th>
                    <th className="text-right py-1.5 px-2 font-medium">광고비</th>
                    <th className="text-right py-1.5 px-2 font-medium">클릭</th>
                    <th className="text-right py-1.5 px-2 font-medium">CTR</th>
                    <th className="text-right py-1.5 px-2 font-medium">ROAS</th>
                    <th className="text-right py-1.5 px-2 font-medium">변화</th>
                    <th className="text-center py-1.5 px-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaigns.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-4 text-gray-400">캠페인 데이터가 없습니다</td></tr>
                  ) : sortedCampaigns.slice(0, 7).map((c, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-1.5 px-2 font-medium text-gray-800 truncate max-w-[180px]">{c.campaign_name || "(미분류)"}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{formatKRWShort(c.cost)}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{c.clicks}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{c.ctr.toFixed(1)}%</td>
                      <td className={`py-1.5 px-2 text-right font-bold ${c.roas >= 200 ? "text-emerald-600" : c.roas > 0 ? "text-red-500" : "text-gray-400"}`}>{c.roas > 0 ? c.roas.toFixed(0) + "%" : "-"}</td>
                      <td className="py-1.5 px-2 text-right"><DeltaIndicator value={c.deltas?.roas} /></td>
                      <td className="py-1.5 px-2 text-center"><StatusBadge roas={c.roas} clicks={c.clicks} conversions={c.conversions} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 오른쪽 2/5 */}
        <div className="col-span-2 flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* 계정 건강도 */}
          <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm flex-shrink-0">
            <h3 className="text-xs font-bold text-gray-700 mb-2">📊 계정 건강도</h3>
            <div className="grid grid-cols-3 gap-2">
              {healthMetrics.map((m) => (
                <div key={m.label} className={`rounded-lg p-2 text-center ${m.bgColor}`}>
                  <p className="text-[10px] text-gray-500 mb-0.5">{m.label}</p>
                  <p className="text-sm font-bold text-gray-800">{m.value}</p>
                  <span className={`text-[10px] font-medium ${m.badgeColor}`}>{m.badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 7일 일별 추이 + 전일대비 변화율 */}
          <DailyTrendBlock dailyData={dailyData} />

          {/* 엑스컴 AI 진단 */}
          <AiDiagnosisBlock
            summary={summary}
            dailyData={dailyData}
            campaigns={campaigns}
            alerts={alerts}
            storeName={currentStoreName}
          />

          {/* 긴급 알림 (축소) */}
          {highAlerts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-700">
                  🚨 긴급 알림
                  <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">{highAlerts.length}</span>
                </h3>
                <button onClick={() => setShowAlertModal(true)} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">전체 {alerts.length}건</button>
              </div>
              <div className="space-y-1">
                {highAlerts.slice(0, 2).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 p-1.5 rounded bg-red-50 text-[10px]">
                    <span className="text-red-500 mt-0.5">●</span>
                    <div className="min-w-0">
                      <p className="text-gray-500 truncate">{a.campaign} &gt; {a.adgroup}</p>
                      <p className="text-blue-600 font-medium">{a.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 모달 */}
      <Modal isOpen={showCampaignModal} onClose={() => setShowCampaignModal(false)} title="전체 성과" size="xl">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-100 text-gray-500 text-xs">
                <th className="text-left py-3 px-3 font-medium">#</th>
                <th className="text-left py-3 px-3 font-medium">캠페인</th>
                <th className="text-left py-3 px-3 font-medium">광고그룹</th>
                <th className="text-right py-3 px-3 font-medium">노출</th>
                <th className="text-right py-3 px-3 font-medium">클릭</th>
                <th className="text-right py-3 px-3 font-medium">CTR</th>
                <th className="text-right py-3 px-3 font-medium">광고비</th>
                <th className="text-right py-3 px-3 font-medium">ROAS</th>
                <th className="text-right py-3 px-3 font-medium">CPC</th>
              </tr>
            </thead>
            <tbody>
              {sortedAdgroups.map((ag, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">{ag.campaign_name}</td>
                  <td className="py-2.5 px-3 font-medium">{ag.adgroup_name}</td>
                  <td className="py-2.5 px-3 text-right">{formatNum(ag.impressions)}</td>
                  <td className="py-2.5 px-3 text-right">{formatNum(ag.clicks)}</td>
                  <td className="py-2.5 px-3 text-right">{formatPct(ag.ctr)}</td>
                  <td className="py-2.5 px-3 text-right">{formatKRW(ag.cost)}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${ag.roas >= 200 ? "text-emerald-600" : ag.roas > 0 ? "text-red-500" : "text-gray-400"}`}>{ag.roas > 0 ? formatPct(ag.roas) : "-"}</td>
                  <td className="py-2.5 px-3 text-right">{formatKRW(ag.avg_cpc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} title="전체 액션 추천" size="lg">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ── 컴팩트 KPI ──
function CompactKpi({ title, value, delta, inverseDelta }: { title: string; value: string; delta?: number | null; inverseDelta?: boolean }) {
  const getDeltaColor = () => {
    if (delta == null) return "";
    const isPositive = inverseDelta ? delta < 0 : delta > 0;
    const isNegative = inverseDelta ? delta > 0 : delta < 0;
    if (isPositive) return "text-emerald-600";
    if (isNegative) return "text-red-500";
    return "text-gray-400";
  };
  return (
    <div className="bg-white rounded-lg border border-gray-100 px-3 py-2.5 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-base font-black text-gray-900 mt-0.5 tracking-tight">{value}</p>
      {delta != null && (
        <span className={`text-[10px] font-medium ${getDeltaColor()}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "─"} {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// ── 7일 일별 추이 블록 ──
function DailyTrendBlock({ dailyData }: { dailyData: KpiSummary[] }) {
  if (dailyData.length === 0) return null;

  // 최신→과거 순이므로 뒤집어서 과거→최신 순으로
  const days = [...dailyData].reverse();
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm flex-shrink-0">
      <h3 className="text-xs font-bold text-gray-700 mb-2">📅 7일 일별 추이 <span className="font-normal text-gray-400">전일대비 변화율</span></h3>
      <div className="space-y-0.5">
        {days.map((day, i) => {
          const d = new Date(day.date + "T00:00:00");
          const dayName = DAY_NAMES[d.getDay()];
          const isToday = day.date === today;
          const revDelta = day.deltas?.revenue;
          const roasDelta = day.deltas?.roas;
          const costDelta = day.deltas?.cost;

          // 매출 변화율을 주요 지표로 사용 (없으면 ROAS)
          const mainDelta = revDelta ?? roasDelta;
          const barWidth = mainDelta != null ? Math.min(Math.abs(mainDelta), 100) : 0;
          const isPositive = mainDelta != null && mainDelta > 0;
          const isNegative = mainDelta != null && mainDelta < 0;

          return (
            <div key={day.date} className={`flex items-center gap-2 py-1 px-2 rounded text-[10px] ${isToday ? "bg-blue-50" : i % 2 === 0 ? "bg-gray-50/50" : ""}`}>
              {/* 날짜 */}
              <div className="w-[52px] flex-shrink-0">
                <span className="font-bold text-gray-700">{day.date.slice(5)}</span>
                <span className="text-gray-400 ml-0.5">({dayName})</span>
                {isToday && <span className="text-blue-500 text-[8px] ml-0.5">⏳</span>}
              </div>

              {/* 핵심 지표 */}
              <div className="w-[45px] text-right flex-shrink-0">
                <span className="text-gray-500">{formatKRWShort(day.cost)}</span>
              </div>
              <div className="w-[55px] text-right flex-shrink-0">
                <span className={`font-bold ${day.revenue > 0 ? "text-gray-800" : "text-gray-300"}`}>{day.revenue > 0 ? formatKRWShort(day.revenue) : "-"}</span>
              </div>
              <div className="w-[38px] text-right flex-shrink-0">
                <span className={`font-bold ${day.roas >= 200 ? "text-emerald-600" : day.roas > 0 ? "text-amber-600" : "text-gray-300"}`}>{day.roas > 0 ? day.roas.toFixed(0) + "%" : "-"}</span>
              </div>

              {/* 변화율 바 그래프 */}
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <div className="flex-1 h-[14px] relative bg-gray-100 rounded overflow-hidden">
                  {/* 중앙선 */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 z-10" />
                  {/* 바 */}
                  {mainDelta != null && mainDelta !== 0 && (
                    <div
                      className={`absolute top-0.5 bottom-0.5 rounded-sm ${isPositive ? "bg-emerald-400" : "bg-red-400"}`}
                      style={{
                        left: isPositive ? "50%" : `${50 - barWidth / 2}%`,
                        width: `${barWidth / 2}%`,
                      }}
                    />
                  )}
                </div>
                {/* % 수치 */}
                <div className="w-[42px] text-right flex-shrink-0">
                  {mainDelta != null ? (
                    <span className={`font-bold ${isPositive ? "text-emerald-600" : isNegative ? "text-red-500" : "text-gray-400"}`}>
                      {mainDelta > 0 ? "+" : ""}{mainDelta.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[9px] text-gray-400">
        <span>비용</span>
        <span>매출</span>
        <span>ROAS</span>
        <span className="flex items-center gap-1"><span className="w-2 h-1 bg-emerald-400 rounded-sm" />상승</span>
        <span className="flex items-center gap-1"><span className="w-2 h-1 bg-red-400 rounded-sm" />하락</span>
        <span className="ml-auto">매출 전일대비 %</span>
      </div>
    </div>
  );
}

// ── 엑스컴 AI 진단 블록 ──
function AiDiagnosisBlock({
  summary,
  dailyData,
  campaigns,
  alerts,
  storeName,
}: {
  summary: KpiSummary | null;
  dailyData: KpiSummary[];
  campaigns: CampaignPerfWithDelta[];
  alerts: ActionItem[];
  storeName: string;
}) {
  if (!summary) return null;

  const diagnoses = generateDiagnoses(summary, dailyData, campaigns, alerts);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-3 shadow-sm flex-shrink-0">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-white font-black text-[9px]">X</div>
        <div>
          <h3 className="text-xs font-bold text-white">엑스컴 AI 진단</h3>
          <p className="text-[9px] text-slate-400">AI 자동 진단</p>
        </div>
      </div>
      <div className="space-y-2">
        {diagnoses.map((d, i) => (
          <div key={i} className={`rounded-lg p-2 ${d.bgColor}`}>
            <div className="flex items-start gap-1.5">
              <span className="text-xs mt-0.5">{d.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-white">{d.title}</p>
                <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">{d.detail}</p>
                {d.solution && (
                  <p className="text-[10px] text-blue-300 font-medium mt-1">→ {d.solution}</p>
                )}
                <span className="text-[8px] text-slate-500 mt-0.5 inline-block">(참고용)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Diagnosis {
  icon: string;
  title: string;
  detail: string;
  solution?: string;
  bgColor: string;
}

function generateDiagnoses(
  summary: KpiSummary,
  dailyData: KpiSummary[],
  campaigns: CampaignPerfWithDelta[],
  alerts: ActionItem[]
): Diagnosis[] {
  const recs: Diagnosis[] = [];

  // 1) 오늘 성과 진단
  const todayRoas = summary.roas;
  const todayCost = summary.cost;
  const todayConv = summary.conversions;

  if (todayRoas >= 500 && todayConv > 0) {
    recs.push({
      icon: "🟢",
      title: `오늘 ROAS ${todayRoas.toFixed(0)}% — 고효율 운영`,
      detail: `CPA ${formatKRW(summary.cpa)}으로 효율적입니다. 전환당 비용이 낮아 현 예산 수준을 유지하거나 확대할 여지가 있습니다.`,
      solution: "성과 좋은 시간대에 예산 집중 배분 검토",
      bgColor: "bg-emerald-900/30",
    });
  } else if (todayRoas > 0 && todayRoas < 150 && todayCost > 10000) {
    recs.push({
      icon: "🔴",
      title: `오늘 ROAS ${todayRoas.toFixed(0)}% — 수익성 위험`,
      detail: `광고비 ${formatKRWShort(todayCost)} 대비 매출이 부족합니다. 전환율이 낮은 키워드가 비용을 소모하고 있을 가능성이 높습니다.`,
      solution: "CPC 상위 키워드 검색어 보고서 확인 후 제외 키워드 추가",
      bgColor: "bg-red-900/30",
    });
  } else if (todayConv === 0 && todayCost > 5000) {
    recs.push({
      icon: "🚨",
      title: `전환 0건 — 비용만 소진 중`,
      detail: `${formatKRWShort(todayCost)} 소진에 전환이 없습니다. 전환추적 스크립트 정상 작동 여부를 우선 점검하세요.`,
      solution: "전환추적 스크립트 확인 → 랜딩페이지 UX 점검 → 키워드 리뷰",
      bgColor: "bg-red-900/40",
    });
  }

  // 2) 캠페인별 진단
  const worsening = campaigns.filter((c) => c.deltas?.roas != null && c.deltas.roas < -30);
  const improving = campaigns.filter((c) => c.deltas?.roas != null && c.deltas.roas > 30 && c.cost > 5000);
  const zeroCampaigns = campaigns.filter((c) => c.clicks >= 20 && c.conversions === 0);

  if (worsening.length > 0) {
    const worst = worsening.reduce((a, b) => (a.deltas?.roas ?? 0) < (b.deltas?.roas ?? 0) ? a : b);
    recs.push({
      icon: "📉",
      title: `'${worst.campaign_name}' ROAS ${worst.deltas!.roas!.toFixed(0)}% 하락`,
      detail: `전기 대비 성과가 급락했습니다. 소재 피로도 또는 경쟁 입찰 강화가 원인일 수 있습니다.`,
      solution: `검색어 보고서에서 무효 클릭 확인 → 입찰가 10% 하향 후 3일 관찰`,
      bgColor: "bg-amber-900/30",
    });
  }

  if (improving.length > 0) {
    const best = improving.reduce((a, b) => (a.deltas?.roas ?? 0) > (b.deltas?.roas ?? 0) ? a : b);
    recs.push({
      icon: "🚀",
      title: `'${best.campaign_name}' ROAS +${best.deltas!.roas!.toFixed(0)}% 상승`,
      detail: `성과가 크게 개선되고 있습니다. 현재 일예산 한도를 확인하고 소진 속도를 점검하세요.`,
      solution: "일예산 20% 증액 테스트 → 노출 점유율 확인",
      bgColor: "bg-emerald-900/30",
    });
  }

  if (zeroCampaigns.length > 0) {
    const names = zeroCampaigns.slice(0, 2).map((c) => c.campaign_name).join(", ");
    recs.push({
      icon: "⚠️",
      title: `${zeroCampaigns.length}개 캠페인 전환 0건`,
      detail: `${names} — 클릭은 발생하지만 구매가 없습니다. 랜딩페이지와 상품 경쟁력을 점검하세요.`,
      solution: "키워드 의도 재점검 → 랜딩페이지 A/B 테스트",
      bgColor: "bg-amber-900/30",
    });
  }

  // 3) 7일 추세 기반 진단
  if (dailyData.length >= 3) {
    const recent3 = dailyData.slice(0, 3);
    const costTrend = recent3.every((d) => (d.deltas?.cost ?? 0) < 0);
    const revTrend = recent3.filter((d) => (d.deltas?.revenue ?? 0) < 0).length >= 2;

    if (costTrend && !revTrend) {
      recs.push({
        icon: "💡",
        title: "비용 감소 추세 — 효율 개선 중",
        detail: "최근 3일간 광고비가 연속 감소하면서도 매출이 유지되고 있습니다.",
        solution: "현 전략 유지하되, 노출 손실이 없는지 모니터링",
        bgColor: "bg-blue-900/30",
      });
    }

    if (revTrend) {
      recs.push({
        icon: "📊",
        title: "매출 하락 추세 감지",
        detail: "최근 3일 중 2일 이상 전일 대비 매출이 감소했습니다. 단기 변동인지 추세인지 관찰이 필요합니다.",
        solution: "주력 키워드 순위 및 경쟁 상황 확인 → 소재 리프레시 검토",
        bgColor: "bg-amber-900/30",
      });
    }
  }

  // 4) CPC 경고
  if (summary.avg_cpc > 500) {
    recs.push({
      icon: "💰",
      title: `CPC ${formatKRW(summary.avg_cpc)} — 클릭 단가 높음`,
      detail: `업계 평균 대비 높은 CPC입니다. 경쟁 키워드에 예산이 과도하게 집중되어 있을 수 있습니다.`,
      solution: "롱테일 키워드 확장 → 구문/확장검색 비중 조정",
      bgColor: "bg-amber-900/20",
    });
  }

  // 5) 안정 상태
  if (recs.length === 0) {
    recs.push({
      icon: "✅",
      title: "전반적으로 안정적인 운영 상태",
      detail: "현재 주요 지표에 특별한 이상이 감지되지 않았습니다.",
      solution: "신규 키워드 발굴 및 광고문안 A/B 테스트로 성과 확장",
      bgColor: "bg-blue-900/20",
    });
  }

  return recs.slice(0, 4);
}

// ── 계정 건강도 ──
interface HealthMetric { label: string; value: string; badge: string; bgColor: string; badgeColor: string; }

function getHealthMetrics(summary: KpiSummary): HealthMetric[] {
  const roas = summary.roas;
  const ctr = summary.ctr;
  const convRate = summary.clicks > 0 ? (summary.conversions / summary.clicks) * 100 : 0;

  const roasH = roas >= 300 ? { badge: "우수", bgColor: "bg-emerald-50", badgeColor: "text-emerald-600" }
    : roas >= 200 ? { badge: "양호", bgColor: "bg-blue-50", badgeColor: "text-blue-600" }
    : roas >= 100 ? { badge: "보통", bgColor: "bg-amber-50", badgeColor: "text-amber-600" }
    : { badge: "위험", bgColor: "bg-red-50", badgeColor: "text-red-600" };

  const ctrH = ctr >= 4 ? { badge: "우수", bgColor: "bg-emerald-50", badgeColor: "text-emerald-600" }
    : ctr >= 2 ? { badge: "양호", bgColor: "bg-blue-50", badgeColor: "text-blue-600" }
    : ctr >= 1 ? { badge: "보통", bgColor: "bg-amber-50", badgeColor: "text-amber-600" }
    : { badge: "위험", bgColor: "bg-red-50", badgeColor: "text-red-600" };

  const convH = convRate >= 3 ? { badge: "우수", bgColor: "bg-emerald-50", badgeColor: "text-emerald-600" }
    : convRate >= 1 ? { badge: "양호", bgColor: "bg-blue-50", badgeColor: "text-blue-600" }
    : convRate >= 0.5 ? { badge: "보통", bgColor: "bg-amber-50", badgeColor: "text-amber-600" }
    : { badge: "위험", bgColor: "bg-red-50", badgeColor: "text-red-600" };

  return [
    { label: "ROAS", value: formatPct(roas), ...roasH },
    { label: "CTR", value: formatPct(ctr), ...ctrH },
    { label: "전환율", value: convRate.toFixed(1) + "%", ...convH },
  ];
}

// ── 알림 행 ──
function AlertRow({ alert }: { alert: ActionItem }) {
  const levelConfig = {
    HIGH: { bg: "bg-red-50", badge: "bg-red-100 text-red-700", icon: "🔴" },
    MEDIUM: { bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700", icon: "🟡" },
    LOW: { bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700", icon: "🔵" },
  }[alert.level] || { bg: "bg-gray-50", badge: "bg-gray-100 text-gray-700", icon: "⚪" };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${levelConfig.bg}`}>
      <span className="text-sm mt-0.5">{levelConfig.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${levelConfig.badge}`}>{alert.level}</span>
          <span className="text-xs text-gray-500 truncate">{alert.campaign} &gt; {alert.adgroup}</span>
        </div>
        <p className="text-xs text-gray-600">{alert.reason}</p>
        <p className="text-xs text-blue-600 font-medium mt-0.5">{alert.action}</p>
      </div>
    </div>
  );
}
