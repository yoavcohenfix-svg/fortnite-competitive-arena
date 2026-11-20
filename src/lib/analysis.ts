// Pure tournament-performance analysis. No I/O, so it is easy to test.

export type TournamentResult = {
  id: string;
  name: string;
  event_date: string;
  mode: string;
  placement: number;
  kills: number;
  points: number;
  matches_played: number | null;
};

/** "up" = getting better, "down" = getting worse (already accounts for lower-is-better metrics). */
export type Trend = "up" | "down" | "flat" | "none";

export type WindowComparison = {
  recent: number;
  previous: number;
  /** Relative change of the raw value, e.g. 0.25 = +25%. */
  change: number;
  trend: Trend;
};

/** Changes smaller than this (relative) count as "flat". */
export const FLAT_THRESHOLD = 0.05;

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function sortByDate<T extends { event_date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.event_date.localeCompare(b.event_date));
}

/**
 * Compares the most recent events with the same number of events just before them.
 * Window = min(maxWindow, floor(n / 2)) so both sides always have the same size.
 */
export function compareWindows(
  values: number[],
  higherIsBetter: boolean,
  maxWindow = 3,
): WindowComparison {
  const k = Math.min(maxWindow, Math.floor(values.length / 2));
  if (k < 1) return { recent: values.at(-1) ?? 0, previous: 0, change: 0, trend: "none" };
  const recent = mean(values.slice(-k));
  const previous = mean(values.slice(-2 * k, -k));
  const change = previous === 0 ? (recent === 0 ? 0 : 1) : (recent - previous) / previous;
  let trend: Trend = "flat";
  if (Math.abs(change) >= FLAT_THRESHOLD) {
    const improved = higherIsBetter ? change > 0 : change < 0;
    trend = improved ? "up" : "down";
  }
  return { recent, previous, change, trend };
}

/**
 * Consistency 0-100 from placements: 100 means the same placement every event.
 * Uses the coefficient of variation (std / mean). Needs at least 2 events.
 */
export function consistencyScore(placements: number[]): number | null {
  if (placements.length < 2) return null;
  const m = mean(placements);
  if (m === 0) return null;
  const cv = stdDev(placements) / m;
  return Math.round(Math.max(0, Math.min(100, 100 - cv * 100)));
}

export type Summary = {
  count: number;
  avgPlacement: number;
  bestPlacement: number | null;
  avgKills: number;
  totalKills: number;
  bestKills: number;
  avgPoints: number;
  killsPerMatch: number | null;
  consistency: number | null;
  placement: WindowComparison;
  kills: WindowComparison;
  points: WindowComparison;
};

export function summarize(rows: TournamentResult[]): Summary {
  const sorted = sortByDate(rows);
  const placements = sorted.map((r) => r.placement);
  const kills = sorted.map((r) => r.kills);
  const points = sorted.map((r) => r.points);
  const withMatches = sorted.filter((r) => (r.matches_played ?? 0) > 0);
  const totalMatches = withMatches.reduce((a, r) => a + (r.matches_played ?? 0), 0);
  return {
    count: sorted.length,
    avgPlacement: mean(placements),
    bestPlacement: placements.length ? Math.min(...placements) : null,
    avgKills: mean(kills),
    totalKills: kills.reduce((a, b) => a + b, 0),
    bestKills: kills.length ? Math.max(...kills) : 0,
    avgPoints: mean(points),
    killsPerMatch:
      totalMatches > 0 ? withMatches.reduce((a, r) => a + r.kills, 0) / totalMatches : null,
    consistency: consistencyScore(placements),
    placement: compareWindows(placements, false),
    kills: compareWindows(kills, true),
    points: compareWindows(points, true),
  };
}

const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;

/** Plain-language Hebrew status report built from a summary. */
export function buildReport(s: Summary): string[] {
  if (s.count === 0) return ["עוד אין טורנירים. הוסף את התוצאה הראשונה שלך כדי לקבל דוח מצב."];
  if (s.count < 2)
    return [
      `יש טורניר אחד במעקב: מקום ${s.bestPlacement}, ${s.avgKills} קילים.`,
      "הוסף עוד טורניר אחד לפחות כדי לראות אם יש מגמת שיפור.",
    ];
  const lines: string[] = [];
  const p = s.placement;
  if (p.trend === "up")
    lines.push(
      `המיקום משתפר: ממוצע ${Math.round(p.recent)} בטורנירים האחרונים לעומת ${Math.round(p.previous)} לפני כן (שיפור של ${pct(p.change)}).`,
    );
  else if (p.trend === "down")
    lines.push(
      `המיקום ירד: ממוצע ${Math.round(p.recent)} לעומת ${Math.round(p.previous)} לפני כן. בדוק החלטות רוטציה וסוף משחק.`,
    );
  else lines.push(`המיקום יציב סביב ${Math.round(p.recent)}.`);

  const k = s.kills;
  if (k.trend === "up")
    lines.push(`הקילים בעלייה: ${k.recent.toFixed(1)} בממוצע לעומת ${k.previous.toFixed(1)} (+${pct(k.change)}). הסקיל האישי בקרבות משתפר.`);
  else if (k.trend === "down")
    lines.push(`הקילים ירדו: ${k.recent.toFixed(1)} בממוצע לעומת ${k.previous.toFixed(1)}. כדאי להוסיף אימוני קרבות ובוקס-פייטים.`);
  else lines.push(`הקילים יציבים: בערך ${k.recent.toFixed(1)} לטורניר.`);

  const pt = s.points;
  if (pt.trend === "up") lines.push(`הנקודות בעלייה (+${pct(pt.change)}). אתה בכיוון הנכון.`);
  else if (pt.trend === "down") lines.push(`הנקודות ירדו (-${pct(pt.change)}) לעומת התקופה הקודמת.`);

  if (s.consistency !== null) {
    if (s.consistency >= 70) lines.push(`קונסיסטנטיות גבוהה (${s.consistency}/100). אתה מגיע לתוצאות דומות כל פעם.`);
    else if (s.consistency >= 40) lines.push(`קונסיסטנטיות בינונית (${s.consistency}/100). יש טורנירים טובים ויש חלשים יותר.`);
    else lines.push(`קונסיסטנטיות נמוכה (${s.consistency}/100). התוצאות קופצות הרבה. נסה לשמור על אותו פלאן משחק בכל טורניר.`);
  }
  return lines;
}
