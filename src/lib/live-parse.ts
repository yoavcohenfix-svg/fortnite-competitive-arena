// Reads Fortnite Tracker event pages (scraped through Firecrawl).
// Event pages embed their data as `var imp_<name> = {...};` script blocks, which is more reliable than the visible text.
import type { Scoring, Tier } from "./live";

export function readJsVar(html: string, name: string): unknown {
  const start = html.search(new RegExp(`var ${name}\\s*=\\s*`));
  if (start < 0) return null;
  const valueStart = html.indexOf("=", start) + 1;
  const end = html.indexOf("</script>", valueStart);
  if (end < 0) return null;
  const raw = html.slice(valueStart, end).trim().replace(/;$/, "");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type RawTier = { keyValue?: number; pointsEarned?: number; multiplicative?: boolean };
type RawRule = { trackedStat?: string; matchRule?: string; rewardTiers?: RawTier[] };
type RawLeaderboard = { id?: string; label?: string; scoringRules?: RawRule[] };
type RawEntry = {
  rank?: number;
  pointsEarned?: number;
  teamAccountIds?: string[];
  eventWindowId?: string;
  sessionStats?: { matches?: number; wins?: number; elims?: number };
};

function tiers(rule: RawRule | undefined): Tier[] {
  return (rule?.rewardTiers ?? [])
    .filter((t) => !t.multiplicative && typeof t.keyValue === "number" && typeof t.pointsEarned === "number")
    .map((t) => ({ key: t.keyValue!, points: t.pointsEarned! }));
}

export function scoringFromRules(rules: RawRule[] | undefined): Scoring | null {
  if (!rules?.length) return null;
  const placement = rules.find((r) => r.trackedStat?.includes("PLACEMENT_STAT_INDEX") && r.matchRule === "lte");
  const elims = rules.find((r) => r.trackedStat?.includes("ELIMS_STAT_INDEX") && r.matchRule === "gte");
  const scoring = { placement: tiers(placement), elims: tiers(elims) };
  return scoring.placement.length || scoring.elims.length ? scoring : null;
}

export type LiveSnapshot = {
  eventId: string;
  eventName: string;
  windowName: string;
  beginTime: string | null;
  endTime: string | null;
  matchCap: number | null;
  /** null when the page has no scoring rules; the app then uses typical cup scoring. */
  scoring: Scoring | null;
  leaderboards: { id: string; label: string }[];
  leaderboardId: string | null;
  found: boolean;
  rank: number | null;
  points: number | null;
  matchesPlayed: number | null;
  wins: number | null;
  elims: number | null;
  updatedAt: string | null;
};

export function parseLiveLeaderboard(html: string): LiveSnapshot | null {
  const window = readJsVar(html, "imp_eventWindow") as {
    eventId?: string;
    name?: string;
    beginTime?: string;
    endTime?: string;
    leaderboards?: RawLeaderboard[];
    template?: { matchCap?: number };
  } | null;
  if (!window?.eventId) return null;
  const board = readJsVar(html, "imp_leaderboard") as { entries?: RawEntry[]; updatedTime?: string } | null;
  const search = readJsVar(html, "imp_search") as { status?: string; accountId?: string; rank?: number } | null;
  const event = readJsVar(html, "imp_event") as { TitleLine1?: string; TitleLine2?: string } | null;

  const accountId = search?.status === "SUCCESS" ? search.accountId : undefined;
  const entry = accountId
    ? (board?.entries ?? []).find((e) => e.teamAccountIds?.includes(accountId))
    : undefined;

  const leaderboards = (window.leaderboards ?? []).map((l) => ({ id: l.id ?? "", label: l.label ?? "" }));
  // The entry's window id ends with its division label, e.g. "..._Event5_ME_1_Unreal".
  const label = entry?.eventWindowId?.split("_").at(-1);
  const board_ =
    (window.leaderboards ?? []).find((l) => label && l.label === label) ?? window.leaderboards?.[0];

  const eventName = [event?.TitleLine1, event?.TitleLine2].filter(Boolean).join(" ").trim();
  return {
    eventId: window.eventId,
    eventName: eventName || window.eventId,
    windowName: window.name ?? "",
    beginTime: window.beginTime ?? null,
    endTime: window.endTime ?? null,
    matchCap: window.template?.matchCap ?? null,
    scoring: scoringFromRules(board_?.scoringRules),
    leaderboards: leaderboards.length > 1 ? leaderboards : [],
    leaderboardId: board_?.id && board_.id !== "window" ? board_.id : null,
    found: Boolean(entry),
    rank: entry?.rank ?? null,
    points: entry?.pointsEarned ?? null,
    matchesPlayed: entry?.sessionStats?.matches ?? null,
    wins: entry?.sessionStats?.wins ?? null,
    elims: entry?.sessionStats?.elims ?? null,
    updatedAt: board?.updatedTime ?? null,
  };
}

export type EventRef = { eventId: string; name: string };

function sectionLinks(section: string): EventRef[] {
  const out: EventRef[] = [];
  const seen = new Set<string>();
  const re = /\[!\[[^\]]*\]\([^)]*\)([\s\S]*?)\]\(https:\/\/fortnitetracker\.com\/events\/(epicgames_[A-Za-z0-9_]+)\)/g;
  for (const m of section.matchAll(re)) {
    const eventId = m[2]!;
    if (seen.has(eventId)) continue;
    seen.add(eventId);
    const parts = m[1]!.split(/\\+\s*\n/).map((p) => p.trim()).filter(Boolean);
    out.push({ eventId, name: parts.at(-1) ?? eventId });
  }
  return out;
}

/** Live and upcoming events from the region's events catalog page (upcoming is ordered soonest first). */
export function parseEventsList(markdown: string): { live: EventRef[]; upcoming: EventRef[] } {
  const at = (re: RegExp) => {
    const m = re.exec(markdown);
    return m ? m.index : -1;
  };
  const live = at(/^Live\d*$/m);
  const upcoming = at(/^Upcoming\d*$/m);
  const ended = at(/^Ended\d*$/m);
  const end = ended >= 0 ? ended : markdown.length;
  return {
    live: live >= 0 ? sectionLinks(markdown.slice(live, upcoming > live ? upcoming : end)) : [],
    upcoming: upcoming >= 0 ? sectionLinks(markdown.slice(upcoming, end)) : [],
  };
}

/** Session start times (ISO, UTC) from the event page's window list. */
export function parseWindowStarts(html: string): string[] {
  return [...html.matchAll(/<time[^>]*datetime="([^"]+)"/g)]
    .map((m) => new Date(m[1]!))
    .filter((d) => !Number.isNaN(d.getTime()))
    .map((d) => d.toISOString());
}

export function nextStart(starts: string[], now: Date): string | null {
  const future = starts.filter((s) => new Date(s).getTime() > now.getTime()).sort();
  return future[0] ?? null;
}
