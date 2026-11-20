import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTrackerDate, parseTrackerEvents } from "./tracker-parse";

const fixture = readFileSync(path.join(__dirname, "__fixtures__/tracker-events.md"), "utf8");

describe("parseTrackerEvents", () => {
  const events = parseTrackerEvents(fixture);

  it("reads every event row", () => {
    expect(events).toHaveLength(4);
  });

  it("reads placement, elims, matches and date of the first event", () => {
    const first = events[0]!;
    expect(first.name).toBe("Street Fighter Cup Reload · Session 1");
    expect(first.eventDate).toBe("2026-10-10");
    expect(first.placement).toBe(7324);
    expect(first.elims).toBe(72);
    expect(first.matches).toBe(12);
    expect(first.wins).toBe(0);
    expect(first.mode).toBe("duo");
  });

  it("keeps escaped brackets in names", () => {
    expect(events[1]!.name).toBe("[NAC] Duos Ranked Cup (Battle Royale) · Event 4");
  });

  it("gives each event a stable id without the leaderboard page", () => {
    expect(events[0]!.sourceEventId).not.toContain("page=");
    expect(new Set(events.map((e) => e.sourceEventId)).size).toBe(4);
  });

  it("returns nothing for a page without the events table", () => {
    expect(parseTrackerEvents("# Player not found")).toEqual([]);
  });
});

describe("parseTrackerDate", () => {
  it("turns 'Sep 21, 2026' into an ISO date", () => {
    expect(parseTrackerDate("Sep 21, 2026")).toBe("2026-09-21");
  });
});
