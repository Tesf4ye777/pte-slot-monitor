import { describe, expect, it } from "vitest";
import { clampFloatingPosition } from "../src/content/floating-window";

describe("floating window positioning", () => {
  it("keeps the window inside a desktop viewport", () => {
    expect(clampFloatingPosition(-100, -50, 1440, 900)).toEqual({ x: 12, y: 12 });
    expect(clampFloatingPosition(2000, 1200, 1440, 900)).toEqual({ x: 1014, y: 848 });
  });

  it("keeps the drag handle reachable on a narrow viewport", () => {
    expect(clampFloatingPosition(300, 900, 390, 700)).toEqual({ x: 12, y: 648 });
  });
});
