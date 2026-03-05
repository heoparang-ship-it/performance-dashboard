"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  api,
  CampaignPerfWithDelta,
  AdgroupPerfWithDelta,
  KeywordPerfWithDelta,
  PerformanceDeltas,
  AIRecommendation,
  AdCreativeForList,
} from "@/lib/api";
import { useStore } from "@/components/StoreProvider";
import DeltaIndicator from "@/components/DeltaIndicator";
import DateRangePicker from "@/components/DateRangePicker";
import StatusBadge from "@/components/StatusBadge";
import { formatKRW, formatKRWShort, formatPct, formatNum } from "@/lib/format";

// ── 트리 노드 타입 ──

interface TreeNode {
  level: "campaign" | "adgroup" | "keyword";
  key: string;
  name: string;
  campaignName?: string;
  adgroupName?: string;
  adgroupId?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  avg_cpc: number;
  deltas: PerformanceDeltas | null;
  recommendation: AIRecommendation | null;
  isExpanded: boolean;
  isLoading: boolean;
  children: TreeNode[];
  childrenLoaded: boolean;
  adCreatives: AdCreativeForList[];
  adCreativesLoaded: boolean;
}

type StatusFilter = "all" | "excellent" | "danger";

// ── 소재 상태 매핑 ──
const AD_STATUS: Record<string, { label: string; color: string }> = {
  ELIGIBLE: { label: "활성", color: "text-emerald-600 bg-emerald-50" },
  SERVING: { label: "활성", color: "text-emerald-600 bg-emerald-50" },
  PAUSED: { label: "중지", color: "text-gray-500 bg-gray-100" },
  PENDING_REVIEW: { label: "심사중", color: "text-amber-600 bg-amber-50" },
  UNDER_REVIEW: { label: "심사중", color: "text-amber-600 bg-amber-50" },
  REJECTED: { label: "거부", color: "text-red-600 bg-red-50" },
  DELETED: { label: "삭제", color: "text-gray-400 bg-gray-50" },
};

function getAdStatus(status: string) {
  return AD_STATUS[status] || { label: status || "-", color: "text-gray-500 bg-gray-100" };
}

export default function AdsPage() {
  const { selectedStoreId, periodDays } = useStore();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortCol, setSortCol] = useState("cost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showRecPanel, setShowRecPanel] = useState(true);

  // 캠페인 데이터 로드
  useEffect(() => {
    if (!selectedStoreId) return;
    setLoading(true);
    api
      .getCampaignsWithDelta(selectedStoreId, periodDays)
      .then((campaigns) => {
        const nodes: TreeNode[] = campaigns.map((c) => ({
          level: "campaign" as const,
          key: `c:${c.campaign_name}`,
          name: c.campaign_name || "(미분류)",
          campaignName: c.campaign_name,
          impressions: c.impressions,
          clicks: c.clicks,
          ctr: c.ctr,
          cost: c.cost,
          conversions: c.conversions,
          revenue: c.revenue,
          roas: c.roas,
          cpa: c.cpa,
          avg_cpc: c.avg_cpc,
          deltas: c.deltas,
          recommendation: c.recommendation ?? null,
          isExpanded: false,
          isLoading: false,
          children: [],
          childrenLoaded: false,
          adCreatives: [],
          adCreativesLoaded: false,
        }));
        setTree(nodes);
      })
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [selectedStoreId, periodDays]);

  // 캠페인 클릭 → 광고그룹 로드
  const toggleCampaign = useCallback(
    async (campaignKey: string) => {
      const target = tree.find((n) => n.key === campaignKey);
      if (!target || !selectedStoreId) return;

      if (target.childrenLoaded) {
        setTree((prev) =>
          prev.map((node) =>
            node.key === campaignKey ? { ...node, isExpanded: !node.isExpanded } : node
          )
        );
        return;
      }

      setTree((prev) =>
        prev.map((node) =>
          node.key === campaignKey ? { ...node, isExpanded: true, isLoading: true } : node
        )
      );

      try {
        const adgroups = await api.getAdgroupsWithDelta(
          selectedStoreId,
          target.campaignName,
          periodDays
        );
        const children: TreeNode[] = adgroups.map((ag) => ({
          level: "adgroup" as const,
          key: `ag:${ag.campaign_name}:${ag.adgroup_name}`,
          name: ag.adgroup_name || "(미분류)",
          campaignName: ag.campaign_name,
          adgroupName: ag.adgroup_name,
          adgroupId: ag.adgroup_id || "",
          impressions: ag.impressions,
          clicks: ag.clicks,
          ctr: ag.ctr,
          cost: ag.cost,
          conversions: ag.conversions,
          revenue: ag.revenue,
          roas: ag.roas,
          cpa: ag.cpa,
          avg_cpc: ag.avg_cpc,
          deltas: ag.deltas,
          recommendation: ag.recommendation ?? null,
          isExpanded: false,
          isLoading: false,
          children: [],
          childrenLoaded: false,
          adCreatives: [],
          adCreativesLoaded: false,
        }));

        setTree((prev) =>
          prev.map((node) =>
            node.key === campaignKey
              ? { ...node, children, childrenLoaded: true, isLoading: false }
              : node
          )
        );
      } catch {
        setTree((prev) =>
          prev.map((node) =>
            node.key === campaignKey ? { ...node, isLoading: false } : node
          )
        );
      }
    },
    [tree, selectedStoreId, periodDays]
  );

  // 광고그룹 클릭 → 키워드 + 소재 로드
  const toggleAdgroup = useCallback(
    async (campaignKey: string, adgroupKey: string) => {
      const campaignNode = tree.find((n) => n.key === campaignKey);
      const agNode = campaignNode?.children.find((n) => n.key === adgroupKey);
      if (!agNode || !selectedStoreId) return;

      if (agNode.childrenLoaded) {
        setTree((prev) =>
          prev.map((cNode) => {
            if (cNode.key !== campaignKey) return cNode;
            return {
              ...cNode,
              children: cNode.children.map((ag) =>
                ag.key === adgroupKey ? { ...ag, isExpanded: !ag.isExpanded } : ag
              ),
            };
          })
        );
        return;
      }

      // 로딩 시작
      setTree((prev) =>
        prev.map((cNode) => {
          if (cNode.key !== campaignKey) return cNode;
          return {
            ...cNode,
            children: cNode.children.map((ag) =>
              ag.key === adgroupKey ? { ...ag, isExpanded: true, isLoading: true } : ag
            ),
          };
        })
      );

      try {
        // 키워드 + 소재 병렬 로드
        const [keywords, ads] = await Promise.all([
          api.getKeywordsWithDelta(
            selectedStoreId,
            agNode.campaignName,
            agNode.adgroupName,
            periodDays
          ),
          agNode.adgroupId
            ? api.getAdgroupAds(selectedStoreId, agNode.adgroupId)
            : Promise.resolve([]),
        ]);

        const children: TreeNode[] = keywords.map((kw) => ({
          level: "keyword" as const,
          key: `kw:${kw.campaign_name}:${kw.adgroup_name}:${kw.keyword}`,
          name: kw.keyword || "(미분류)",
          campaignName: kw.campaign_name,
          adgroupName: kw.adgroup_name,
          impressions: kw.impressions,
          clicks: kw.clicks,
          ctr: kw.ctr,
          cost: kw.cost,
          conversions: kw.conversions,
          revenue: kw.revenue,
          roas: kw.roas,
          cpa: kw.cpa,
          avg_cpc: kw.avg_cpc,
          deltas: kw.deltas,
          recommendation: null,
          isExpanded: false,
          isLoading: false,
          children: [],
          childrenLoaded: false,
          adCreatives: [],
          adCreativesLoaded: false,
        }));

        setTree((prev) =>
          prev.map((cNode) => {
            if (cNode.key !== campaignKey) return cNode;
            return {
              ...cNode,
              children: cNode.children.map((ag) =>
                ag.key === adgroupKey
                  ? {
                      ...ag,
                      children,
                      childrenLoaded: true,
                      isLoading: false,
                      adCreatives: ads,
                      adCreativesLoaded: true,
                    }
                  : ag
              ),
            };
          })
        );
      } catch {
        setTree((prev) =>
          prev.map((cNode) => {
            if (cNode.key !== campaignKey) return cNode;
            return {
              ...cNode,
              children: cNode.children.map((ag) =>
                ag.key === adgroupKey ? { ...ag, isLoading: false } : ag
              ),
            };
          })
        );
      }
    },
    [tree, selectedStoreId, periodDays]
  );

  function handleSort(col: string) {
    if (sortCol === col) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return [...nodes].sort((a, b) => {
      const av = (a as unknown as Record<string, number>)[sortCol] ?? 0;
      const bv = (b as unknown as Record<string, number>)[sortCol] ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }

  const filteredTree = useMemo(() => {
    let result = tree;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const match = c.name.toLowerCase().includes(q);
        const childMatch = c.children.some(
          (ag) => ag.name.toLowerCase().includes(q) || ag.children.some((kw) => kw.name.toLowerCase().includes(q))
        );
        return match || childMatch;
      });
    }
    if (statusFilter !== "all") {
      result = result.filter((c) => {
        if (statusFilter === "excellent") return c.roas >= 300 && c.conversions >= 1;
        if (statusFilter === "danger") return (c.roas < 100 && c.roas > 0) || (c.clicks >= 20 && c.conversions === 0);
        return true;
      });
    }
    return sortNodes(result);
  }, [tree, searchQuery, statusFilter, sortCol, sortDir]);

  // AI 추천 수집
  const allRecommendations = useMemo(() => {
    const recs: { name: string; level: string; rec: AIRecommendation; key: string }[] = [];
    for (const c of tree) {
      if (c.recommendation) {
        recs.push({ name: c.name, level: "캠페인", rec: c.recommendation, key: c.key });
      }
      for (const ag of c.children) {
        if (ag.recommendation) {
          recs.push({ name: `${c.name} > ${ag.name}`, level: "광고그룹", rec: ag.recommendation, key: ag.key });
        }
      }
    }
    // HIGH → MEDIUM → LOW 순서
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    recs.sort((a, b) => (order[a.rec.level as keyof typeof order] ?? 3) - (order[b.rec.level as keyof typeof order] ?? 3));
    return recs;
  }, [tree]);

  const stats = useMemo(() => {
    const total = tree.length;
    const excellent = tree.filter((c) => c.roas >= 300 && c.conversions >= 1).length;
    const danger = tree.filter((c) => (c.roas < 100 && c.roas > 0) || (c.clicks >= 20 && c.conversions === 0)).length;
    return { total, excellent, danger };
  }, [tree]);

  if (!selectedStoreId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">광고주를 선택해주세요.</p>
      </div>
    );
  }

  const COLS = [
    { key: "impressions", label: "노출수", fmt: (v: number) => formatNum(v), deltaKey: null },
    { key: "clicks", label: "클릭수", fmt: (v: number) => formatNum(v), deltaKey: "clicks" },
    { key: "ctr", label: "CTR", fmt: (v: number) => formatPct(v), deltaKey: "ctr" },
    { key: "cost", label: "광고비", fmt: (v: number) => formatKRWShort(v), deltaKey: "cost", inverse: true },
    { key: "conversions", label: "전환수", fmt: (v: number) => `${v}건`, deltaKey: "conversions" },
    { key: "revenue", label: "매출", fmt: (v: number) => formatKRWShort(v), deltaKey: "revenue" },
    { key: "roas", label: "ROAS", fmt: (v: number) => formatPct(v), deltaKey: "roas" },
  ];

  return (
    <div className="p-4 max-w-[1400px] h-[calc(100vh)] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-800">광고 관리</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            캠페인 &gt; 광고그룹 &gt; 키워드 + 소재
          </p>
        </div>
        <DateRangePicker />
      </div>

      {/* AI 추천 패널 - 가볍게 */}
      {allRecommendations.length > 0 && (
        <div className="mb-3 bg-white rounded-lg border border-gray-150 overflow-hidden">
          <button
            onClick={() => setShowRecPanel(!showRecPanel)}
            className="w-full flex items-center justify-between px-3 py-1.5"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-600">
                AI 제안
              </span>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {allRecommendations.length}
              </span>
            </div>
            <span className={`text-gray-300 text-[10px] transition-transform ${showRecPanel ? "rotate-90" : ""}`}>
              {"\u25B6"}
            </span>
          </button>
          {showRecPanel && (
            <div className="px-3 pb-2 space-y-1 max-h-[180px] overflow-y-auto border-t border-gray-100">
              {allRecommendations.slice(0, 10).map((r, i) => {
                const dot = {
                  HIGH: "bg-red-400",
                  MEDIUM: "bg-amber-400",
                  LOW: "bg-blue-400",
                }[r.rec.level] || "bg-gray-400";
                return (
                  <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-50 last:border-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot}`} />
                    <div className="min-w-0">
                      <p className="text-gray-400 text-[10px]">{r.level}: {r.name}</p>
                      <p className="text-gray-600 leading-relaxed">{r.rec.reason}</p>
                      <p className="text-blue-600 mt-0.5">{r.rec.action}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 max-w-xs">
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none placeholder-gray-300"
          />
        </div>
        <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5">
          {([
            { key: "all" as StatusFilter, label: `전체 ${stats.total}` },
            { key: "excellent" as StatusFilter, label: `우수 ${stats.excellent}` },
            { key: "danger" as StatusFilter, label: `위험 ${stats.danger}` },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                statusFilter === f.key
                  ? "bg-white shadow-sm text-gray-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center space-y-2">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-400">로딩 중...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm z-10">
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-500 min-w-[240px]">이름</th>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      className="text-right px-3 py-2 font-medium text-gray-500 cursor-pointer hover:text-blue-500 whitespace-nowrap"
                      onClick={() => handleSort(c.key)}
                    >
                      {c.label} {sortCol === c.key && (sortDir === "desc" ? "\u25BC" : "\u25B2")}
                    </th>
                  ))}
                  <th className="text-center px-2 py-2 font-medium text-gray-500 w-12">AI</th>
                  <th className="text-center px-2 py-2 font-medium text-gray-500 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTree.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length + 3} className="text-center py-8 text-gray-300 text-xs">
                      {searchQuery || statusFilter !== "all" ? "검색 결과가 없습니다" : "캠페인 데이터가 없습니다"}
                    </td>
                  </tr>
                ) : (
                  filteredTree.map((campaign) => (
                    <CampaignRows
                      key={campaign.key}
                      campaign={campaign}
                      cols={COLS}
                      sortNodes={sortNodes}
                      onToggleCampaign={toggleCampaign}
                      onToggleAdgroup={toggleAdgroup}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI 추천 뱃지 ──
function RecBadge({ rec }: { rec: AIRecommendation | null }) {
  const [showTooltip, setShowTooltip] = useState(false);
  if (!rec) return <span className="text-gray-200 text-[10px]">-</span>;

  const dot = {
    HIGH: "bg-red-400",
    MEDIUM: "bg-amber-400",
    LOW: "bg-blue-400",
  }[rec.level] || "bg-gray-400";

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="p-1"
      >
        <span className={`block w-2 h-2 rounded-full ${dot}`} />
      </button>
      {showTooltip && (
        <div className="absolute z-50 bottom-full right-0 mb-1 w-60 bg-gray-800 text-white rounded-lg p-2.5 shadow-lg text-[11px]">
          <p className="text-gray-200 leading-relaxed">{rec.reason}</p>
          <p className="text-blue-300 mt-1">{rec.action}</p>
          <div className="absolute bottom-0 right-3 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800" />
        </div>
      )}
    </div>
  );
}

// ── 캠페인 행 + 자식 ──

function CampaignRows({
  campaign,
  cols,
  sortNodes,
  onToggleCampaign,
  onToggleAdgroup,
}: {
  campaign: TreeNode;
  cols: { key: string; label: string; fmt: (v: number) => string; deltaKey: string | null; inverse?: boolean }[];
  sortNodes: (nodes: TreeNode[]) => TreeNode[];
  onToggleCampaign: (key: string) => void;
  onToggleAdgroup: (campaignKey: string, adgroupKey: string) => void;
}) {
  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer"
        onClick={() => onToggleCampaign(campaign.key)}
      >
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-[10px] w-4 text-center">
              {campaign.isLoading ? (
                <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
              ) : campaign.isExpanded ? "\u25BC" : "\u25B6"}
            </span>
            <span className="font-medium text-gray-800 text-[13px]">{campaign.name}</span>
          </div>
        </td>
        {cols.map((c) => {
          const deltaVal = c.deltaKey && campaign.deltas ? (campaign.deltas as unknown as Record<string, number>)[c.deltaKey] as number : null;
          return (
            <td key={c.key} className="text-right px-3 py-2">
              <div className="text-gray-600 text-xs">{c.fmt((campaign as unknown as Record<string, number>)[c.key] as number)}</div>
              {c.deltaKey && <DeltaIndicator value={deltaVal} inverse={c.inverse} />}
            </td>
          );
        })}
        <td className="text-center px-2 py-2">
          <RecBadge rec={campaign.recommendation} />
        </td>
        <td className="text-center px-2 py-2">
          <StatusBadge roas={campaign.roas} clicks={campaign.clicks} conversions={campaign.conversions} />
        </td>
      </tr>

      {campaign.isExpanded &&
        sortNodes(campaign.children).map((adgroup) => (
          <AdgroupRows
            key={adgroup.key}
            adgroup={adgroup}
            campaignKey={campaign.key}
            cols={cols}
            sortNodes={sortNodes}
            onToggleAdgroup={onToggleAdgroup}
          />
        ))}
    </>
  );
}

function AdgroupRows({
  adgroup,
  campaignKey,
  cols,
  sortNodes,
  onToggleAdgroup,
}: {
  adgroup: TreeNode;
  campaignKey: string;
  cols: { key: string; label: string; fmt: (v: number) => string; deltaKey: string | null; inverse?: boolean }[];
  sortNodes: (nodes: TreeNode[]) => TreeNode[];
  onToggleAdgroup: (campaignKey: string, adgroupKey: string) => void;
}) {
  return (
    <>
      <tr
        className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
        onClick={() => onToggleAdgroup(campaignKey, adgroup.key)}
      >
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-2 pl-6">
            <span className="text-gray-300 text-[10px] w-4 text-center">
              {adgroup.isLoading ? (
                <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
              ) : adgroup.isExpanded ? "\u25BC" : "\u25B6"}
            </span>
            <span className="text-gray-600 text-[12px]">{adgroup.name}</span>
          </div>
        </td>
        {cols.map((c) => {
          const deltaVal = c.deltaKey && adgroup.deltas ? (adgroup.deltas as unknown as Record<string, number>)[c.deltaKey] as number : null;
          return (
            <td key={c.key} className="text-right px-3 py-1.5">
              <div className="text-gray-500 text-[12px]">{c.fmt((adgroup as unknown as Record<string, number>)[c.key] as number)}</div>
              {c.deltaKey && <DeltaIndicator value={deltaVal} inverse={c.inverse} />}
            </td>
          );
        })}
        <td className="text-center px-2 py-1.5">
          <RecBadge rec={adgroup.recommendation} />
        </td>
        <td className="text-center px-2 py-1.5">
          <StatusBadge roas={adgroup.roas} clicks={adgroup.clicks} conversions={adgroup.conversions} />
        </td>
      </tr>

      {adgroup.isExpanded && (
        <>
          {/* 키워드 행 */}
          {sortNodes(adgroup.children).map((keyword) => (
            <tr key={keyword.key} className="border-b border-gray-50 hover:bg-gray-50/30">
              <td className="px-3 py-1">
                <div className="flex items-center gap-1.5 pl-14">
                  <span className="text-gray-200 text-[10px]">{"\u2500"}</span>
                  <span className="text-gray-500 text-[11px]">{keyword.name}</span>
                </div>
              </td>
              {cols.map((c) => {
                const deltaVal = c.deltaKey && keyword.deltas ? (keyword.deltas as unknown as Record<string, number>)[c.deltaKey] as number : null;
                return (
                  <td key={c.key} className="text-right px-3 py-1">
                    <div className="text-gray-400 text-[11px]">{c.fmt((keyword as unknown as Record<string, number>)[c.key] as number)}</div>
                    {c.deltaKey && <DeltaIndicator value={deltaVal} inverse={c.inverse} />}
                  </td>
                );
              })}
              <td className="text-center px-2 py-1">
                <span className="text-gray-200 text-[10px]">-</span>
              </td>
              <td className="text-center px-2 py-1">
                <StatusBadge roas={keyword.roas} clicks={keyword.clicks} conversions={keyword.conversions} />
              </td>
            </tr>
          ))}

          {/* 소재 섹션 */}
          {adgroup.adCreativesLoaded && adgroup.adCreatives.length > 0 && (
            <>
              <tr>
                <td colSpan={cols.length + 3} className="px-3 py-0.5">
                  <div className="flex items-center gap-1 pl-14">
                    <span className="text-[10px] text-gray-400 font-medium">
                      소재 {adgroup.adCreatives.length}
                    </span>
                  </div>
                </td>
              </tr>
              {adgroup.adCreatives.map((ad, i) => {
                const statusInfo = getAdStatus(ad.inspect_status || ad.status);
                const displayName = ad.headline || ad.product_title || "(제목 없음)";
                const adTypeLabel = ad.type === "SHOPPING_PRODUCT_AD" ? "쇼핑" : "텍스트";
                return (
                  <tr key={`ad:${ad.ad_id || i}`} className="border-b border-gray-50 hover:bg-gray-50/30">
                    <td colSpan={cols.length + 1} className="px-3 py-1">
                      <div className="flex items-center gap-1.5 pl-14">
                        <span className="text-gray-200 text-[10px]">{"\u2500"}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-[9px] text-gray-400">{adTypeLabel}</span>
                        <span className="text-gray-600 text-[11px] truncate max-w-[300px]">
                          {displayName}
                        </span>
                        {ad.price && (
                          <span className="text-[10px] text-gray-400">
                            {Number(ad.price).toLocaleString()}원
                          </span>
                        )}
                        {ad.review_count && Number(ad.review_count) > 0 && (
                          <span className="text-[10px] text-gray-300">
                            리뷰 {ad.review_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center px-2 py-1">
                      {ad.inspect_status === "REJECTED" && (
                        <span className="text-[9px] text-red-400">거부</span>
                      )}
                    </td>
                    <td />
                  </tr>
                );
              })}
            </>
          )}
        </>
      )}
    </>
  );
}

