import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Check, Clock, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { completionsQuery, planBlocksQuery, todayKey } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "תוכנית עבודה — Train Comp" },
      { name: "description", content: "המבנה הקבוע של כל יום משחק: חימום, אנד גיים, באטל רויאל ועוד." },
      { property: "og:title", content: "תוכנית עבודה — Train Comp" },
      { property: "og:description", content: "תוכנית אימון יומית לפורטנייט תחרותי." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(planBlocksQuery),
      context.queryClient.ensureQueryData(completionsQuery(todayKey())),
    ]);
  },
  component: PlanPage,
});

const TEMPLATE = [
  { title: "חימום", minutes: 20, focus: "מפת אימי (Aim) ועריכות" },
  { title: "אנד גיים", minutes: 60, focus: "מפות אנד גיים / זון וורס" },
  { title: "באטל רויאל", minutes: 60, focus: "ארנה או משחקים רגילים עם הצוות" },
  { title: "שינון מהלכים", minutes: 10, focus: "צפייה בסרטוני האימונים" },
];

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} דק׳`;
  return m === 0 ? `${h} שע׳` : `${h} שע׳ ${m} דק׳`;
}

function PlanPage() {
  const queryClient = useQueryClient();
  const day = todayKey();
  const { data: blocks } = useSuspenseQuery(planBlocksQuery);
  const { data: completions } = useSuspenseQuery(completionsQuery(day));
  const doneIds = new Set(completions.map((c) => c.block_id));
  const total = blocks.reduce((a, b) => a + b.minutes, 0);
  const done = blocks.filter((b) => doneIds.has(b.id)).length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["plan-blocks"] });
    queryClient.invalidateQueries({ queryKey: ["plan-completions"] });
  };

  const loadTemplate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("plan_blocks")
        .insert(TEMPLATE.map((t, i) => ({ ...t, position: i })));
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("לא הצלחנו לטעון את התבנית"),
  });

  const toggle = useMutation({
    mutationFn: async (blockId: string) => {
      if (doneIds.has(blockId)) {
        const { error } = await supabase
          .from("plan_completions")
          .delete()
          .eq("block_id", blockId)
          .eq("day", day);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plan_completions").insert({ block_id: blockId, day });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plan-completions", day] }),
  });

  const move = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const reordered = [...blocks];
      const target = index + dir;
      const a = reordered[index];
      const b = reordered[target];
      if (!a || !b) return;
      reordered[index] = b;
      reordered[target] = a;
      await Promise.all(
        reordered.map((blk, i) => supabase.from("plan_blocks").update({ position: i }).eq("id", blk.id)),
      );
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plan_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Daily Plan"
        title="תוכנית עבודה"
        description="המבנה הקבוע של כל יום שאתה משחק. מסמנים כל שלב שסיימת, ולמחרת מתחילים מחדש."
      />

      {blocks.length === 0 ? (
        <div className="panel stripes p-10 text-center animate-rise">
          <Clock className="mx-auto size-10 text-primary" />
          <p className="mt-4 text-lg">עוד אין תוכנית</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            התחל מהתבנית (20 דק׳ חימום, שעה אנד גיים, שעה באטל רויאל) ושנה אותה, או בנה תוכנית משלך
            למטה.
          </p>
          <Button variant="hero" size="lg" className="mt-6" onClick={() => loadTemplate.mutate()} disabled={loadTemplate.isPending}>
            <Sparkles /> טען תבנית לדוגמה
          </Button>
        </div>
      ) : (
        <>
          <section className="panel p-6 animate-rise">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">היום</p>
                <p className="font-stat text-4xl font-bold">
                  {done}/{blocks.length}
                </p>
              </div>
              <div className="text-end">
                <p className="text-sm text-muted-foreground">זמן כולל</p>
                <p className="font-stat text-2xl font-bold">{formatMinutes(total)}</p>
              </div>
            </div>
            <Progress value={(done / blocks.length) * 100} className="mt-4" />
            {done === blocks.length && (
              <p className="mt-3 text-sm font-semibold text-success">סיימת את כל התוכנית היום. כל הכבוד!</p>
            )}
          </section>

          <ol className="relative mt-6 space-y-3">
            {blocks.map((b, i) => {
              const isDone = doneIds.has(b.id);
              return (
                <li
                  key={b.id}
                  className={cn(
                    "panel flex items-center gap-4 p-4 transition-all animate-rise",
                    isDone && "border-success/50 opacity-80",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <button
                    onClick={() => toggle.mutate(b.id)}
                    aria-label={isDone ? "בטל סימון" : "סמן כבוצע"}
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      isDone ? "border-success bg-success text-primary-foreground" : "border-border hover:border-primary",
                    )}
                  >
                    {isDone ? <Check className="size-5" strokeWidth={3} /> : <span className="font-stat text-sm">{i + 1}</span>}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-semibold", isDone && "line-through decoration-success/70")}>{b.title}</p>
                    {b.focus && <p className="truncate text-sm text-muted-foreground">{b.focus}</p>}
                  </div>
                  <span className="shrink-0 rounded-md bg-secondary px-2.5 py-1 font-stat text-sm">{formatMinutes(b.minutes)}</span>
                  <div className="flex shrink-0 items-center">
                    <Button variant="ghost" size="icon" aria-label="הזז למעלה" disabled={i === 0} onClick={() => move.mutate({ index: i, dir: -1 })}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="הזז למטה" disabled={i === blocks.length - 1} onClick={() => move.mutate({ index: i, dir: 1 })}>
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="מחיקה" onClick={() => remove.mutate(b.id)}>
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <AddBlockForm nextPosition={blocks.length} onAdded={refresh} />
    </div>
  );
}

function AddBlockForm({ nextPosition, onAdded }: { nextPosition: number; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [focus, setFocus] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const m = Number(minutes);
      if (!title.trim() || !Number.isFinite(m) || m < 1) throw new Error("invalid");
      const { error } = await supabase
        .from("plan_blocks")
        .insert({ title: title.trim(), minutes: Math.round(m), focus: focus.trim() || null, position: nextPosition });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setFocus("");
      setMinutes("30");
      onAdded();
    },
    onError: (e) => toast.error(e.message === "invalid" ? "צריך שם ודקות" : "השמירה נכשלה"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add.mutate();
  }

  return (
    <section className="panel mt-6 p-6">
      <h2 className="text-lg">הוספת שלב</h2>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_1.4fr_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="שם השלב (למשל: בוקס פייטים)" required />
        <Input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          type="number"
          min={1}
          dir="ltr"
          aria-label="דקות"
          placeholder="דקות"
        />
        <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="על מה עובדים? (לא חובה)" />
        <Button type="submit" variant="hero" disabled={add.isPending}>
          <Plus /> הוספה
        </Button>
      </form>
    </section>
  );
}
