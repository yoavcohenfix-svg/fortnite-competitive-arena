import { describe, expect, it } from "vitest";
import { compareWindows, consistencyScore, summarize, type TournamentResult } from "./analysis";

describe("compareWindows", () => {
  it("treats a lower placement as improvement", () => {
    const r = compareWindows([500, 400, 300, 200, 100, 50], false);
    expect(r.previous).toBe(400);
    expect(Math.round(r.recent)).toBe(117);
    expect(r.trend).toBe("up");
  });

  it("treats a higher placement number as a decline", () => {
    expect(compareWindows([50, 60, 300, 400], false).trend).toBe("down");
  });

  it("treats more kills as improvement", () => {
    const r = compareWindows([2, 3, 8, 9], true);
    expect(r.recent).toBe(8.5);
    expect(r.previous).toBe(2.5);
    expect(r.trend).toBe("up");
  });

  it("reports flat for changes under 5%", () => {
    expect(compareWindows([100, 102], false).trend).toBe("flat");
  });

  it("needs at least two events", () => {
    expect(compareWindows([7], true).trend).toBe("none");
  });
});

describe("consistencyScore", () => {
  it("is 100 for identical placements", () => {
    expect(consistencyScore([120, 120, 120])).toBe(100);
  });
  it("drops when placements swing", () => {
    expect(consistencyScore([10, 500])).toBe(4);
  });
  it("is unknown with one event", () => {
    expect(consistencyScore([10])).toBeNull();
  });
});

describe("summarize", () => {
  it("orders by date before comparing", () => {
    const rows: TournamentResult[] = [
      { id: "b", name: "B", event_date: "2026-02-01", mode: "duo", placement: 100, kills: 6, points: 300, matches_played: 6 },
      { id: "a", name: "A", event_date: "2026-01-01", mode: "duo", placement: 400, kills: 2, points: 100, matches_played: 6 },
    ];
    const s = summarize(rows);
    expect(s.placement.trend).toBe("up");
    expect(s.bestPlacement).toBe(100);
    expect(s.killsPerMatch).toBeCloseTo(8 / 12);
  });
});
