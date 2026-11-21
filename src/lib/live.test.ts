import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING, elimPoints, placementPoints, progress, waysToReach } from "./live";

describe("placement and elim points", () => {
  it("a win is worth 60, 2nd 50 and 4th 40", () => {
    expect(placementPoints(DEFAULT_SCORING, 1)).toBe(60);
    expect(placementPoints(DEFAULT_SCORING, 2)).toBe(50);
    expect(placementPoints(DEFAULT_SCORING, 4)).toBe(40);
  });

  it("outside the top 15 gives no placement points", () => {
    expect(placementPoints(DEFAULT_SCORING, 16)).toBe(0);
  });

  it("elims stop counting after the last elim tier", () => {
    expect(elimPoints(DEFAULT_SCORING, 3)).toBe(6);
    expect(elimPoints(DEFAULT_SCORING, 14)).toBe(20);
  });
});

describe("progress toward the target", () => {
  it("180 missing over 6 remaining matches = 30 per match", () => {
    const p = progress({ target: 300, current: 120, matchesPlayed: 4, matchCap: 10, scoring: DEFAULT_SCORING });
    expect(p.missing).toBe(180);
    expect(p.matchesLeft).toBe(6);
    expect(p.perMatch).toBe(30);
    expect(p.possible).toBe(true);
  });

  it("is reached once current points pass the target", () => {
    const p = progress({ target: 300, current: 310, matchesPlayed: 9, matchCap: 10, scoring: DEFAULT_SCORING });
    expect(p.missing).toBe(0);
    expect(p.reached).toBe(true);
  });

  it("is impossible when more than a max-elim win is needed every match", () => {
    const p = progress({ target: 300, current: 0, matchesPlayed: 7, matchCap: 10, scoring: DEFAULT_SCORING });
    expect(p.possible).toBe(false);
  });
});

describe("ways to reach 45 points in a match", () => {
  const ways = waysToReach(DEFAULT_SCORING, 45);
  const kills = (place: number | null) => ways.find((w) => w.place === place)?.kills;

  it("a win or 2nd place is enough on its own", () => {
    expect(kills(1)).toBe(0);
    expect(kills(2)).toBe(0);
  });

  it("4th place needs 3 more elims", () => {
    expect(kills(4)).toBe(3);
  });

  it("10th place cannot reach it even with max elims", () => {
    expect(kills(10)).toBeNull();
  });
});
