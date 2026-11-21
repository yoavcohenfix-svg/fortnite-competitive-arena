import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toWhole, toWholeOrNull } from "./numbers";
import { parseTrackerEvents } from "./tracker-parse";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firecrawl/v2/scrape";

export type ImportResult =
  | { ok: true; found: number; added: number; updated: number }
  | { ok: false; error: "not_found" | "no_events" | "fetch_failed" | "save_failed"; detail?: string };

export const importFromTracker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().trim().min(2).max(40) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const { supabase, userId } = context;
    const username = data.username;

    await supabase.from("profiles").upsert({ id: userId, epic_username: username });

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
    if (!lovableKey || !firecrawlKey) {
      console.error("Tracker import: missing LOVABLE_API_KEY or FIRECRAWL_API_KEY");
      return { ok: false, error: "fetch_failed", detail: "missing credentials" };
    }

    const url = `https://fortnitetracker.com/profile/all/${encodeURIComponent(username)}/events`;
    let markdown = "";
    try {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": firecrawlKey,
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: false,
          waitFor: 3000,
          maxAge: 0,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`Tracker import: scrape failed [${response.status}]: ${body}`);
        return { ok: false, error: "fetch_failed", detail: `status ${response.status}` };
      }
      const json = (await response.json()) as {
        success?: boolean;
        data?: { markdown?: string; metadata?: { statusCode?: number } };
      };
      if (json.data?.metadata?.statusCode === 404) return { ok: false, error: "not_found" };
      markdown = json.data?.markdown ?? "";
    } catch (err) {
      console.error("Tracker import: scrape threw", err);
      return { ok: false, error: "fetch_failed" };
    }

    const events = parseTrackerEvents(markdown);
    if (events.length === 0) return { ok: false, error: "no_events" };

    const ids = events.map((e) => e.sourceEventId);
    const { data: existing } = await supabase
      .from("tournaments")
      .select("source_event_id")
      .in("source_event_id", ids);
    const existingIds = new Set((existing ?? []).map((r) => r.source_event_id));

    const { error } = await supabase.from("tournaments").upsert(
      events.map((e) => ({
        user_id: userId,
        source: "fortnitetracker",
        source_event_id: e.sourceEventId,
        name: e.name,
        event_date: e.eventDate,
        mode: e.mode,
        placement: toWhole(e.placement),
        kills: toWhole(e.elims),
        points: toWhole(e.prPoints),
        matches_played: e.matches && e.matches > 0 ? toWhole(e.matches) : null,
        wins: toWholeOrNull(e.wins),
      })),
      { onConflict: "user_id,source_event_id" },
    );
    if (error) {
      console.error("Tracker import: save failed", error);
      return { ok: false, error: "save_failed" };
    }

    const added = events.filter((e) => !existingIds.has(e.sourceEventId)).length;
    return { ok: true, found: events.length, added, updated: events.length - added };
  });
