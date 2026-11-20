import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Eye, Play, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  MOVE_CATEGORIES,
  VIDEO_BUCKET,
  videosQuery,
  watchedToday,
  type VideoWithUrl,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [
      { title: "אימונים — Train Comp" },
      { name: "description", content: "סרטוני מהלכים קצרים לשינון יומי, מסודרים לפי קטגוריות." },
      { property: "og:title", content: "אימונים — Train Comp" },
      { property: "og:description", content: "משננים מהלכים בפורטנייט עם סרטונים קצרים כל יום." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(videosQuery),
  component: TrainingPage,
});

type Video = VideoWithUrl;

const MAX_MB = 100;

function TrainingPage() {
  const { data: videos } = useSuspenseQuery(videosQuery);
  const [filter, setFilter] = useState<string>("הכל");
  const [playing, setPlaying] = useState<Video | null>(null);

  const watchedCount = videos.filter((v) => watchedToday(v.last_watched_at)).length;
  const toReview = [...videos]
    .filter((v) => !watchedToday(v.last_watched_at))
    .sort((a, b) => (a.last_watched_at ?? "").localeCompare(b.last_watched_at ?? ""));
  const shown = filter === "הכל" ? videos : videos.filter((v) => v.category === filter);
  const usedCategories = MOVE_CATEGORIES.filter((c) => videos.some((v) => v.category === c));

  return (
    <div>
      <PageHeader
        eyebrow="Training"
        title="אימונים"
        description="מעלים סרטון קצר (עד דקה בערך) לכל מהלך, וצופים בו כל יום עד שהוא נהיה אוטומטי."
        action={<UploadDialog />}
      />

      {videos.length > 0 && (
        <section className="panel stripes p-6 animate-rise">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl">שינון יומי</h2>
              <p className="text-sm text-muted-foreground">
                {toReview.length === 0
                  ? "כל המהלכים נצפו היום. מעולה!"
                  : `נשארו ${toReview.length} מהלכים לצפייה היום. מתחילים מאלה שלא ראית הכי הרבה זמן.`}
              </p>
            </div>
            <div className="w-full sm:w-64">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>נצפו היום</span>
                <span className="font-stat">
                  {watchedCount}/{videos.length}
                </span>
              </div>
              <Progress value={(watchedCount / videos.length) * 100} />
            </div>
          </div>
          {toReview.length > 0 && (
            <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
              {toReview.slice(0, 8).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setPlaying(v)}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-secondary/70 px-4 py-2 text-sm transition-colors hover:border-primary"
                >
                  <Play className="size-4 text-primary" />
                  {v.title}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {videos.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {["הכל", ...usedCategories].map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                filter === c
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="panel mt-2 p-12 text-center animate-rise">
          <Upload className="mx-auto size-10 text-primary" />
          <p className="mt-4 text-lg">עוד אין סרטוני מהלכים</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            הקלט מהלך אחד (למשל עריכה מהירה או רוטציה קבועה), העלה אותו לקטגוריה המתאימה, ותחזור
            אליו כל יום.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v) => (
            <VideoCard key={v.id} video={v} onPlay={() => setPlaying(v)} />
          ))}
        </div>
      )}

      <PlayerDialog video={playing} onClose={() => setPlaying(null)} />
    </div>
  );
}

function VideoCard({ video, onPlay }: { video: Video; onPlay: () => void }) {
  const queryClient = useQueryClient();
  const seen = watchedToday(video.last_watched_at);
  const remove = useMutation({
    mutationFn: async () => {
      await supabase.storage.from(VIDEO_BUCKET).remove([video.storage_path]);
      const { error } = await supabase.from("training_videos").delete().eq("id", video.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הסרטון נמחק");
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: () => toast.error("המחיקה נכשלה"),
  });

  return (
    <article className="panel group overflow-hidden animate-rise">
      <button onClick={onPlay} className="relative block aspect-video w-full bg-secondary">
        {video.url && (
          <video src={`${video.url}#t=0.5`} preload="metadata" muted playsInline className="size-full object-cover" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-background/30 transition-colors group-hover:bg-background/10">
          <span className="grid size-14 place-items-center rounded-full bg-gradient-primary text-primary-foreground glow">
            <Play className="size-6 translate-x-[-1px]" fill="currentColor" />
          </span>
        </span>
        {seen && (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            <CheckCircle2 className="size-3.5" /> נצפה היום
          </span>
        )}
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs text-accent">{video.category}</span>
            <h3 className="font-sans text-base font-semibold">{video.title}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="מחיקת סרטון"
            onClick={() => {
              if (confirm(`למחוק את "${video.title}"?`)) remove.mutate();
            }}
          >
            <Trash2 className="text-muted-foreground" />
          </Button>
        </div>
        {video.description && <p className="mt-1 text-sm text-muted-foreground">{video.description}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="size-3.5" /> נצפה {video.watch_count} פעמים
        </p>
      </div>
    </article>
  );
}

function PlayerDialog({ video, onClose }: { video: Video | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const markWatched = useMutation({
    mutationFn: async (v: Video) => {
      const { error } = await supabase
        .from("training_videos")
        .update({ watch_count: v.watch_count + 1, last_watched_at: new Date().toISOString() })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["videos"] }),
  });

  return (
    <Dialog open={!!video} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        {video && (
          <>
            <DialogHeader>
              <DialogTitle>{video.title}</DialogTitle>
              {video.description && <DialogDescription>{video.description}</DialogDescription>}
            </DialogHeader>
            {video.url ? (
              <video
                key={video.id}
                src={video.url}
                controls
                autoPlay
                loop
                playsInline
                className="w-full rounded-lg bg-secondary"
                onPlay={() => {
                  if (!markWatched.isPending && !markWatched.isSuccess) markWatched.mutate(video);
                }}
              />
            ) : (
              <p className="text-muted-foreground">לא הצלחנו לטעון את הסרטון.</p>
            )}
            <p className="text-xs text-muted-foreground">הסרטון רץ בלופ. צפה בו כמה פעמים ונסה לבצע את המהלך במשחק.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(MOVE_CATEGORIES[0]);

  const upload = useMutation({
    mutationFn: async (form: FormData) => {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) throw new Error("נא לבחור סרטון");
      if (!file.type.startsWith("video/")) throw new Error("הקובץ צריך להיות סרטון");
      if (file.size > MAX_MB * 1024 * 1024) throw new Error(`הסרטון גדול מ-${MAX_MB}MB`);
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(VIDEO_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("training_videos").insert({
        title: String(form.get("title") ?? "").trim() || "מהלך חדש",
        description: String(form.get("description") ?? "").trim() || null,
        category,
        storage_path: path,
      });
      if (error) {
        await supabase.storage.from(VIDEO_BUCKET).remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("המהלך עלה! תצפה בו כל יום");
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e.message || "ההעלאה נכשלה"),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    upload.mutate(new FormData(e.currentTarget));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" size="lg">
          <Upload /> העלאת מהלך
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מהלך חדש</DialogTitle>
          <DialogDescription>סרטון קצר שמלמד מהלך אחד. עד {MAX_MB}MB.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">שם המהלך</Label>
            <Input id="title" name="title" placeholder="למשל: 90s מהירים" required />
          </div>
          <div className="space-y-1.5">
            <Label>קטגוריה</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">מה לזכור (לא חובה)</Label>
            <Textarea id="description" name="description" rows={2} placeholder="למשל: קיר, רמפה, ריצה למעלה ולהסתובב" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file">סרטון</Label>
            <Input id="file" name="file" type="file" accept="video/*" required />
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={upload.isPending}>
            {upload.isPending ? "מעלה..." : "העלאה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
