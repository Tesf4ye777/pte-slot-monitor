import {
  DEFAULT_CONFIG,
  MAX_REFRESH_INTERVAL_MINUTES,
  MIN_REFRESH_INTERVAL_MINUTES
} from "./constants";

export function clampRefreshInterval(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONFIG.refreshIntervalMinutes;
  return Math.min(
    MAX_REFRESH_INTERVAL_MINUTES,
    Math.max(MIN_REFRESH_INTERVAL_MINUTES, Math.round(value))
  );
}

export function isValidRefreshInterval(value: number): boolean {
  return Number.isInteger(value)
    && value >= MIN_REFRESH_INTERVAL_MINUTES
    && value <= MAX_REFRESH_INTERVAL_MINUTES;
}

export function isValidDateRange(from: string, to: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(from)
    && /^\d{4}-\d{2}-\d{2}$/.test(to)
    && from <= to;
}
