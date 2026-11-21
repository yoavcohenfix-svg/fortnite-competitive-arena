import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { placementPoints } from "./live";
import { nextStart, parseEventsList, parseLiveLeaderboard, parseWindowStarts, eventIdFromInput } from "./live-parse";

const fixture = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

describe("parseLiveLeaderboard", () => {
  const snap = parseLiveLeaderboard(fixture("live-leaderboard.html"))!;

  it("finds the searched player's points, rank and matches", () => {
    expect(snap.found).toBe(true);
    expect(snap.rank).toBe(2235);
    expect(snap.points).toBe(9);
    expect(snap.matchesPlayed).toBe(1);
  });

  it("reads the match cap and event name", () => {
    expect(snap.matchCap).toBe(12);
    expect(snap.eventName).toBe("Duos Reload Ranked Cup (Battle Royale)");
  });

  it("uses the scoring of the player's division", () => {
    expect(snap.leaderboardId).toBe("RankedCup_DuosReload_Unreal_LeaderboardDef");
    expect(snap.scoring).not.toBeNull();
    expect(placementPoints(snap.scoring!, 1)).toBeGreaterThan(0);
  });

  it("returns nothing for a page without event data", () => {
    expect(parseLiveLeaderboard("<html></html>")).toBeNull();
  });
});

describe("parseEventsList", () => {
  const list = parseEventsList(fixture("events-list.md"));

  it("reads the live events", () => {
    expect(list.live).toEqual([
      { eventId: "epicgames_S43_FNCSSoloReload_Final_ME", name: "FNCS Solos Reload Finals" },
    ]);
  });

  it("reads upcoming events soonest first, without ended ones", () => {
    expect(list.upcoming[0]).toEqual({ eventId: "epicgames_S43_TriosCashCup_ME", name: "Trios Cash Cup Battle Royale" });
    expect(list.upcoming.length).toBe(9);
    expect(list.upcoming.some((e) => e.eventId.includes("Widowmaker"))).toBe(false);
  });
});

describe("session start times", () => {
  const html =
    '<html><body><div><time datetime="2026-11-23T15:00:00.000+00:00"><span>11/24/2026</span></time><time datetime="2026-11-25T15:00:00.000+00:00"></time></div></body></html>';

  it("picks the first session that has not started yet", () => {
    const starts = parseWindowStarts(html);
    expect(nextStart(starts, new Date("2026-11-24T00:00:00Z"))).toBe("2026-11-25T15:00:00.000Z");
  });
});

describe("eventIdFromInput", () => {
  it("reads a bare event id", () => {
    expect(eventIdFromInput("epicgames_S43_TriosCashCup_ME")).toBe("epicgames_S43_TriosCashCup_ME");
  });

  it("reads an event id out of a full leaderboard URL", () => {
    expect(
      eventIdFromInput("https://fortnitetracker.com/events/epicgames_S42_RankedCupReloadDuos_NAC?page=9#912"),
    ).toBe("epicgames_S42_RankedCupReloadDuos_NAC");
  });

  it("returns null when there is no event id", () => {
    expect(eventIdFromInput("Duos Cash Cup")).toBeNull();
  });
});
