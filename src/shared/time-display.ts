export function countdownTo(value: string | undefined, nowMs: number): string {
  if (!value) return "--:--";
  const targetMs = new Date(value).getTime();
  if (!Number.isFinite(targetMs)) return "--:--";
  const totalSeconds = Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function relativeTime(
  value: string | undefined,
  nowMs: number,
  locale: "en" | "zh-CN" = "en"
): string {
  if (!value) return locale === "zh-CN" ? "从未" : "Never";
  const valueMs = new Date(value).getTime();
  if (!Number.isFinite(valueMs)) return locale === "zh-CN" ? "从未" : "Never";
  const seconds = Math.max(0, Math.floor((nowMs - valueMs) / 1000));
  if (seconds < 10) return locale === "zh-CN" ? "刚刚" : "Just now";
  if (seconds < 60) return locale === "zh-CN" ? `${seconds}秒前` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === "zh-CN" ? `${minutes}分钟前` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return locale === "zh-CN" ? `${hours}小时前` : `${hours}h ago`;
}
