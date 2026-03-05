const BASE = "/api/v1";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "요청 실패");
  }
  return res.json();
}

export const api = {
  // 스토어
  getStores: (linkedOnly?: boolean) => {
    const params = new URLSearchParams();
    if (linkedOnly) params.set("linked_only", "true");
    const qs = params.toString();
    return request<Store[]>(`/stores${qs ? `?${qs}` : ""}`);
  },
  createStore: (data: { name: string; description?: string; customer_id?: string }) =>
    request<Store>("/stores", { method: "POST", body: JSON.stringify(data) }),
  linkCustomerStore: (data: { name: string; customer_id: string }) =>
    request<Store>("/stores/link-customer", { method: "POST", body: JSON.stringify(data) }),
  deleteStore: (id: number) =>
    request<void>(`/stores/${id}`, { method: "DELETE" }),

  // 대시보드
  getDashboardSummary: (storeId: number, date?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (date) params.set("date", date);
    return request<KpiSummary>(`/dashboard/summary?${params}`);
  },
  getDashboardTrend: (storeId: number, days = 7) => {
    const params = new URLSearchParams({
      store_id: String(storeId),
      days: String(days),
    });
    return request<TrendPoint[]>(`/dashboard/trend?${params}`);
  },
  getDashboardAlerts: (storeId: number, date?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (date) params.set("date", date);
    return request<ActionItem[]>(`/dashboard/alerts?${params}`);
  },
  getStoreComparison: (days = 7) =>
    request<StoreComparison[]>(`/dashboard/store-comparison?days=${days}`),

  // 광고 성과 (storeId 필수)
  getCampaigns: (storeId: number, start?: string, end?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return request<CampaignPerf[]>(`/performance/campaigns?${params}`);
  },
  getCampaignsWithDelta: (storeId: number, period = 7) => {
    const params = new URLSearchParams({
      store_id: String(storeId),
      period: String(period),
    });
    return request<CampaignPerfWithDelta[]>(
      `/performance/campaigns/with-delta?${params}`
    );
  },
  getAdgroups: (storeId: number, campaign?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (campaign) params.set("campaign", campaign);
    return request<AdgroupPerf[]>(`/performance/adgroups?${params}`);
  },
  getAdgroupsWithDelta: (storeId: number, campaign?: string, period = 7) => {
    const params = new URLSearchParams({
      store_id: String(storeId),
      period: String(period),
    });
    if (campaign) params.set("campaign", campaign);
    return request<AdgroupPerfWithDelta[]>(
      `/performance/adgroups/with-delta?${params}`
    );
  },
  getKeywords: (storeId: number, adgroup?: string) => {
    const params = new URLSearchParams({ store_id: String(storeId) });
    if (adgroup) params.set("adgroup", adgroup);
    return request<KeywordPerf[]>(`/performance/keywords?${params}`);
  },
  getKeywordsWithDelta: (storeId: number, campaign?: string, adgroup?: string, period = 7) => {
    const params = new URLSearchParams({
      store_id: String(storeId),
      period: String(period),
    });
    if (campaign) params.set("campaign", campaign);
    if (adgroup) params.set("adgroup", adgroup);
    return request<KeywordPerfWithDelta[]>(
      `/performance/keywords/with-delta?${params}`
    );
  },

  // 광고그룹 소재 조회
  getAdgroupAds: (storeId: number, adgroupId: string) =>
    request<AdCreativeForList[]>(
      `/performance/adgroup-ads?store_id=${storeId}&adgroup_id=${encodeURIComponent(adgroupId)}`
    ),

  // 설정
  getThresholds: () => request<ThresholdSettings>("/settings/thresholds"),
  updateThresholds: (data: ThresholdSettings) =>
    request<ThresholdSettings>("/settings/thresholds", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // 네이버 API
  getNaverCredentials: () => request<NaverCredentialsOut>("/naver/credentials"),
  saveNaverCredentials: (data: NaverCredentials) =>
    request<{ success: boolean; message: string }>("/naver/credentials", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteNaverCredentials: () =>
    request<{ success: boolean }>("/naver/credentials", { method: "DELETE" }),
  testNaverConnection: () =>
    request<NaverConnectionTest>("/naver/test-connection", { method: "POST" }),
  getNaverCustomers: () => request<NaverCustomer[]>("/naver/customers"),
  getNaverAccountOverview: (customerId: string) =>
    request<NaverAccountOverview>(`/naver/accounts/${customerId}/overview`),
  // syncNaverData 제거됨 — 실시간 API 사용

  // 전체 종합
  getBizMoney: (storeId: number) =>
    request<BizMoneyBalance>(`/all-in-one/bizmoney?store_id=${storeId}`),
  getQualityIndex: (storeId: number) =>
    request<QualityIndexSummary>(`/all-in-one/quality-index?store_id=${storeId}`),
  getAdCreatives: (storeId: number) =>
    request<AdCreativesSummary>(`/all-in-one/ad-creatives?store_id=${storeId}`),
  getAdExtensions: (storeId: number) =>
    request<AdExtensionsSummary>(`/all-in-one/ad-extensions?store_id=${storeId}`),
  getKeywordTool: (storeId: number, keywords: string[]) =>
    request<KeywordToolResult[]>(`/all-in-one/keyword-tool?store_id=${storeId}`, {
      method: "POST",
      body: JSON.stringify({ keywords }),
    }),
  getBidSimulation: (storeId: number, req: BidSimRequest) =>
    request<Record<string, unknown>>(`/all-in-one/bid-simulation?store_id=${storeId}`, {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // AI 채팅
  getAiApiKeyStatus: () => request<AiApiKeyStatus>("/ai/api-key-status"),
  saveAiApiKey: (apiKey: string) =>
    request<{ success: boolean; message: string }>("/ai/api-key", {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),
  deleteAiApiKey: () =>
    request<{ success: boolean }>("/ai/api-key", { method: "DELETE" }),
  chatWithAi: (messages: ChatMessage[], context?: string) =>
    request<{ reply: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ messages, context }),
    }),
};

// ── 타입 정의 ──

export interface Store {
  id: number;
  name: string;
  description: string | null;
  customer_id: string | null;
  created_at: string;
}

export interface KpiSummary {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  ctr: number;
  roas: number;
  cpa: number;
  avg_cpc: number;
  aov: number;
  deltas: {
    revenue: number | null;
    cost: number | null;
    roas: number | null;
    conversions: number | null;
    clicks: number | null;
    ctr: number | null;
  } | null;
}

export interface TrendPoint {
  date: string;
  cost: number;
  revenue: number;
  conversions: number;
  clicks: number;
  impressions: number;
  roas: number;
}

export interface ActionItem {
  id: number;
  store_id: number;
  date: string;
  priority: number;
  level: string;
  campaign: string | null;
  adgroup: string | null;
  keyword: string | null;
  reason: string;
  action: string;
  status: string;
  created_at: string;
}

export interface PerformanceDeltas {
  cost: number | null;
  clicks: number | null;
  ctr: number | null;
  roas: number | null;
  conversions: number | null;
  revenue: number | null;
}

export interface CampaignPerf {
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  revenue: number;
  ctr: number;
  roas: number;
  cpa: number;
  avg_cpc: number;
}

export interface AIRecommendation {
  level: string;
  reason: string;
  action: string;
}

export interface CampaignPerfWithDelta extends CampaignPerf {
  deltas: PerformanceDeltas | null;
  recommendation: AIRecommendation | null;
}

export interface AdgroupPerf extends CampaignPerf {
  adgroup_name: string;
  adgroup_id: string;
}

export interface AdgroupPerfWithDelta extends AdgroupPerf {
  deltas: PerformanceDeltas | null;
  recommendation: AIRecommendation | null;
}

export interface AdCreativeForList {
  ad_id: string;
  type: string;
  status: string;
  inspect_status: string;
  headline: string;
  description: string;
  pc_channel_id: string;
  mobile_channel_id: string;
  product_title: string;
  price: string;
  image_url: string;
  mall_name: string;
  review_count: string;
  purchase_count: string;
  category: string;
}

export interface KeywordPerf extends AdgroupPerf {
  keyword: string;
}

export interface KeywordPerfWithDelta extends KeywordPerf {
  deltas: PerformanceDeltas | null;
}

export interface StoreComparison {
  store_id: number;
  store_name: string;
  cost: number;
  revenue: number;
  conversions: number;
  roas: number;
}

export interface ThresholdSettings {
  min_clicks_for_pause: number;
  low_ctr_threshold: number;
  low_roas_threshold: number;
  high_roas_threshold: number;
  high_cpc_threshold: number;
}

// 네이버 API 타입
export interface NaverCredentials {
  api_key: string;
  secret_key: string;
  customer_id: string;
}

export interface NaverCredentialsOut {
  api_key_masked: string;
  customer_id: string;
  is_configured: boolean;
}

export interface NaverConnectionTest {
  success: boolean;
  client_count: number;
  campaigns_count?: number;
  error: string | null;
}

export interface NaverCustomer {
  customer_id: string;
  name: string;
  login_id: string;
}

export interface NaverCampaignInfo {
  campaign_id: string;
  name: string;
  campaign_type: string;
  status: string;
  budget: number;
}

export interface NaverAdgroupInfo {
  adgroup_id: string;
  campaign_id: string;
  name: string;
  status: string;
  bid_amount: number;
}

export interface NaverAccountOverview {
  customer_id: string;
  customer_name: string;
  campaigns: NaverCampaignInfo[];
  adgroups: NaverAdgroupInfo[];
  keywords_count: number;
}

// 전체 종합 타입
export interface BizMoneyBalance {
  bizmoney: number;
  budget_lock: number;
  refund: number;
}

export interface QualityIndexDistribution {
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface QualityIndexDetail {
  keyword_id: string;
  keyword: string;
  quality_index: number;
  adgroup_id: string;
  adgroup_name: string;
  campaign_name: string;
}

export interface QualityIndexSummary {
  distribution: QualityIndexDistribution;
  details: QualityIndexDetail[];
}

export interface AdCreativeItem {
  ad_id: string;
  adgroup_name: string;
  campaign_name: string;
  type: string;
  status: string;
  inspect_status: string;
  headline: string;
  description: string;
}

export interface AdCreativesSummary {
  total: number;
  status_counts: Record<string, number>;
  recent_ads: AdCreativeItem[];
}

export interface AdExtensionsSummary {
  total: number;
  by_type: Record<string, number>;
}

export interface KeywordToolResult {
  keyword: string;
  monthly_pc_qc_cnt: number;
  monthly_mobile_qc_cnt: number;
  comp_idx: string;
  pl_avg_depth: number;
}

export interface BidSimRequest {
  keyword_id: string;
  bid: number;
  device?: string;
}

// AI 채팅 타입
export interface AiApiKeyStatus {
  is_configured: boolean;
  masked_key: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
