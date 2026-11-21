import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RefreshCw, Trash2, Trophy } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { TrendBadge } from "@/components/app/TrendBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { buildReport, summarize, type Trend } from "@/lib/analysis";
import { toWhole, toWholeOrNull } from "@/lib/numbers";
import { MODES, profileQuery, todayKey, tournamentsQuery } from "@/lib/queries";
import { importFromTracker } from "@/lib/tracker.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tournaments")({
  head: () => ({
    meta: [
      { title: "מעקב טורנירים — Train Comp" },
      { name: "description", content: "מקומות, קילים ונקודות בכל טורניר, עם ניתוח מגמות ודוח מצב." },
      { property: "og:title", content: "מעקב טורנירים — Train Comp" },
      { property: "og:description", content: "ניתוח ההתקדמות שלך בטורנירי פורטנייט." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(tournamentsQuery),
      context.queryClient.ensureQueryData(profileQuery(context.user.id)),
    ]);
  },
  component: TournamentsPage,
});

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  color: "var(--color-foreground)",
};

function TournamentsPage() {
  const { data: tournaments } = useSuspenseQuery(tournamentsQuery);
  const summary = summarize(tournaments);
  const report = buildReport(summary);
  const hasPoints = tournaments.some((t) => t.points > 0);
  const chartData = tournaments.map((t, i) => ({
    label: `${i + 1}`,
    name: t.name,
    placement: t.placement,
    kills: t.kills,
    points: t.points,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Tournament Tracker"
        title="מעקב טורנירים"
        description="הטורנירים נמשכים אוטומטית מ-Fortnite Tracker (או נוספים ידנית) ונכנסים לניתוח: מקום, קילים, נקודות וקונסיסטנטיות."
        action={<AddTournamentDialog />}
      />

      <TrackerCard />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="מקום ממוצע"
          value={summary.count ? `#${Math.round(summary.avgPlacement)}` : "—"}
          sub={summary.bestPlacement ? `הכי טוב: #${summary.bestPlacement}` : undefined}
          trend={summary.placement.trend}
        />
        <StatCard
          label="קילים לטורניר"
          value={summary.count ? summary.avgKills.toFixed(1) : "—"}
          sub={
            summary.killsPerMatch !== null
              ? `${summary.killsPerMatch.toFixed(2)} למשחק`
              : summary.count
                ? `שיא: ${summary.bestKills}`
                : undefined
          }
          trend={summary.kills.trend}
        />
        <StatCard
          label="נקודות ממוצע"
          value={hasPoints ? Math.round(summary.avgPoints).toString() : "—"}
          sub={!hasPoints && summary.count ? "Fortnite Tracker לא מציג נקודות" : undefined}
          {...(hasPoints ? { trend: summary.points.trend } : {})}
        />
        <StatCard
          label="קונסיסטנטיות"
          value={summary.consistency !== null ? `${summary.consistency}` : "—"}
          sub="מתוך 100"
        />
      </div>

      <section className="panel mt-6 p-6 animate-rise">
        <h2 className="flex items-center gap-2 text-xl">
          <Trophy className="size-5 text-primary" /> דוח מצב
        </h2>
        <ul className="mt-4 space-y-2">
          {report.map((line) => (
            <li key={line} className="flex gap-3 text-sm sm:text-base">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {line}
            </li>
          ))}
        </ul>
        {summary.count >= 2 && (
          <p className="mt-4 text-xs text-muted-foreground">
            ההשוואה היא בין הטורנירים האחרונים (עד 3) לבין אותו מספר טורנירים שלפניהם.
          </p>
        )}
      </section>

      {tournaments.length >= 2 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ChartPanel title="מקום לאורך הזמן" hint="למעלה = מקום טוב יותר">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis reversed stroke="var(--color-muted-foreground)" fontSize={12} width={40} orientation="right" />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(_, p) => p[0]?.payload?.name ?? ""}
                formatter={(v) => [`#${v}`, "מקום"]}
              />
              <Line
                type="monotone"
                dataKey="placement"
                stroke="var(--color-primary)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--color-primary)" }}
              />
            </LineChart>
          </ChartPanel>
          <ChartPanel title="קילים ונקודות בכל טורניר" hint="סקיל אישי מול תוצאה">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis yAxisId="k" stroke="var(--color-muted-foreground)" fontSize={12} width={30} orientation="right" />
              <YAxis yAxisId="p" stroke="var(--color-muted-foreground)" fontSize={12} width={40} orientation="left" />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(_, p) => p[0]?.payload?.name ?? ""}
                formatter={(v, key) => [v, key === "kills" ? "קילים" : "נקודות"]}
              />
              <Bar yAxisId="k" dataKey="kills" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="p" dataKey="points" fill="var(--color-primary)" radius={[4, 4, 0, 0]} opacity={0.75} />
            </BarChart>
          </ChartPanel>
        </div>
      )}

      <ResultsTable />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  trend?: Trend;
}) {
  return (
    <div className="panel p-5 animate-rise">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-stat text-3xl font-bold sm:text-4xl" dir="ltr" style={{ textAlign: "right" }}>
        {value}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {trend && <TrendBadge trend={trend} />}
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function ChartPanel({ title, hint, children }: { title: string; hint: string; children: React.ReactElement }) {
  return (
    <section className="panel p-5 animate-rise">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg">{title}</h2>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="mt-4 h-64" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function TrackerCard() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const runImport = useServerFn(importFromTracker);
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));
  const [epic, setEpic] = useState(profile?.epic_username ?? "");

  const sync = useMutation({
    mutationFn: async () => runImport({ data: { username: epic.trim() } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["tournaments"] });
        toast.success(
          result.added > 0
            ? `נמצאו ${result.found} טורנירים, ${result.added} חדשים נוספו לניתוח`
            : `הכול מעודכן: ${result.found} טורנירים כבר נמצאים אצלך`,
        );
        return;
      }
      const messages: Record<typeof result.error, string> = {
        not_found: "לא מצאנו שחקן עם השם הזה ב-Fortnite Tracker. בדוק את האיות של שם המשתמש ב-Epic.",
        no_events: "השחקן נמצא, אבל אין לו טורנירים ב-Fortnite Tracker עדיין.",
        fetch_failed: "Fortnite Tracker לא ענה כרגע. נסה שוב בעוד דקה.",
        save_failed: "הנתונים נמשכו אבל השמירה נכשלה. נסה שוב.",
      };
      toast.error(messages[result.error]);
    },
    onError: () => toast.error("משהו השתבש. בדוק את שם המשתמש ונסה שוב."),
  });

  const saved = profile?.epic_username;

  return (
    <section className="panel stripes p-6 animate-rise">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl">ייבוא אוטומטי מ-Fortnite Tracker</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            רשום את שם המשתמש שלך ב-Epic ולחץ על ייבוא. האפליקציה תיכנס לבד ל-Fortnite Tracker, תמשוך את
            כל הטורנירים שלך (מקום, קילים ומשחקים) ותעדכן את הדוח. כדי לעדכן אחרי טורניר חדש, לוחצים שוב.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            הקילים שמגיעים מ-Fortnite Tracker הם של כל הקבוצה, כי ככה האתר מציג אותם.
          </p>
        </div>
        <form
          className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            if (epic.trim().length < 2) {
              toast.error("רשום שם משתמש ב-Epic");
              return;
            }
            sync.mutate();
          }}
        >
          <Input
            dir="ltr"
            placeholder="Epic username"
            value={epic}
            onChange={(e) => setEpic(e.target.value)}
            className="sm:w-56"
            disabled={sync.isPending}
          />
          <Button type="submit" variant="hero" disabled={sync.isPending}>
            {sync.isPending ? (
              <>
                <RefreshCw className="animate-spin" /> מושך נתונים...
              </>
            ) : (
              <>
                <RefreshCw /> {saved ? "עדכון מ-Fortnite Tracker" : "ייבוא טורנירים"}
              </>
            )}
          </Button>
        </form>
      </div>
      {sync.isPending && (
        <p className="mt-4 text-sm text-accent">נכנס ל-Fortnite Tracker וקורא את הטורנירים שלך. זה יכול לקחת עד חצי דקה.</p>
      )}
    </section>
  );
}

function AddTournamentDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("duo");

  const add = useMutation({
    mutationFn: async (form: FormData) => {
      const num = (k: string) => {
        const v = String(form.get(k) ?? "").trim();
        return v === "" ? null : Number(v);
      };
      const placement = num("placement");
      if (!placement || placement < 1) throw new Error("placement");
      const { error } = await supabase.from("tournaments").insert({
        name: String(form.get("name") ?? "").trim() || "טורניר",
        event_date: String(form.get("event_date") || todayKey()),
        mode,
        placement: toWhole(placement),
        kills: toWhole(num("kills") ?? 0),
        points: toWhole(num("points") ?? 0),
        matches_played: toWholeOrNull(num("matches_played")),
        notes: String(form.get("notes") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הטורניר נוסף לניתוח");
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e.message === "placement" ? "צריך למלא מקום (1 ומעלה)" : "השמירה נכשלה"),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    add.mutate(new FormData(e.currentTarget));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" size="lg">
          <Plus /> הוספת טורניר
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>טורניר חדש</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="name">שם הטורניר</Label>
            <Input id="name" name="name" placeholder="למשל: FNCS Round 1" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event_date">תאריך</Label>
            <Input id="event_date" name="event_date" type="date" defaultValue={todayKey()} />
          </div>
          <div className="space-y-1.5">
            <Label>מצב</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="placement">מקום</Label>
            <Input id="placement" name="placement" type="number" min={1} required dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kills">קילים</Label>
            <Input id="kills" name="kills" type="number" min={0} defaultValue={0} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="points">נקודות</Label>
            <Input id="points" name="points" type="number" min={0} defaultValue={0} dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="matches_played">משחקים (לא חובה)</Label>
            <Input id="matches_played" name="matches_played" type="number" min={1} dir="ltr" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" name="notes" placeholder="מה עבד? מה לשפר?" rows={2} />
          </div>
          <Button type="submit" variant="hero" className="col-span-2" disabled={add.isPending}>
            {add.isPending ? "שומר..." : "שמירה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResultsTable() {
  const queryClient = useQueryClient();
  const { data: tournaments } = useSuspenseQuery(tournamentsQuery);
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tournaments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
    onError: () => toast.error("המחיקה נכשלה"),
  });

  if (tournaments.length === 0) {
    return (
      <div className="panel mt-6 p-10 text-center">
        <p className="text-lg">עוד אין טורנירים</p>
        <p className="mt-1 text-sm text-muted-foreground">רשום למעלה את שם המשתמש שלך ב-Epic ולחץ על ייבוא, או הוסף טורניר ידנית.</p>
      </div>
    );
  }

  const rows = [...tournaments].reverse();
  return (
    <section className="panel mt-6 overflow-hidden animate-rise">
      <h2 className="px-6 pt-5 text-lg">כל הטורנירים</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-start font-medium">תאריך</th>
              <th className="px-3 py-3 text-start font-medium">טורניר</th>
              <th className="px-3 py-3 text-start font-medium">מצב</th>
              <th className="px-3 py-3 text-start font-medium">מקום</th>
              <th className="px-3 py-3 text-start font-medium">שינוי</th>
              <th className="px-3 py-3 text-start font-medium">קילים</th>
              <th className="px-3 py-3 text-start font-medium">נקודות</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const prev = rows[i + 1];
              const diff = prev ? prev.placement - t.placement : null;
              return (
                <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
                  <td className="px-6 py-3 font-stat text-muted-foreground">{t.event_date.split("-").reverse().join("/")}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      {t.name}
                      {t.source === "fortnitetracker" && (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-stat text-[10px] font-bold text-accent">FT</span>
                      )}
                    </div>
                    {t.notes && <div className="text-xs text-muted-foreground">{t.notes}</div>}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{MODES[t.mode] ?? t.mode}</td>
                  <td className="px-3 py-3 font-stat text-base font-bold">#{t.placement}</td>
                  <td className="px-3 py-3">
                    {diff === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          "font-stat font-semibold",
                          diff > 0 && "text-success",
                          diff < 0 && "text-destructive",
                          diff === 0 && "text-muted-foreground",
                        )}
                        dir="ltr"
                      >
                        {diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${Math.abs(diff)}` : "="}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-stat">{t.kills}</td>
                  <td className="px-3 py-3 font-stat">{t.points}</td>
                  <td className="px-3 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="מחיקה"
                      onClick={() => {
                        if (confirm(`למחוק את "${t.name}"?`)) remove.mutate(t.id);
                      }}
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
