// Parses the "Epic Events" table on a Fortnite Tracker profile page (markdown from a page scrape).
// Columns: Event | Place | PR Points | Earnings | Roster | Matches | Wins | Elims | K/D

export type TrackerEvent = {
  sourceEventId: string;
  name: string;
  eventDate: string; // yyyy-MM-dd
  placement: number;
  prPoints: number;
  matches: number | null;
  wins: number | null;
  /** Team eliminations as shown by Fortnite Tracker. */
  elims: number;
  mode: "solo" | "duo" | "trio" | "squad";
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function parseTrackerDate(text: string): string | null {
  const m = text.trim().match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[1]!.toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[2]!.padStart(2, "0")}`;
}

function firstNumber(cell: string | undefined): number | null {
  if (!cell) return null;
  const m = cell.replace(/<br>.*$/i, "").match(/-?[\d,]+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Splits a markdown table row on pipes that are not inside [...] or (...). */
function splitRow(row: string): string[] {
  const cells: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]!;
    const prev = row[i - 1];
    if (prev !== "\\" && (ch === "[" || ch === "(")) depth++;
    if (prev !== "\\" && (ch === "]" || ch === ")")) depth = Math.max(0, depth - 1);
    if (ch === "|" && depth === 0) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  // drop the empty cells produced by the leading / trailing pipe
  return cells.slice(1, -1);
}

const MODE_BY_SIZE: Record<number, TrackerEvent["mode"]> = { 1: "solo", 2: "duo", 3: "trio", 4: "squad" };

function parseEventCell(cell: string): { name: string; date: string | null; id: string } | null {
  // [![Event Poster](img)\<br>\<br>Name\<br>\<br>Session 1\<br>\<br>Oct 10, 2026](https://fortnitetracker.com/events/...#123 "description")
  const urlMatch = cell.match(/\]\((https:\/\/fortnitetracker\.com\/events\/[^\s)"]+)/);
  if (!urlMatch) return null;
  const url = urlMatch[1]!;
  const text = cell
    .replace(/!\[[^\]]*\]\(.*?\/image\.\w+\)/, "") // poster image (its URL contains parentheses)
    .replace(/^\[/, "")
    .replace(/\]\(https:\/\/fortnitetracker\.com\/events\/.*$/, "");
  const parts = text
    .split(/\\?<br>/i)
    .map((p) => p.replace(/\\([[\]\\])/g, "$1").trim())
    .filter((p) => p && !p.includes("](") && !p.includes("%2F") && !p.startsWith("!["));
  const dateIndex = parts.findIndex((p) => parseTrackerDate(p) !== null);
  const date = dateIndex >= 0 ? parseTrackerDate(parts[dateIndex]!) : null;
  const titleParts = (dateIndex >= 0 ? parts.slice(0, dateIndex) : parts).filter(Boolean);
  const name = titleParts.join(" · ").replace(/\s+/g, " ").trim() || "טורניר";
  // The event key without the leaderboard page / anchor identifies one session.
  const id = url.replace(/[?&]page=\d+/, "").replace(/#.*$/, "");
  return { name, date, id };
}

export function parseTrackerEvents(markdown: string): TrackerEvent[] {
  const events: TrackerEvent[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("| [") || !line.includes("fortnitetracker.com/events/")) continue;
    const cells = splitRow(line);
    if (cells.length < 9) continue;
    const event = parseEventCell(cells[0]!);
    const placement = firstNumber(cells[1]);
    if (!event || !event.date || !placement || placement < 1) continue;
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const rosterSize = (cells[4]!.match(/\]\(https:\/\/fortnitetracker\.com\/profile\//g) ?? []).length;
    events.push({
      sourceEventId: event.id,
      name: event.name,
      eventDate: event.date,
      placement,
      prPoints: firstNumber(cells[2]) ?? 0,
      matches: firstNumber(cells[5]),
      wins: firstNumber(cells[6]),
      elims: firstNumber(cells[7]) ?? 0,
      mode: MODE_BY_SIZE[rosterSize] ?? "duo",
    });
  }
  return events;
}
