import { Match, Player } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function expectedShare(teamRatingA: number, teamRatingB: number): number {
  return 1 / (1 + Math.pow(10, (teamRatingB - teamRatingA) / 400));
}

export function actualShare(pointsA: number, pointsB: number): number {
  const total = pointsA + pointsB;
  if (total <= 0) return 0.5; // guard zero
  return pointsA / total;
}

export function kEff(pointsA: number, pointsB: number, roundIndex: 1 | 2 | 3): number {
  const capRef = roundIndex === 1 ? 21 : 15;
  return 24 * ((pointsA + pointsB) / capRef);
}

export function difficultyAdjustedK(
  avgTeamA: number,
  avgTeamB: number,
  baseK: number
): number {
  const partnerAdj = 1 + clamp((avgTeamB - avgTeamA) / 400, -0.2, 0.2);
  return baseK * partnerAdj;
}

export type EloDeltaResult = {
  deltas: Record<string, number>; // playerId -> delta
  pointsFor: Record<string, number>;
  pointsAgainst: Record<string, number>;
};

export function applyEloForMatch(
  players: Player[],
  match: Required<Pick<Match, "a1" | "a2" | "b1" | "b2" | "roundIndex">> & {
    scoreA: number;
    scoreB: number;
  }
): EloDeltaResult {
  const byId: Record<string, Player> = players.reduce((m, p) => ((m[p.id] = p), m), {} as Record<string, Player>);
  const a1 = byId[match.a1];
  const a2 = byId[match.a2];
  const b1 = byId[match.b1];
  const b2 = byId[match.b2];

  const teamA = (a1.rating + a2.rating) / 2;
  const teamB = (b1.rating + b2.rating) / 2;
  const expectA = expectedShare(teamA, teamB);
  const actualA = actualShare(match.scoreA, match.scoreB);
  const baseK = kEff(match.scoreA, match.scoreB, match.roundIndex);
  const k = difficultyAdjustedK(teamA, teamB, baseK);
  const deltaTeamA = k * (actualA - expectA);
  const deltaTeamB = -deltaTeamA;

  const clampDelta = (d: number) => clamp(d, -40, 40);

  const deltas: Record<string, number> = {
    [a1.id]: clampDelta(deltaTeamA),
    [a2.id]: clampDelta(deltaTeamA),
    [b1.id]: clampDelta(deltaTeamB),
    [b2.id]: clampDelta(deltaTeamB),
  };

  const pointsFor: Record<string, number> = {
    [a1.id]: match.scoreA,
    [a2.id]: match.scoreA,
    [b1.id]: match.scoreB,
    [b2.id]: match.scoreB,
  };
  const pointsAgainst: Record<string, number> = {
    [a1.id]: match.scoreB,
    [a2.id]: match.scoreB,
    [b1.id]: match.scoreA,
    [b2.id]: match.scoreA,
  };

  return { deltas, pointsFor, pointsAgainst };
}


