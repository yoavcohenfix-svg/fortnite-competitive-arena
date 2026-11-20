import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, CalendarClock, Lightbulb, PlayCircle } from "lucide-react";
import type { ReactNode } from "react";
import { TrendBadge } from "@/components/app/TrendBadge";
import { Progress } from "@/components/ui/progress";
import { summarize } from "@/lib/analysis";
import {
  completionsQuery,
  planBlocksQuery,
  profileQuery,
  todayKey,
  tournamentsQuery,
  videosQuery,
  watchedToday,
} from "@/lib/queries";
import { tipOfTheDay } from "@/lib/tips";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "לוח ראשי — Train Comp" },
      { name: "description", content: "סיכום יומי: טורנירים, מהלכים לשינון, טיפ היום ותוכנית האימון." },
      { property: "og:title", content: "לוח ראשי — Train Comp" },
      { property: "og:description", content: "סיכום יומי של ההתקדמות שלך בפורטנייט תחרותי." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    const day = todayKey();
    await Promise.all([
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
      context.queryClient.ensureQueryData(tournamentsQuery),
      context.queryClient.ensureQueryData(videosQuery),
      context.queryClient.ensureQueryData(planBlocksQuery),
      context.queryClient.ensureQueryData(completionsQuery(day)),
    ]);
  },
  component: Dashboard,
});

function Tile({
  to,
  icon,
  title,
  children,
  delay,
}: {
  to: "/tournaments" | "/training" | "/tips" | "/plan";
  icon: ReactNode;
  title: string;
  children: ReactNode;
  delay: number;
}) {
  return (
    <Link
      to={to}
      className="group panel flex min-h-56 flex-col p-6 transition-all hover:-translate-y-1 hover:border-primary/60 hover:glow animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-lg bg-secondary text-primary">{icon}</span>
        <ArrowLeft className="size-5 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
      </div>
      <h2 className="mt-5 text-2xl">{title}</h2>
      <div className="mt-3 flex-1 text-sm text-muted-foreground">{children}</div>
    </Link>
  );
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const day = todayKey();
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const { data: tournaments } = useSuspenseQuery(tournamentsQuery);
  const { data: videos } = useSuspenseQuery(videosQuery);
  const { data: blocks } = useSuspenseQuery(planBlocksQuery);
  const { data: completions } = useSuspenseQuery(completionsQuery(day));

  const summary = summarize(tournaments);
  const last = tournaments.at(-1);
  const toReview = videos.filter((v) => !watchedToday(v.last_watched_at)).length;
  const done = completions.filter((c) => blocks.some((b) => b.id === c.block_id)).length;
  const tip = tipOfTheDay();
  const name = profile?.display_name ?? "שחקן";

  return (
    <div>
      <div className="mb-8 animate-rise">
        <p className="font-stat text-xs font-bold uppercase tracking-[0.3em] text-primary">Lobby</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">היי {name}, מוכן להתאמן?</h1>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Tile to="/tournaments" icon={<BarChart3 />} title="מעקב טורנירים" delay={60}>
          {last ? (
            <div className="space-y-2">
              <p>
                אחרון: <span className="text-foreground">{last.name}</span>, מקום{" "}
                <span className="font-stat text-lg text-foreground">#{last.placement}</span>, {last.kills} קילים
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs">מיקום</span>
                <TrendBadge trend={summary.placement.trend} />
                <span className="text-xs">קילים</span>
                <TrendBadge trend={summary.kills.trend} />
              </div>
            </div>
          ) : (
            <p>הוסף את הטורניר הראשון וקבל דוח מצב על ההתקדמות.</p>
          )}
        </Tile>

        <Tile to="/training" icon={<PlayCircle />} title="אימונים" delay={140}>
          {videos.length === 0 ? (
            <p>העלה סרטון קצר של מהלך ותתחיל לשנן אותו כל יום.</p>
          ) : (
            <p>
              <span className="font-stat text-3xl text-foreground">{toReview}</span> מתוך {videos.length} מהלכים
              עוד לא נצפו היום
            </p>
          )}
        </Tile>

        <Tile to="/tips" icon={<Lightbulb />} title="טיפים" delay={220}>
          <p className="text-xs text-accent">טיפ היום · {tip.category}</p>
          <p className="mt-1 text-base text-foreground">"{tip.text}"</p>
        </Tile>

        <Tile to="/plan" icon={<CalendarClock />} title="תוכנית עבודה" delay={300}>
          {blocks.length === 0 ? (
            <p>בנה את המבנה הקבוע של יום המשחק שלך: חימום, אנד גיים, באטל רויאל.</p>
          ) : (
            <div className="space-y-2">
              <p>
                היום: <span className="font-stat text-foreground">{done}/{blocks.length}</span> שלבים הושלמו
              </p>
              <Progress value={(done / blocks.length) * 100} />
            </div>
          )}
        </Tile>
      </div>
    </div>
  );
}
