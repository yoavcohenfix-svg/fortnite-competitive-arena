// Live-tournament data from Fortnite Tracker, scraped through the Firecrawl connector.
// Two things are needed: the player's standing inside a running event, and the next sessions of
// this week's events (Middle East / Europe) so the planner can show what is coming up.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  nextStart,
  parseEventsList,
  parseLiveLeaderboard,
  parseWindowStarts,
  type LiveSnapshot,
} from "./live-parse";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firecrawl/v2/scrape";
const EVENTS_URL = "https://fortnitetracker.com/events";

/** Query parameters Fortnite Tracker may use to look a player up inside an event leaderboard. */
const PLAYER_PARAMS = ["player", "search", "q"];

type ScrapeFormat = "markdown" | "rawHtml";

/** Returns the scraped page in the requested format, or null when the scrape failed. */
async function scrape(url: string, format: ScrapeFormat): Promise<string | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
  if (!lovableKey || !firecrawlKey) {
    console.error("Live tracker: missing LOVABLE_API_KEY or FIRECRAWL_API_KEY");
    return null;
  }
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": firecrawlKey,
      },
      body: JSON.stringify({ url, formats: [format], onlyMainContent: false, waitFor: 3000, maxAge: 0 }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Live tracker: scrape failed [${response.status}] ${url}: ${body}`);
      return null;
    }
    const json = (await response.json()) as { data?: { markdown?: string; rawHtml?: string } };
    return (format === "markdown" ? json.data?.markdown : json.data?.rawHtml) ?? "";
  } catch (err) {
    console.error("Live tracker: scrape threw", err);
    return null;
  }
}

export type LiveResult =
  | { ok: true; snapshot: LiveSnapshot }
  | { ok: false; error: "not_found" | "fetch_failed" };

/** The searched player's live standing in a running event. */
export const fetchLiveStanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ eventId: z.string().trim().min(3).max(120), username: z.string().trim().min(2).max(40) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LiveResult> => {
    let fallback: LiveSnapshot | null = null;
    for (const param of PLAYER_PARAMS) {
      const query = `${param}=${encodeURIComponent(data.username)}`;
      const html = await scrape(`${EVENTS_URL}/${encodeURIComponent(data.eventId)}?${query}`, "rawHtml");
      if (html === null) continue;
      const snapshot = parseLiveLeaderboard(html);
      if (!snapshot) continue;
      if (snapshot.found) return { ok: true, snapshot };
      fallback ??= snapshot;
    }
    if (fallback) return { ok: true, snapshot: fallback };
    return { ok: false, error: "fetch_failed" };
  });

export type UpcomingEvent = { eventId: string; name: string; startIso: string | null };

export type UpcomingResult =
  | { ok: true; events: UpcomingEvent[] }
  | { ok: false; error: "fetch_failed" | "no_events" };

/** The next five upcoming events of a region, with the start time of each one's next session. */
export const fetchUpcomingEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ region: z.enum(["ME", "EU"]) }).parse(input))
  .handler(async ({ data }): Promise<UpcomingResult> => {
    const catalog = await scrape(`${EVENTS_URL}?region=${data.region}`, "markdown");
    if (catalog === null) return { ok: false, error: "fetch_failed" };
    const upcoming = parseEventsList(catalog).upcoming.slice(0, 5);
    if (upcoming.length === 0) return { ok: false, error: "no_events" };

    const now = new Date();
    const events = await Promise.all(
      upcoming.map(async (event): Promise<UpcomingEvent> => {
        const html = await scrape(`${EVENTS_URL}/${encodeURIComponent(event.eventId)}`, "rawHtml");
        const starts = html ? parseWindowStarts(html) : [];
        return { eventId: event.eventId, name: event.name, startIso: nextStart(starts, now) };
      }),
    );
    return { ok: true, events };
  });
