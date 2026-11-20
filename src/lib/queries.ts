import { queryOptions } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const VIDEO_BUCKET = "training-videos";

export const MOVE_CATEGORIES = [
  "בנייה",
  "עריכה",
  "קרבות",
  "רוטציות",
  "אנד גיים",
  "מכניקות",
  "אחר",
] as const;

export const MODES: Record<string, string> = {
  solo: "סולו",
  duo: "דואו",
  trio: "טריו",
  squad: "סקוואד",
};

export const todayKey = () => format(new Date(), "yyyy-MM-dd");

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const tournamentsQuery = queryOptions({
  queryKey: ["tournaments"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },
});

async function fetchVideos() {
    const { data, error } = await supabase
      .from("training_videos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (data.length === 0) return [];
    const { data: signed, error: signError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrls(
        data.map((v) => v.storage_path),
        60 * 60 * 6,
      );
    if (signError) throw signError;
    const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return data.map((v) => ({ ...v, url: urls.get(v.storage_path) ?? null }));
}

export type VideoWithUrl = Awaited<ReturnType<typeof fetchVideos>>[number];

export const videosQuery = queryOptions({
  queryKey: ["videos"],
  queryFn: fetchVideos,
  staleTime: 1000 * 60 * 30,
});

export const tipsQuery = queryOptions({
  queryKey: ["tips"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tips")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const planBlocksQuery = queryOptions({
  queryKey: ["plan-blocks"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("plan_blocks")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },
});

export const completionsQuery = (day: string) =>
  queryOptions({
    queryKey: ["plan-completions", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_completions")
        .select("*")
        .eq("day", day);
      if (error) throw error;
      return data;
    },
  });

export function watchedToday(lastWatched: string | null): boolean {
  if (!lastWatched) return false;
  return format(new Date(lastWatched), "yyyy-MM-dd") === todayKey();
}
