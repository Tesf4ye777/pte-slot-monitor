import { describe, expect, it } from "vitest";
import { countdownTo, relativeTime } from "../src/shared/time-display";
import {
  clampRefreshInterval,
  isValidDateRange,
  isValidRefreshInterval
} from "../src/shared/monitor-config";

describe("popup time display", () => {
  const now = new Date("2026-10-11T00:00:00.000Z").getTime();

  it("shows a second-by-second countdown", () => {
    expect(countdownTo("2026-10-11T00:01:00.000Z", now)).toBe("01:00");
    expect(countdownTo("2026-10-11T00:01:00.000Z", now + 1_000)).toBe("00:59");
  });

  it("never shows a negative countdown", () => {
    expect(countdownTo("2026-10-10T23:59:00.000Z", now)).toBe("00:00");
  });

  it("shows elapsed time for the previous refresh", () => {
    expect(relativeTime("2026-10-10T23:59:15.000Z", now)).toBe("45s ago");
    expect(relativeTime("2026-10-10T23:59:15.000Z", now, "zh-CN")).toBe("45秒前");
  });
});

describe("refresh interval guardrails", () => {
  it("enforces the configured minimum and maximum", () => {
    expect(clampRefreshInterval(0)).toBe(1);
    expect(clampRefreshInterval(1)).toBe(1);
    expect(clampRefreshInterval(60)).toBe(60);
    expect(clampRefreshInterval(999)).toBe(180);
  });

  it("uses the conservative default for invalid input", () => {
    expect(clampRefreshInterval(Number.NaN)).toBe(10);
  });

  it("validates interval input before saving", () => {
    expect(isValidRefreshInterval(1)).toBe(true);
    expect(isValidRefreshInterval(180)).toBe(true);
    expect(isValidRefreshInterval(0)).toBe(false);
    expect(isValidRefreshInterval(181)).toBe(false);
    expect(isValidRefreshInterval(1.5)).toBe(false);
  });

  it("validates the selected date range", () => {
    expect(isValidDateRange("2026-10-11", "2026-10-13")).toBe(true);
    expect(isValidDateRange("2026-10-13", "2026-10-11")).toBe(false);
    expect(isValidDateRange("", "2026-10-13")).toBe(false);
  });
});
