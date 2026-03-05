/** 원화 포맷: 1,234,567원 */
export function formatKRW(value: number): string {
  return value.toLocaleString("ko-KR") + "원";
}

/** 축약 원화: 1.2억, 350만 */
export function formatKRWShort(value: number): string {
  if (value >= 100_000_000) return (value / 100_000_000).toFixed(1) + "억";
  if (value >= 10_000) return (value / 10_000).toFixed(0) + "만";
  return value.toLocaleString("ko-KR") + "원";
}

/** 퍼센트 포맷 */
export function formatPct(value: number): string {
  return value.toFixed(1) + "%";
}

/** 숫자에 콤마 */
export function formatNum(value: number): string {
  return value.toLocaleString("ko-KR");
}

/** 증감 델타 문자열 */
export function formatDelta(value: number | null | undefined): string {
  if (value == null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** 증감 색상 클래스 */
export function deltaColor(value: number | null | undefined, inverse = false): string {
  if (value == null) return "text-gray-400";
  const isPositive = inverse ? value < 0 : value > 0;
  const isNegative = inverse ? value > 0 : value < 0;
  if (isPositive) return "text-positive";
  if (isNegative) return "text-negative";
  return "text-gray-400";
}
