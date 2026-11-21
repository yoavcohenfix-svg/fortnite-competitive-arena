// Live-tournament math: how many points are still missing and which per-match results reach the target.
// Scoring follows Epic's tournament rules: every placement tier you are inside of adds its points
// (placement <= tier), and every elimination tier you reach adds its points (elims >= tier).

export type Tier = { key: number; points: number };
export type Scoring = { placement: Tier[]; elims: Tier[] };

/** Typical cup scoring (win 60, 2nd 50, 4th 40, top 15 = 3, 2 points per elim up to 10). Used until the event's own rules load. */
export const DEFAULT_SCORING: Scoring = {
  placement: [
    { key: 1, points: 10 },
    ...[2, 3, 4, 5].map((key) => ({ key, points: 5 })),
    ...Array.from({ length: 10 }, (_, i) => ({ key: i + 6, points: 3 })),
  ],
  elims: Array.from({ length: 10 }, (_, i) => ({ key: i + 1, points: 2 })),
};

export function placementPoints(scoring: Scoring, place: number | null): number {
  if (place === null) return 0;
  return scoring.placement.filter((t) => place <= t.key).reduce((sum, t) => sum + t.points, 0);
}

export function elimPoints(scoring: Scoring, elims: number): number {
  return scoring.elims.filter((t) => elims >= t.key).reduce((sum, t) => sum + t.points, 0);
}

/** Highest elimination count that still earns points (elims above it add nothing). */
export function elimCap(scoring: Scoring): number {
  return scoring.elims.reduce((max, t) => Math.max(max, t.key), 0);
}

export function maxPointsPerMatch(scoring: Scoring): number {
  return placementPoints(scoring, 1) + elimPoints(scoring, elimCap(scoring));
}

export type Progress = {
  missing: number;
  matchesLeft: number;
  /** Average points needed in each remaining match; null when no matches are left. */
  perMatch: number | null;
  reached: boolean;
  /** False when even a win with max elims in every remaining match is not enough. */
  possible: boolean;
};

export function progress(input: {
  target: number;
  current: number;
  matchesPlayed: number;
  matchCap: number;
  scoring: Scoring;
}): Progress {
  const missing = Math.max(0, input.target - input.current);
  const matchesLeft = Math.max(0, input.matchCap - input.matchesPlayed);
  const reached = missing === 0;
  const perMatch = matchesLeft > 0 ? missing / matchesLeft : null;
  const possible = reached || (perMatch !== null && perMatch <= maxPointsPerMatch(input.scoring));
  return { missing, matchesLeft, perMatch, reached, possible };
}

export type Way = {
  /** null = outside every placement tier (points only from elims). */
  place: number | null;
  placePoints: number;
  /** Elims needed on top of the placement; null when this placement cannot reach the target. */
  kills: number | null;
};

const MILESTONES = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100];

/** Placements worth showing for this scoring: common milestones inside the scoring tiers, plus "no placement points". */
export function wayPlaces(scoring: Scoring): (number | null)[] {
  const keys = new Set(scoring.placement.map((t) => t.key));
  const last = Math.max(0, ...keys);
  const places = MILESTONES.filter((p) => p <= last && (keys.has(p) || p === 1));
  if (last > 0 && !places.includes(last)) places.push(last);
  return [...places, null];
}

/** For each placement: the fewest elims that reach `needed` points in one match. */
export function waysToReach(scoring: Scoring, needed: number): Way[] {
  const target = Math.ceil(needed);
  const cap = elimCap(scoring);
  return wayPlaces(scoring).map((place) => {
    const placePoints = placementPoints(scoring, place);
    let kills: number | null = null;
    for (let k = 0; k <= cap; k++) {
      if (placePoints + elimPoints(scoring, k) >= target) {
        kills = k;
        break;
      }
    }
    return { place, placePoints, kills };
  });
}
