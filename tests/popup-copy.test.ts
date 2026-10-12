import { describe, expect, it } from "vitest";
import { COPY } from "../src/popup/copy";

describe("popup bilingual copy", () => {
  it("provides the same fields in English and Chinese", () => {
    expect(Object.keys(COPY["zh-CN"]).sort()).toEqual(Object.keys(COPY.en).sort());
  });

  it("provides Chinese labels for the primary controls", () => {
    expect(COPY["zh-CN"].appTitle).toBe("PTE 考位监控");
    expect(COPY["zh-CN"].autoRefresh).toBe("自动刷新");
    expect(COPY["zh-CN"].scanCurrentPage).toBe("扫描当前页面");
    expect(COPY["zh-CN"].showFloatingWindow).toBe("显示悬浮窗");
  });
});
