import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, CalendarClock, Lightbulb, PlayCircle } from "lucide-react";
import { Logo } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Train Comp — האפליקציה של השחקנים התחרותיים" },
      {
        name: "description",
        content:
          "עוקבים אחרי המקומות, הקילים והנקודות בטורנירים, משננים מהלכים מסרטונים קצרים ובונים תוכנית אימון יומית.",
      },
      { property: "og:title", content: "Train Comp — האפליקציה של השחקנים התחרותיים" },
      {
        property: "og:description",
        content: "מעקב טורנירים, סרטוני מהלכים, טיפים ותוכנית אימון יומית לפורטנייט תחרותי.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: BarChart3, title: "מעקב טורנירים", text: "מקום, קילים ונקודות בכל אירוע, עם דוח מצב שמראה אם אתה משתפר." },
  { icon: PlayCircle, title: "אימונים", text: "מעלים סרטון קצר לכל מהלך וחוזרים עליו כל יום עד שהוא נכנס לראש." },
  { icon: Lightbulb, title: "טיפים", text: "משפטים קצרים לטורנירים, וגם הטיפים שאתה כותב לעצמך." },
  { icon: CalendarClock, title: "תוכנית עבודה", text: "המבנה הקבוע של כל יום משחק: חימום, אנד גיים, באטל רויאל." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <Button asChild variant="panel" size="sm">
          <Link to="/auth">התחברות</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="relative overflow-hidden rounded-3xl panel stripes px-6 py-16 sm:px-12 sm:py-24 animate-rise">
          <p className="font-stat text-xs font-bold uppercase tracking-[0.35em] text-accent">
            Competitive Fortnite
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight sm:text-6xl">
            כל טורניר מקרב אותך <span className="text-gradient-primary">לוויקטורי רויאל</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            מקום אחד לך ולחברים מהצוות לעקוב אחרי ההתקדמות, לשנן מהלכים ולהתאמן לפי תוכנית.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to="/dashboard">כניסה לאפליקציה</Link>
            </Button>
            <Button asChild variant="panel" size="xl">
              <Link to="/auth" search={{ mode: "signup" }}>
                פתיחת חשבון
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="panel p-6 animate-rise"
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              <f.icon className="size-7 text-primary" />
              <h2 className="mt-4 text-xl">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
