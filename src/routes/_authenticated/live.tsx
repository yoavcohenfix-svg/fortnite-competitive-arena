import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Check, RefreshCw, Target, Trophy, X, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_SCORING, elimPoints, progress, waysToReach, type Scoring } from "@/lib/live";
import { eventIdFromInput, type LiveSnapshot } from "@/lib/live-parse";
import { fetchLiveStanding, fetchUpcomingEvents, type UpcomingEvent } from "@/lib/live.functions";
import { profileQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({
    meta: [
      { title: "טורניר חי — Train Comp" },
      { name: "description", content: "מתכנן טורניר חי: יעד נקודות, כמה חסר בכל משחק והדרכים להשיג את היעד." },
      { property: "og:title", content: "טורניר חי — Train Comp" },
      { property: "og:description", content: "תכנון נקודות לייב לטורנירים הקרובים שלך." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(profileQuery(context.user.id));
  },
  component: LivePage,
});

const num = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const placeLabel = (place: number | null) =>
  place === null ? "בלי מיקום (רק קילים)" : place === 1 ? "ניצחון" : `מקום ${place}`;

const israelTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("he-IL", {
        timeZone: "Asia/Jerusalem",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : null;

function LivePage() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useSuspenseQuery(profileQuery(user.id));

  const [username, setUsername] = useState(profile?.epic_username ?? "");
  const [eventInput, setEventInput] = useState("");
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);

  const [target, setTarget] = useState("300");
  const [current, setCurrent] = useState("0");
  const [played, setPlayed] = useState("0");
  const [cap, setCap] = useState("12");

  const [region, setRegion] = useState<"ME" | "EU">("ME");

  const fetchLive = useServerFn(fetchLiveStanding);
  const fetchUpcoming = useServerFn(fetchUpcomingEvents);

  const live = useMutation({
    mutationFn: async () => {
      const eventId = eventIdFromInput(eventInput);
      if (!eventId) throw new Error("eventId");
      return fetchLive({ data: { eventId, username: username.trim() } });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error("לא הצלחנו למשוך נתונים מ-Fortnite Tracker. נסה שוב בעוד דקה.");
        return;
      }
      setSnapshot(result.snapshot);
      if (result.snapshot.found) toast.success("הנתונים עודכנו");
      else toast.info("השחקן עדיין לא מופיע בלוח של האירוע הזה");
    },
    onError: (e) =>
      toast.error(e.message === "eventId" ? "צריך מזהה אירוע (או קישור לאירוע)" : "המשיכה נכשלה"),
  });

  const upcoming = useMutation({
    mutationFn: async (next: "ME" | "EU") => fetchUpcoming({ data: { region: next } }),
    onError: () => toast.error("לא הצלחנו למשוך את האירועים הקרובים"),
  });

  const scoring: Scoring = snapshot?.scoring ?? DEFAULT_SCORING;
  const progressResult = progress({
    target: Math.max(0, num(target)),
    current: Math.max(0, num(current)),
    matchesPlayed: Math.max(0, num(played)),
    matchCap: Math.max(1, num(cap) || 12),
    scoring,
  });
  const perMatch = progressResult.perMatch;
  const ways = !progressResult.reached && perMatch !== null ? waysToReach(scoring, perMatch) : [];
  const viable = ways.filter((w) => w.kills !== null).sort((a, b) => (a.kills! - b.kills!) || ((a.place ?? 999) - (b.place ?? 999)));
  const impossible = ways.filter((w) => w.kills === null);

  return (
    <div>
      <PageHeader
        eyebrow="Live Tournament"
        title="טורניר חי"
        description="בחר את הטורניר, הצב יעד נקודות ותדע בדיוק כמה חסר ובאילו תוצאות אפשר להשיג אותו — כולל נתוני לייב מ-Fortnite Tracker והאירועים הקרובים."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <LiveCard
          username={username}
          setUsername={setUsername}
          eventInput={eventInput}
          setEventInput={setEventInput}
          snapshot={snapshot}
          pending={live.isPending}
          onFetch={() => live.mutate()}
          onUseSnapshot={() => {
            if (!snapshot) return;
            setCurrent(String(snapshot.points ?? 0));
            setPlayed(String(snapshot.matchesPlayed ?? 0));
            if (snapshot.matchCap) setCap(String(snapshot.matchCap));
            toast.success("הערכים עודכנו במתכנן");
          }}
        />

        <PlannerCard
          target={target}
          setTarget={setTarget}
          current={current}
          setCurrent={setCurrent}
          played={played}
          setPlayed={setPlayed}
          cap={cap}
          setCap={setCap}
          scoring={scoring}
          progressResult={progressResult}
          perMatch={perMatch}
          viable={viable}
          impossible={impossible}
        />
      </div>

      <UpcomingCard
        region={region}
        onRegionChange={(next) => {
          setRegion(next);
          upcoming.mutate(next);
        }}
        pending={upcoming.isPending}
        onRefresh={() => upcoming.mutate(region)}
        data={upcoming.data}
        onPick={(event) => {
          setEventInput(event.eventId);
          toast.success(`"${event.name}" נבחר כטורניר החי`);
        }}
      />
    </div>
  );
}

function LiveCard({
  username,
  setUsername,
  eventInput,
  setEventInput,
  snapshot,
  pending,
  onFetch,
  onUseSnapshot,
}: {
  username: string;
  setUsername: (v: string) => void;
  eventInput: string;
  setEventInput: (v: string) => void;
  snapshot: LiveSnapshot | null;
  pending: boolean;
  onFetch: () => void;
  onUseSnapshot: () => void;
}) {
  return (
    <section className="panel p-6 animate-rise">
      <h2 className="flex items-center gap-2 text-xl">
        <Zap className="size-5 text-primary" /> נתוני לייב
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        הדבק מזהה אירוע (או קישור לאירוע מ-Fortnite Tracker) ונוריד את המיקום והנקודות שלך בזמן אמת.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="live_user">שם משתמש ב-Epic</Label>
          <Input id="live_user" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="live_event">אירוע</Label>
          <Input
            id="live_event"
            dir="ltr"
            placeholder="epicgames_S43_RankedCupReloadDuos_ME"
            value={eventInput}
            onChange={(e) => setEventInput(e.target.value)}
          />
        </div>
      </div>

      <Button variant="hero" className="mt-4" onClick={onFetch} disabled={pending}>
        <RefreshCw className={pending ? "animate-spin" : undefined} />
        {pending ? "מושך..." : "משוך נתוני לייב"}
      </Button>

      {snapshot && snapshot.found && (
        <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg border border-border bg-secondary/40 p-4">
          <LiveStat label="מיקום" value={`#${snapshot.rank ?? "—"}`} />
          <LiveStat label="נקודות" value={String(snapshot.points ?? 0)} />
          <LiveStat
            label="משחקים"
            value={`${snapshot.matchesPlayed ?? 0}${snapshot.matchCap ? ` / ${snapshot.matchCap}` : ""}`}
          />
          <LiveStat label="קילים" value={String(snapshot.elims ?? 0)} />
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {snapshot.eventName}
              {snapshot.updatedAt ? ` · עודכן ${israelTime(snapshot.updatedAt) ?? ""}` : ""}
            </p>
            <Button size="sm" variant="panel" onClick={onUseSnapshot}>
              העתק למתכנן
            </Button>
          </div>
        </div>
      )}

      {snapshot && !snapshot.found && (
        <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          השחקן לא נמצא בלוח של האירוע הזה. ודא שהאירוע פעיל ושהוא אכן משתתף בו (או המתן שהמשחקים ייכנסו).
        </p>
      )}
    </section>
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-stat text-2xl font-bold" dir="ltr" style={{ textAlign: "right" }}>
        {value}
      </p>
    </div>
  );
}

function PlannerCard({
  target,
  setTarget,
  current,
  setCurrent,
  played,
  setPlayed,
  cap,
  setCap,
  scoring,
  progressResult,
  perMatch,
  viable,
  impossible,
}: {
  target: string;
  setTarget: (v: string) => void;
  current: string;
  setCurrent: (v: string) => void;
  played: string;
  setPlayed: (v: string) => void;
  cap: string;
  setCap: (v: string) => void;
  scoring: Scoring;
  progressResult: ReturnType<typeof progress>;
  perMatch: number | null;
  viable: ReturnType<typeof waysToReach>;
  impossible: ReturnType<typeof waysToReach>;
}) {
  return (
    <section className="panel stripes p-6 animate-rise">
      <h2 className="flex items-center gap-2 text-xl">
        <Target className="size-5 text-primary" /> מתכנן היעד
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        קבע את יעד הנקודות של הטורניר. נחשב כמה נקודות חסרות, כמה צריך בכל משחק שנותר ובאילו תוצאות מגיעים לשם.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field id="p_target" label="יעד נקודות" value={target} setValue={setTarget} />
        <Field id="p_current" label="נקודות כרגע" value={current} setValue={setCurrent} />
        <Field id="p_played" label="משחקים ששוחקו" value={played} setValue={setPlayed} />
        <Field id="p_cap" label="מקס' משחקים" value={cap} setValue={setCap} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 rounded-lg border border-border bg-secondary/40 p-4">
        <LiveStat label="חסרות נקודות" value={String(progressResult.missing)} />
        <LiveStat label="משחקים שנותרו" value={String(progressResult.matchesLeft)} />
        <LiveStat label="נקודות למשחק" value={perMatch === null ? "—" : String(Math.ceil(perMatch))} />
      </div>

      {progressResult.reached && (
        <p className="mt-4 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
          הגעת ליעד. כל נקודה מעבר היא בונוס.
        </p>
      )}
      {!progressResult.reached && !progressResult.possible && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          היעד לא ריאלי במספר המשחקים שנותרו — גם ניצחון עם מקסימום קילים בכל משחק לא יספיק. הנמך את היעד.
        </p>
      )}

      {viable.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-medium">דרכים להשיג {Math.ceil(perMatch ?? 0)} נקודות במשחק</h3>
          <p className="mt-1 text-xs text-muted-foreground">בחר את הדרך שהכי מסתדרת לך — כל שורה היא תוצאה שמספיקה למשחק אחד.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pe-3 text-start font-medium">מיקום</th>
                  <th className="py-2 pe-3 text-start font-medium">נק' מיקום</th>
                  <th className="py-2 pe-3 text-start font-medium">קילים שצריך</th>
                  <th className="py-2 text-start font-medium">סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {viable.map((way) => (
                  <tr key={String(way.place)} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pe-3">
                      <span className="flex items-center gap-2">
                        <Check className="size-4 text-success" />
                        {placeLabel(way.place)}
                      </span>
                    </td>
                    <td className="py-2 pe-3 font-stat text-muted-foreground">{way.placePoints}</td>
                    <td className="py-2 pe-3 font-stat font-bold">{way.kills}</td>
                    <td className="py-2 font-stat">{way.placePoints + elimPoints(scoring, way.kills ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {impossible.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <X className="size-3.5" />
              לא מספיק גם עם מקסימום קילים:
              {impossible.map((way) => placeLabel(way.place)).join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  setValue,
}: {
  id: string;
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} dir="ltr" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}

function UpcomingCard({
  region,
  onRegionChange,
  pending,
  onRefresh,
  data,
  onPick,
}: {
  region: "ME" | "EU";
  onRegionChange: (region: "ME" | "EU") => void;
  pending: boolean;
  onRefresh: () => void;
  data: { ok: true; events: UpcomingEvent[] } | { ok: false; error: string } | undefined;
  onPick: (event: UpcomingEvent) => void;
}) {
  const events = data?.ok ? data.events : [];

  return (
    <section className="panel mt-6 p-6 animate-rise">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl">
            <CalendarClock className="size-5 text-primary" /> 5 האירועים הקרובים
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            התאריך והשעה בשעון ישראל. בחר אזור כדי לראות את האירועים הקרובים בו.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={region} onValueChange={(v) => onRegionChange(v as "ME" | "EU")}>
            <TabsList>
              <TabsTrigger value="ME">Middle East</TabsTrigger>
              <TabsTrigger value="EU">Europe</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="panel" onClick={onRefresh} disabled={pending}>
            <RefreshCw className={pending ? "animate-spin" : undefined} />
            {pending ? "טוען..." : "רענון"}
          </Button>
        </div>
      </div>

      {pending && events.length === 0 && (
        <p className="mt-5 text-sm text-accent">מושך את האירועים הקרובים מ-Fortnite Tracker. זה יכול לקחת כמה שניות.</p>
      )}

      {!data && !pending && (
        <p className="mt-5 text-sm text-muted-foreground">
          לחץ על "רענון" (או בחר אזור אחר) כדי לטעון את האירועים הקרובים.
        </p>
      )}

      {data && !data.ok && (
        <p className="mt-5 rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          {data.error === "no_events" ? "לא נמצאו אירועים קרובים באזור הזה." : "המשיכה נכשלה. נסה שוב."}
        </p>
      )}

      {events.length > 0 && (
        <ul className="mt-5 divide-y divide-border">
          {events.map((event) => (
            <li key={event.eventId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{event.name}</p>
                <p className={cn("font-stat text-sm", event.startIso ? "text-primary" : "text-muted-foreground")}>
                  {israelTime(event.startIso) ?? "מועד לא ידוע"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onPick(event)}>
                <Trophy className="size-4" /> קבע כטורניר חי
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
