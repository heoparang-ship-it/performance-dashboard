"use client";

import { useEffect, useState } from "react";
import {
  api,
  ThresholdSettings,
  NaverCredentials,
  NaverCredentialsOut,
  NaverCustomer,
  NaverAccountOverview,
} from "@/lib/api";
import { useStore } from "@/components/StoreProvider";
import { formatKRW } from "@/lib/format";

const FIELDS: {
  key: keyof ThresholdSettings;
  label: string;
  unit: string;
  step: number;
}[] = [
  {
    key: "min_clicks_for_pause",
    label: "일시중지 최소 클릭수",
    unit: "회",
    step: 1,
  },
  { key: "low_ctr_threshold", label: "낮은 CTR 기준", unit: "%", step: 0.1 },
  {
    key: "low_roas_threshold",
    label: "낮은 ROAS 기준",
    unit: "%",
    step: 10,
  },
  {
    key: "high_roas_threshold",
    label: "우수 ROAS 기준",
    unit: "%",
    step: 10,
  },
  {
    key: "high_cpc_threshold",
    label: "높은 CPC 기준",
    unit: "원",
    step: 100,
  },
];

export default function SettingsPage() {
  const { stores, refreshStores } = useStore();
  const [settings, setSettings] = useState<ThresholdSettings | null>(null);
  const [saved, setSaved] = useState(false);

  // 네이버 API 상태
  const [naverCreds, setNaverCreds] = useState<NaverCredentials>({
    api_key: "",
    secret_key: "",
    customer_id: "",
  });
  const [naverStatus, setNaverStatus] = useState<NaverCredentialsOut | null>(null);
  const [naverSaving, setNaverSaving] = useState(false);
  const [naverMsg, setNaverMsg] = useState("");
  const [connectionTest, setConnectionTest] = useState<{
    testing: boolean;
    result: string;
    success: boolean | null;
  }>({ testing: false, result: "", success: null });

  // 광고주 목록
  const [customers, setCustomers] = useState<NaverCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // 계정 구조 미리보기
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [accountOverview, setAccountOverview] = useState<NaverAccountOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // 광고주 연결 상태
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    api.getThresholds().then(setSettings).catch(() => {});
    api.getNaverCredentials().then(setNaverStatus).catch(() => {});
  }, []);

  // ── 임계값 ──

  const handleSave = async () => {
    if (!settings) return;
    await api.updateThresholds(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = (key: keyof ThresholdSettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: Number(value) });
  };

  // ── 네이버 API ──

  const handleSaveNaver = async () => {
    if (!naverCreds.api_key || !naverCreds.secret_key || !naverCreds.customer_id) {
      setNaverMsg("모든 필드를 입력해주세요.");
      return;
    }
    setNaverSaving(true);
    setNaverMsg("");
    try {
      const res = await api.saveNaverCredentials(naverCreds);
      setNaverMsg(res.message);
      setNaverCreds({ api_key: "", secret_key: "", customer_id: "" });
      const updated = await api.getNaverCredentials();
      setNaverStatus(updated);
    } catch (e: any) {
      setNaverMsg(`오류: ${e.message}`);
    } finally {
      setNaverSaving(false);
    }
  };

  const handleDeleteNaver = async () => {
    if (!confirm("API 인증 정보를 삭제하시겠습니까?")) return;
    await api.deleteNaverCredentials();
    setNaverStatus(null);
    setCustomers([]);
    setAccountOverview(null);
    setNaverMsg("인증 정보가 삭제되었습니다.");
  };

  const handleTestConnection = async () => {
    setConnectionTest({ testing: true, result: "", success: null });
    try {
      const res = await api.testNaverConnection();
      if (res.success) {
        const parts = [];
        if (res.client_count > 0) parts.push(`담당 광고주 ${res.client_count}개`);
        if ((res as any).campaigns_count > 0) parts.push(`캠페인 ${(res as any).campaigns_count}개`);
        setConnectionTest({
          testing: false,
          result: `연결 성공! ${parts.length > 0 ? parts.join(", ") : "API 인증 확인됨"}`,
          success: true,
        });
      } else {
        setConnectionTest({
          testing: false,
          result: `연결 실패: ${res.error}`,
          success: false,
        });
      }
    } catch (e: any) {
      setConnectionTest({
        testing: false,
        result: `오류: ${e.message}`,
        success: false,
      });
    }
  };

  const handleLoadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const list = await api.getNaverCustomers();
      setCustomers(list);
    } catch (e: any) {
      setNaverMsg(`광고주 목록 오류: ${e.message}`);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleLoadOverview = async (customerId: string) => {
    setSelectedCustomer(customerId);
    setLoadingOverview(true);
    setAccountOverview(null);
    try {
      const overview = await api.getNaverAccountOverview(customerId);
      setAccountOverview(overview);
    } catch (e: any) {
      setNaverMsg(`계정 조회 오류: ${e.message}`);
    } finally {
      setLoadingOverview(false);
    }
  };

  // ── 광고주 연결 (자동 스토어 생성) ──

  const handleLinkCustomer = async (customer: NaverCustomer) => {
    setLinking(true);
    setNaverMsg("");
    try {
      await api.linkCustomerStore({
        name: customer.name || customer.login_id || `광고주 ${customer.customer_id}`,
        customer_id: customer.customer_id,
      });
      setNaverMsg(`✅ '${customer.name || customer.customer_id}' 광고주가 연결되었습니다!`);
      await refreshStores();
    } catch (e: any) {
      setNaverMsg(`연결 오류: ${e.message}`);
    } finally {
      setLinking(false);
    }
  };

  const handleDeleteStore = async (id: number) => {
    if (!confirm("이 광고주 연결을 해제하시겠습니까?")) return;
    await api.deleteStore(id);
    refreshStores();
  };

  // 연결된 광고주 ID 목록
  const linkedCustomerIds = stores.map((s) => s.customer_id).filter(Boolean);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">설정</h2>

      {/* 네이버 API 연동 */}
      <section className="mb-8">
        <h3 className="text-sm font-bold text-gray-700 mb-3">
          네이버 검색광고 API 연동
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {/* 현재 상태 */}
          {naverStatus?.is_configured ? (
            <div className="flex items-center justify-between bg-green-50 rounded p-3">
              <div>
                <span className="text-sm font-medium text-green-700">API 연결됨</span>
                <span className="text-xs text-gray-500 ml-2">
                  Key: {naverStatus.api_key_masked} | ID: {naverStatus.customer_id}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={handleTestConnection}
                  disabled={connectionTest.testing}
                >
                  {connectionTest.testing ? "테스트 중..." : "연결 테스트"}
                </button>
                <button
                  className="text-xs text-negative hover:underline"
                  onClick={handleDeleteNaver}
                >
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 rounded p-3">
              <span className="text-sm text-yellow-700">API 미연결 - 아래에서 인증 정보를 입력하세요</span>
            </div>
          )}

          {/* 연결 테스트 결과 */}
          {connectionTest.result && (
            <div className={`text-sm p-2 rounded ${connectionTest.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {connectionTest.result}
            </div>
          )}

          {/* 인증 정보 입력 */}
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              네이버 검색광고 &gt; 도구 &gt; API 사용 관리에서 발급받은 정보를 입력하세요
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                API License (Access Key)
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="API License Key"
                value={naverCreds.api_key}
                onChange={(e) => setNaverCreds({ ...naverCreds, api_key: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Secret Key
              </label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="Secret Key"
                value={naverCreds.secret_key}
                onChange={(e) => setNaverCreds({ ...naverCreds, secret_key: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Customer ID (담당자 본인)
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                placeholder="예: 1234567"
                value={naverCreds.customer_id}
                onChange={(e) => setNaverCreds({ ...naverCreds, customer_id: e.target.value })}
              />
            </div>
            <button
              className="w-full py-2 bg-primary text-white rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
              onClick={handleSaveNaver}
              disabled={naverSaving}
            >
              {naverSaving ? "저장 중..." : "API 인증 정보 저장"}
            </button>
          </div>

          {naverMsg && (
            <p className="text-sm text-blue-600">{naverMsg}</p>
          )}
        </div>
      </section>

      {/* 담당 광고주 연결 */}
      {naverStatus?.is_configured && (
        <section className="mb-8">
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            광고주 연결
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            <p className="text-xs text-gray-500">
              광고주를 선택하면 자동으로 연결되며, 실시간 성과 데이터를 확인할 수 있습니다.
            </p>
            <button
              className="px-4 py-1.5 bg-primary text-white text-sm rounded hover:opacity-80 disabled:opacity-50"
              onClick={handleLoadCustomers}
              disabled={loadingCustomers}
            >
              {loadingCustomers ? "조회 중..." : "광고주 목록 불러오기"}
            </button>

            {customers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  담당 광고주 {customers.length}개
                </p>
                <ul className="space-y-1">
                  {customers.map((c) => {
                    const isLinked = linkedCustomerIds.includes(c.customer_id);
                    return (
                      <li
                        key={c.customer_id}
                        className={`flex items-center justify-between py-2 px-3 rounded border ${
                          isLinked
                            ? "bg-green-50 border-green-200"
                            : selectedCustomer === c.customer_id
                            ? "bg-blue-50 border-blue-200"
                            : "border-gray-100 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => handleLoadOverview(c.customer_id)}
                        >
                          <span className="text-sm font-medium text-gray-800">
                            {c.name || c.login_id || c.customer_id}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            ID: {c.customer_id}
                          </span>
                        </div>
                        {isLinked ? (
                          <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded">
                            ✅ 연결됨
                          </span>
                        ) : (
                          <button
                            className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded font-medium disabled:opacity-50"
                            onClick={() => handleLinkCustomer(c)}
                            disabled={linking}
                          >
                            {linking ? "연결 중..." : "연결"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* 계정 구조 */}
            {loadingOverview && (
              <p className="text-sm text-gray-400">캠페인/광고그룹 조회 중...</p>
            )}
            {accountOverview && (
              <div className="bg-gray-50 rounded p-3 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  계정 구조 ({accountOverview.customer_id})
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white rounded p-2">
                    <div className="text-lg font-bold text-primary">
                      {accountOverview.campaigns.length}
                    </div>
                    <div className="text-xs text-gray-500">캠페인</div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="text-lg font-bold text-primary">
                      {accountOverview.adgroups.length}
                    </div>
                    <div className="text-xs text-gray-500">광고그룹</div>
                  </div>
                  <div className="bg-white rounded p-2">
                    <div className="text-lg font-bold text-primary">
                      {accountOverview.keywords_count}
                    </div>
                    <div className="text-xs text-gray-500">키워드</div>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {accountOverview.campaigns.map((c) => (
                    <div key={c.campaign_id} className="text-xs text-gray-600 flex justify-between bg-white px-2 py-1 rounded">
                      <span>{c.name}</span>
                      <span className={`${c.status === "ELIGIBLE" ? "text-green-600" : "text-gray-400"}`}>
                        {c.status === "ELIGIBLE" ? "활성" : c.status}
                        {c.budget > 0 && ` | 일예산 ${formatKRW(c.budget)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 연결된 광고주 목록 */}
      {stores.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-bold text-gray-700 mb-3">연결된 광고주</h3>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <ul className="space-y-1">
              {stores.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50"
                >
                  <div>
                    <span className="text-sm text-gray-800 font-medium">{s.name}</span>
                    {s.customer_id && (
                      <span className="text-xs text-gray-400 ml-2">ID: {s.customer_id}</span>
                    )}
                  </div>
                  <button
                    className="text-xs text-negative hover:underline"
                    onClick={() => handleDeleteStore(s.id)}
                  >
                    연결 해제
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 임계값 설정 */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-3">
          분석 규칙 임계값
        </h3>
        {settings ? (
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {f.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={f.step}
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm w-32"
                    value={settings[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                  />
                  <span className="text-xs text-gray-500">{f.unit}</span>
                </div>
              </div>
            ))}
            <button
              className="w-full py-2 bg-primary text-white rounded text-sm font-medium hover:opacity-90"
              onClick={handleSave}
            >
              {saved ? "저장 완료!" : "저장"}
            </button>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">로딩 중...</p>
        )}
      </section>
    </div>
  );
}
