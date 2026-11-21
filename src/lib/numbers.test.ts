import { describe, expect, it } from "vitest";
import { toWhole, toWholeOrNull } from "./numbers";

describe("rounding down before saving", () => {
  it("rounds 45.5 down to 45", () => {
    expect(toWhole(45.5)).toBe(45);
  });

  it("rounds 9.6 down to 9", () => {
    expect(toWhole(9.6)).toBe(9);
  });

  it("keeps whole numbers as they are", () => {
    expect(toWhole(12)).toBe(12);
  });

  it("keeps an empty optional value empty", () => {
    expect(toWholeOrNull(null)).toBeNull();
    expect(toWholeOrNull(7.9)).toBe(7);
  });
});
