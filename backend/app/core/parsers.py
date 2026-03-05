"""기존 analyze_naver_ads.py에서 추출한 파서 유틸리티."""

from __future__ import annotations


def normalize_header(name: str) -> str:
    return name.strip().lower().replace(" ", "_")


def parse_float(val: str) -> float:
    if val is None:
        return 0.0
    txt = str(val).strip().replace(",", "")
    if txt.endswith("%"):
        txt = txt[:-1]
        try:
            return float(txt)
        except ValueError:
            return 0.0
    try:
        return float(txt)
    except ValueError:
        return 0.0
