"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, Line, ComposedChart,
} from "recharts";
import {
  api, KpiSummary, TrendPoint, ActionItem,
  CampaignPerfWithDelta,
  BizMoneyBalance, QualityIndexSummary, AdCreativesSummary, AdExtensionsSummary,
} from "@/lib/api";
import { useStore } from "@/components/StoreProvider";
import Modal from "@/components/Modal";
import DeltaIndicator from "@/components/DeltaIndicator";
import DateRangePicker from "@/components/DateRangePicker";
import StatusBadge from "@/components/StatusBadge";
import BizMoneyBadge from "@/components/BizMoneyBadge";
import QualityIndexChart from "@/components/QualityIndexChart";
import AdCreativesSummaryView from "@/components/AdCreativesSummary";
import CollapsibleSection from "@/components/CollapsibleSection";
import KeywordToolPanel from "@/components/KeywordToolPanel";
import BidSimPanel from "@/components/BidSimPanel";
import { formatKRW, formatKRWShort, formatPct, formatNum } from "@/lib/format";

export default function AllInOnePage() {
  const { selectedStoreId, stores, hasLinkedStores, periodDays } = useStore();

  // 기존 데이터
  const [summary, setSummary] = useState<KpiSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = useState<ActionItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignPerfWithDelta[]>([]);
  const [loading, setLoading] = useState(true);

  // 신규 데이터
  const [bizmoney, setBizmoney] = useState<BizMoneyBalance | null>(null);
  const [qualityIndex, setQualityIndex] = useState<QualityIndexSummary | null>(null);
  const [adCreatives, setAdCreatives] = useState<AdCreativesSummary | null>(null);
  const [adExtensions, setAdExtensions] = useState<AdExtensionsSummary | null>(null);

  // 로딩 상태 (개별)
  const [bizLoading, setBizLoading] = useState(true);
  const [qiLoading, setQiLoading] = useState(true);
  const [adsLoading, setAdsLoading] = useState(true);
  const [extLoading, setExtLoading] = useState(true);
  const [bizError, setBizError] = useState(false);
  const [qiError, setQiError] = useState(false);
  const [adsError, setAdsError] = useState(false);

  const [showAlertModal, setShowAlertModal] = useState(false);

  const currentStoreName = useMemo(
    () => stores.find((s) => s.id === selectedStoreId)?.name ?? "전체 종합",
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
    ])
      .then(([s, t, a, c]) => {
        setSummary(s);
        setTrend(t);
        setAlerts(a);
        setCampaigns(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedStoreId, periodDays]);

  // 신규 데이터 로드 (독립적)
  useEffect(() => {
    if (!selectedStoreId) return;

    setBizLoading(true); setBizError(false);
    api.getBizMoney(selectedStoreId)
      .then(setBizmoney)
      .catch(() => setBizError(true))
      .finally(() => setBizLoading(false));

    setQiLoading(true); setQiError(false);
    api.getQualityIndex(selectedStoreId)
      .then(setQualityIndex)
      .catch(() => setQiError(true))
      .finally(() => setQiLoading(false));

    setAdsLoading(true); setAdsError(false);
    api.getAdCreatives(selectedStoreId)
      .then(setAdCreatives)
      .catch(() => setAdsError(true))
      .finally(() => setAdsLoading(false));

    setExtLoading(true);
    api.getAdExtensions(selectedStoreId)
      .then(setAdExtensions)
      .catch(() => {})
      .finally(() => setExtLoading(false));
  }, [selectedStoreId]);

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => b.cost - a.cost),
    [campaigns]
  );
  const highAlerts = useMemo(
    () => alerts.filter((a) => a.level === "HIGH"),
    [alerts]
  );
  const mediumAlerts = useMemo(
    () => alerts.filter((a) => a.level === "MEDIUM"),
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
          <p className="text-sm text-gray-400">전체 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  const trendForChart = trend.map((t) => ({
    ...t,
    date: t.date.slice(5),
    광고비: t.cost,
    매출: t.revenue,
    클릭수: t.clicks,
  }));

  const healthMetrics = summary ? getHealthMetrics(summary) : [];

  return (
    <div className="p-4 max-w-[1400px] overflow-y-auto h-[calc(100vh)]">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-black text-gray-900 tracking-tight">
            {currentStoreName} — 전체 종합
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {summary?.date ? `${summary.date} 기준` : ""} · 모든 데이터를 한눈에
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* ─── 비즈머니 배너 ─── */}
      <div className="mb-3">
        <BizMoneyBadge
          bizmoney={bizmoney?.bizmoney ?? 0}
          budgetLock={bizmoney?.budget_lock ?? 0}
          loading={bizLoading}
          error={bizError}
        />
      </div>

      {/* ─── KPI 스트립 (6컬럼) ─── */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        <CompactKpi title="광고비" value={formatKRW(summary?.cost ?? 0)} delta={summary?.deltas?.cost} inverseDelta />
        <CompactKpi title="매출액" value={formatKRW(summary?.revenue ?? 0)} delta={summary?.deltas?.revenue} />
        <CompactKpi title="ROAS" value={formatPct(summary?.roas ?? 0)} delta={summary?.deltas?.roas} />
        <CompactKpi title="전환수" value={formatNum(summary?.conversions ?? 0) + "건"} delta={summary?.deltas?.conversions} />
        <CompactKpi title="클릭수" value={formatNum(summary?.clicks ?? 0) + "회"} delta={summary?.deltas?.clicks} />
        <CompactKpi title="CTR" value={formatPct(summary?.ctr ?? 0)} delta={summary?.deltas?.ctr} />
      </div>

      {/* ─── 메인 그리드 ─── */}
      <div className="grid grid-cols-5 gap-3 mb-3">
        {/* 왼쪽 3/5 */}
        <div className="col-span-3 flex flex-col gap-3">
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
            <ResponsiveContainer width="100%" height={140}>
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
          <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-700">
                캠페인 성과
                <span className="ml-1.5 text-[10px] font-normal text-gray-400">{periodDays}일 기준</span>
              </h3>
            </div>
            <div className="overflow-auto max-h-[280px]">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100 text-gray-400">
                    <th className="text-left py-1.5 px-2 font-medium">캠페인</th>
                    <th className="text-right py-1.5 px-2 font-medium">광고비</th>
                    <th className="text-right py-1.5 px-2 font-medium">클릭</th>
                    <th className="text-right py-1.5 px-2 font-medium">CTR</th>
                    <th className="text-right py-1.5 px-2 font-medium">전환</th>
                    <th className="text-right py-1.5 px-2 font-medium">ROAS</th>
                    <th className="text-right py-1.5 px-2 font-medium">변화</th>
                    <th className="text-center py-1.5 px-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaigns.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-4 text-gray-400">캠페인 데이터가 없습니다</td></tr>
                  ) : sortedCampaigns.map((c, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-1.5 px-2 font-medium text-gray-800 truncate max-w-[160px]">{c.campaign_name || "(미분류)"}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{formatKRWShort(c.cost)}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{formatNum(c.clicks)}</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{c.ctr.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-gray-600">{formatNum(c.conversions)}</td>
                      <td className={`py-1.5 px-2 text-right font-bold ${c.roas >= 200 ? "text-emerald-600" : c.roas > 0 ? "text-red-500" : "text-gray-400"}`}>
                        {c.roas > 0 ? c.roas.toFixed(0) + "%" : "-"}
                      </td>
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
        <div className="col-span-2 flex flex-col gap-3">
          {/* 계정 건강도 */}
          <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
            <h3 className="text-xs font-bold text-gray-700 mb-2">계정 건강도</h3>
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

          {/* 품질지수 분포 */}
          <QualityIndexChart
            distribution={qualityIndex?.distribution ?? { high: 0, medium: 0, low: 0, total: 0 }}
            details={qualityIndex?.details ?? []}
            loading={qiLoading}
            error={qiError}
          />

          {/* 광고소재 현황 */}
          <AdCreativesSummaryView
            data={adCreatives}
            loading={adsLoading}
            error={adsError}
          />

          {/* 긴급 알림 */}
          <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-700">알림 요약</h3>
              {alerts.length > 0 && (
                <button onClick={() => setShowAlertModal(true)} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">
                  전체 {alerts.length}건
                </button>
              )}
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-gray-400">알림이 없습니다</p>
            ) : (
              <div className="space-y-1">
                {highAlerts.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{"\u{1F534}"} HIGH</span>
                    <span className="font-medium text-red-600">{highAlerts.length}건</span>
                  </div>
                )}
                {mediumAlerts.length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{"\u{1F7E1}"} MEDIUM</span>
                    <span className="font-medium text-amber-600">{mediumAlerts.length}건</span>
                  </div>
                )}
                {alerts.filter(a => a.level === "LOW").length > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{"\u{1F535}"} LOW</span>
                    <span className="font-medium text-blue-600">{alerts.filter(a => a.level === "LOW").length}건</span>
                  </div>
                )}
                {/* 상위 2개 HIGH 알림 미리보기 */}
                {highAlerts.slice(0, 2).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 p-1.5 rounded bg-red-50 text-[10px] mt-1">
                    <span className="text-red-500 mt-0.5">{"\u25CF"}</span>
                    <div className="min-w-0">
                      <p className="text-gray-500 truncate">{a.campaign} &gt; {a.adgroup}</p>
                      <p className="text-blue-600 font-medium">{a.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 확장소재 요약 (간략) */}
          {!extLoading && adExtensions && adExtensions.total > 0 && (
            <div className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">확장소재 현황</p>
              <div className="space-y-1">
                {Object.entries(adExtensions.by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{type}</span>
                    <span className="font-medium text-gray-700">{count}개</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">총 {adExtensions.total}개</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── 접이식 섹션 ─── */}
      <div className="space-y-2 mb-8">
        <CollapsibleSection title="키워드 도구 — 검색량/경쟁도 조회" icon={"\u{1F50D}"}>
          {selectedStoreId && <KeywordToolPanel storeId={selectedStoreId} />}
        </CollapsibleSection>

        <CollapsibleSection title="입찰 시뮬레이션" icon={"\u{1F4A1}"}>
          {selectedStoreId && <BidSimPanel storeId={selectedStoreId} />}
        </CollapsibleSection>
      </div>

      {/* 모달 */}
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
          {delta > 0 ? "\u25B2" : delta < 0 ? "\u25BC" : "\u2500"} {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
        </span>
      )}
    </div>
  );
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
    HIGH: { bg: "bg-red-50", badge: "bg-red-100 text-red-700", icon: "\u{1F534}" },
    MEDIUM: { bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700", icon: "\u{1F7E1}" },
    LOW: { bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700", icon: "\u{1F535}" },
  }[alert.level] || { bg: "bg-gray-50", badge: "bg-gray-100 text-gray-700", icon: "\u26AA" };

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
