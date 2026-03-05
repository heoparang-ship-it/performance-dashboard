"""네이버 검색광고 API 클라이언트."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict, List, Optional

import requests

BASE_URL = "https://api.searchad.naver.com"


class NaverAdsClient:
    """네이버 검색광고 API 클라이언트.

    대행사/담당자 계정에서 여러 광고주를 관리할 수 있도록 설계.
    """

    def __init__(self, api_key: str, secret_key: str, customer_id: str):
        self.api_key = api_key
        self.secret_key = secret_key
        self.customer_id = customer_id  # 담당자 본인의 customer_id

    def _generate_signature(self, timestamp: str, method: str, uri: str) -> str:
        """HMAC-SHA256 서명 생성."""
        sign = f"{timestamp}.{method}.{uri}"
        signature = hmac.new(
            self.secret_key.encode("utf-8"),
            sign.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(signature).decode("utf-8")

    def _headers(self, method: str, uri: str, customer_id: str | None = None) -> Dict[str, str]:
        """API 요청 헤더 생성."""
        timestamp = str(round(time.time() * 1000))
        return {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Timestamp": timestamp,
            "X-API-KEY": self.api_key,
            "X-Customer": customer_id or self.customer_id,
            "X-Signature": self._generate_signature(timestamp, method, uri),
        }

    def _get(self, uri: str, params: dict | None = None, customer_id: str | None = None) -> Any:
        """GET 요청."""
        headers = self._headers("GET", uri, customer_id)
        resp = requests.get(BASE_URL + uri, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def _post(self, uri: str, data: Any = None, customer_id: str | None = None) -> Any:
        """POST 요청."""
        headers = self._headers("POST", uri, customer_id)
        resp = requests.post(BASE_URL + uri, json=data, headers=headers, timeout=30)
        resp.raise_for_status()
        return resp.json()

    # ── 연결 테스트 ──

    def test_connection(self) -> Dict[str, Any]:
        """API 연결 테스트. 자기 계정의 캠페인 조회로 확인."""
        try:
            # /customer-links는 2025년 8월 폐지됨
            # 자기 계정의 캠페인 조회로 연결 확인
            campaigns = self._get("/ncc/campaigns")
            # 매니저 계정 정보도 확인
            try:
                managers = self._get("/manager-accounts")
                client_count = 0
                if isinstance(managers, dict) and "content" in managers:
                    for mgr in managers["content"]:
                        mgr_no = mgr.get("managerAccountNo")
                        if mgr_no:
                            try:
                                children = self._get(
                                    f"/manager-accounts/{mgr_no}/child-ad-accounts",
                                    params={"page": 0, "size": 100},
                                )
                                if isinstance(children, dict):
                                    client_count += children.get("totalElements", 0)
                            except Exception:
                                pass
                elif isinstance(managers, list):
                    for mgr in managers:
                        mgr_no = mgr.get("managerAccountNo")
                        if mgr_no:
                            try:
                                children = self._get(
                                    f"/manager-accounts/{mgr_no}/child-ad-accounts",
                                    params={"page": 0, "size": 100},
                                )
                                if isinstance(children, dict):
                                    client_count += children.get("totalElements", 0)
                            except Exception:
                                pass
                return {
                    "success": True,
                    "client_count": client_count,
                    "campaigns_count": len(campaigns) if isinstance(campaigns, list) else 0,
                }
            except Exception:
                # 매니저 계정이 아닌 일반 광고주 계정
                return {
                    "success": True,
                    "client_count": 0,
                    "campaigns_count": len(campaigns) if isinstance(campaigns, list) else 0,
                }
        except requests.exceptions.HTTPError as e:
            return {"success": False, "error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── 광고주 관리 ──

    def get_managed_customers(self) -> List[Dict[str, Any]]:
        """담당 중인 광고주 목록 조회.

        2025년 8월 이후 새 API 사용:
        1. GET /manager-accounts → managerAccountNo 목록
        2. GET /manager-accounts/{no}/child-ad-accounts → 광고주 목록
        """
        all_customers = []

        try:
            managers = self._get("/manager-accounts")
            manager_list = []
            if isinstance(managers, dict) and "content" in managers:
                manager_list = managers["content"]
            elif isinstance(managers, list):
                manager_list = managers

            for mgr in manager_list:
                mgr_no = mgr.get("managerAccountNo")
                if not mgr_no:
                    continue

                # 페이지네이션으로 모든 하위 광고주 조회
                page = 0
                while True:
                    children = self._get(
                        f"/manager-accounts/{mgr_no}/child-ad-accounts",
                        params={"page": page, "size": 100},
                    )
                    if isinstance(children, dict):
                        content = children.get("content", [])
                        for child in content:
                            child["_managerAccountNo"] = mgr_no
                        all_customers.extend(content)
                        total_pages = children.get("totalPages", 1)
                        if page + 1 >= total_pages:
                            break
                        page += 1
                    else:
                        break
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                # 매니저 계정이 아님 → 자기 자신만 반환
                return [{
                    "masterCustomerId": self.customer_id,
                    "customerName": "",
                    "loginId": "",
                }]
            raise

        return all_customers

    # ── 캠페인 ──

    def get_campaigns(self, customer_id: str) -> List[Dict[str, Any]]:
        """광고주의 캠페인 목록."""
        return self._get("/ncc/campaigns", customer_id=customer_id)

    # ── 광고그룹 ──

    def get_adgroups(self, customer_id: str, campaign_id: str | None = None) -> List[Dict[str, Any]]:
        """광고그룹 목록."""
        params = {}
        if campaign_id:
            params["nccCampaignId"] = campaign_id
        return self._get("/ncc/adgroups", params=params or None, customer_id=customer_id)

    # ── 키워드 ──

    def get_keywords(self, customer_id: str, adgroup_id: str) -> List[Dict[str, Any]]:
        """광고그룹의 키워드 목록."""
        return self._get(
            "/ncc/keywords",
            params={"nccAdgroupId": adgroup_id},
            customer_id=customer_id,
        )

    # ── 광고 소재 ──

    def get_ads(self, customer_id: str, adgroup_id: str) -> List[Dict[str, Any]]:
        """광고그룹의 광고 소재 목록."""
        return self._get(
            "/ncc/ads",
            params={"nccAdgroupId": adgroup_id},
            customer_id=customer_id,
        )

    # ── 확장소재 ──

    def get_ad_extensions(self, customer_id: str, adgroup_id: str | None = None) -> List[Dict[str, Any]]:
        """확장소재 목록."""
        params = {}
        if adgroup_id:
            params["ownerId"] = adgroup_id
        return self._get("/ncc/ad-extensions", params=params or None, customer_id=customer_id)

    # ── 품질지수 ──

    def get_quality_index(self, customer_id: str, adgroup_id: str) -> List[Dict[str, Any]]:
        """광고그룹의 키워드별 품질지수."""
        return self._get(
            "/ncc/qi",
            params={"nccAdgroupId": adgroup_id},
            customer_id=customer_id,
        )

    # ── 키워드 도구 ──

    def get_keyword_tool(self, customer_id: str, keywords: List[str], site_id: str | None = None) -> Any:
        """키워드 도구 - 검색량, 경쟁도, 추천입찰가."""
        data = {
            "hintKeywords": keywords,
            "showDetail": "1",
        }
        if site_id:
            data["siteId"] = site_id
        return self._post("/keywordstool", data=data, customer_id=customer_id)

    # ── 입찰 시뮬레이션 ──

    def get_bid_simulation(self, customer_id: str, keyword_id: str, bid: int, device: str = "PC") -> Dict[str, Any]:
        """입찰 시뮬레이션."""
        data = {
            "device": device,
            "keywordplus": False,
            "key": keyword_id,
            "bid": bid,
        }
        return self._post("/estimate/performance", data=data, customer_id=customer_id)

    # ── 비즈머니 ──

    def get_bizmoney(self, customer_id: str) -> Dict[str, Any]:
        """비즈머니 잔액 조회."""
        return self._get("/ncc/bizmoney", customer_id=customer_id)

    # ── 통계 ──

    def get_stats(
        self,
        customer_id: str,
        ids: List[str],
        start_date: str,
        end_date: str,
        fields: List[str] | None = None,
        time_increment: str = "allTime",
    ) -> List[Dict[str, Any]]:
        """성과 통계 조회.

        time_increment: "allTime" | "daily"
        ids: 동일 유형(캠페인/광고그룹/키워드)의 ID 목록
        최대 92일(3개월) 범위
        """
        if fields is None:
            fields = ["impCnt", "clkCnt", "salesAmt", "ctr", "cpc", "ccnt", "convAmt", "ror", "cpConv"]

        params = {
            "ids": ids,
            "fields": json.dumps(fields),
            "timeRange": json.dumps({"since": start_date, "until": end_date}),
        }
        if time_increment != "allTime":
            params["timeIncrement"] = time_increment

        return self._get("/stats", params=params, customer_id=customer_id)

    def get_stats_daily(
        self,
        customer_id: str,
        ids: List[str],
        start_date: str,
        end_date: str,
    ) -> List[Dict[str, Any]]:
        """일별 통계 조회."""
        return self.get_stats(
            customer_id=customer_id,
            ids=ids,
            start_date=start_date,
            end_date=end_date,
            time_increment="daily",
        )

    # ── 전체 동기화 (캠페인 + 광고그룹 레벨 일별 통계) ──

    def sync_all_data(
        self,
        customer_id: str,
        start_date: str,
        end_date: str,
    ) -> Dict[str, Any]:
        """광고주의 전체 데이터를 수집.

        광고그룹 레벨 일별 통계를 수집합니다.
        날짜별로 전체 광고그룹 통계를 한 번에 조회 (API가 100+ ID 지원).
        until이 exclusive이므로 since=날짜, until=다음날로 호출.
        """
        import datetime as dt

        # 1. 캠페인 목록
        campaigns = self.get_campaigns(customer_id)

        # 2. 광고그룹 목록 (전체)
        adgroups = self.get_adgroups(customer_id)

        # 캠페인 이름 맵
        campaign_map = {}
        for c in campaigns:
            campaign_map[c.get("nccCampaignId", "")] = c.get("name", "")

        # 광고그룹에 캠페인 이름 추가
        for ag in adgroups:
            ag["_campaign_name"] = campaign_map.get(ag.get("nccCampaignId", ""), "")

        # 3. 일별 광고그룹 통계 수집
        adgroup_ids = [ag["nccAdgroupId"] for ag in adgroups if ag.get("nccAdgroupId")]
        all_stats = []

        sd = dt.date.fromisoformat(start_date)
        ed = dt.date.fromisoformat(end_date)
        current = sd

        while current <= ed:
            next_day = current + dt.timedelta(days=1)
            try:
                stats = self.get_stats(
                    customer_id=customer_id,
                    ids=adgroup_ids,
                    start_date=current.isoformat(),
                    end_date=next_day.isoformat(),
                )
                data = []
                if isinstance(stats, list):
                    data = stats
                elif isinstance(stats, dict) and "data" in stats:
                    data = stats["data"]

                # 각 stat에 날짜 정보 추가
                for item in data:
                    item["_date"] = current.isoformat()
                all_stats.extend(data)
            except Exception:
                pass

            current = next_day

        return {
            "campaigns": campaigns,
            "adgroups": adgroups,
            "keywords": [],
            "stats": all_stats,
            "summary": {
                "campaigns_count": len(campaigns),
                "adgroups_count": len(adgroups),
                "keywords_count": 0,
                "stats_count": len(all_stats),
            },
        }


def _find_campaign_name(campaigns: List[Dict], campaign_id: str | None) -> str:
    """캠페인 ID로 이름 찾기."""
    if not campaign_id:
        return ""
    for c in campaigns:
        if c.get("nccCampaignId") == campaign_id:
            return c.get("name", "")
    return ""
