import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Quote, Shuffle, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { tipsQuery } from "@/lib/queries";
import { BUILT_IN_TIPS, TIP_CATEGORIES, tipOfTheDay, type Tip } from "@/lib/tips";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tips")({
  head: () => ({
    meta: [
      { title: "טיפים לטורנירים — Train Comp" },
      { name: "description", content: "טיפים מחזקים ומשפטים לזכור לפני ובמהלך טורנירים." },
      { property: "og:title", content: "טיפים לטורנירים — Train Comp" },
      { property: "og:description", content: "טיפים מחזקים לטורנירי פורטנייט." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(tipsQuery),
  component: TipsPage,
});

const MY_TIPS = "הטיפים שלי";

function TipsPage() {
  const { data: myTips } = useSuspenseQuery(tipsQuery);
  const [featured, setFeatured] = useState<Tip>(() => tipOfTheDay());
  const [filter, setFilter] = useState<string>("הכל");

  const allTips: Tip[] = [
    ...myTips.map((t) => ({ category: t.category, text: t.content })),
    ...BUILT_IN_TIPS,
  ];

  function shuffle() {
    let next = featured;
    while (allTips.length > 1 && next.text === featured.text) {
      next = allTips[Math.floor(Math.random() * allTips.length)] ?? featured;
    }
    setFeatured(next);
  }

  const categories = ["הכל", MY_TIPS, ...TIP_CATEGORIES];
  const builtIn = filter === "הכל" ? BUILT_IN_TIPS : BUILT_IN_TIPS.filter((t) => t.category === filter);
  const showMine = filter === "הכל" || filter === MY_TIPS;

  return (
    <div>
      <PageHeader
        eyebrow="Tips"
        title="טיפים לטורנירים"
        description="משפטים קצרים שכדאי לקרוא לפני טורניר. אפשר להוסיף גם טיפים משלך."
      />

      <section className="panel stripes relative overflow-hidden p-8 sm:p-10 animate-rise">
        <Quote className="absolute end-6 top-6 size-16 text-primary/15" />
        <p className="text-xs font-semibold text-accent">{featured.category}</p>
        <p className="mt-3 max-w-3xl font-display text-2xl leading-snug sm:text-3xl">{featured.text}</p>
        <Button variant="panel" className="mt-6" onClick={shuffle}>
          <Shuffle /> טיפ אחר
        </Button>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((c) => (
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

      {showMine && <MyTips />}

      {filter !== MY_TIPS && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builtIn.map((t) => (
            <div key={t.text} className="panel p-5 animate-rise">
              <p className="text-xs text-accent">{t.category}</p>
              <p className="mt-2">{t.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyTips() {
  const queryClient = useQueryClient();
  const { data: myTips } = useSuspenseQuery(tipsQuery);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>(TIP_CATEGORIES[0]);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tips").insert({ content: text.trim(), category });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["tips"] });
    },
    onError: () => toast.error("השמירה נכשלה"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tips"] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) add.mutate();
  }

  return (
    <section className="panel mt-6 p-6 animate-rise">
      <h2 className="text-xl">{MY_TIPS}</h2>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="משפט שאתה רוצה לזכור בטורניר הבא..."
          rows={2}
          className="flex-1"
        />
        <div className="flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIP_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="hero" disabled={add.isPending || !text.trim()}>
            <Plus /> הוספה
          </Button>
        </div>
      </form>
      {myTips.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">עוד לא הוספת טיפים משלך.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {myTips.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg bg-secondary/60 px-4 py-3">
              <div>
                <p className="text-xs text-accent">{t.category}</p>
                <p>{t.content}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="מחיקת טיפ" onClick={() => remove.mutate(t.id)}>
                <Trash2 className="text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
