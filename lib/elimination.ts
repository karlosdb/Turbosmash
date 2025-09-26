import { Match, Player, Round } from "./types";

export function cutToTarget(
  players: Player[],
  rounds: Round[],
  targetSize: number
): {
  keepIds: string[];
  eliminatedIds: string[];
} {
  if (targetSize >= players.length) {
    return { keepIds: players.map((p) => p.id), eliminatedIds: [] };
  }
  const ranked = rankForCut(players, rounds);
  const keep = Math.max(0, Math.min(targetSize, ranked.length));
  const keepIds = ranked.slice(0, keep).map((p) => p.id);
  const eliminatedIds = ranked.slice(keep).map((p) => p.id);
  return { keepIds, eliminatedIds };
}

function rankForCut(players: Player[], rounds: Round[]): Player[] {
  const pointDiff: Record<string, number> = {};
  for (const p of players) pointDiff[p.id] = p.pointsFor - p.pointsAgainst;
  // build head-to-head map from completed matches
  const completed: Match[] = rounds.flatMap((r) => r.matches).filter((m) => m.status === "completed");
  const beatMap: Record<string, Record<string, number>> = {}; // a->b wins
  for (const m of completed) {
    const aIds = [m.a1, m.a2];
    const bIds = [m.b1, m.b2];
    const aWon = (m.scoreA ?? 0) > (m.scoreB ?? 0);
    for (const a of aIds) {
      for (const b of bIds) {
        beatMap[a] = beatMap[a] || {};
        beatMap[b] = beatMap[b] || {};
        if (aWon) beatMap[a][b] = (beatMap[a][b] || 0) + 1;
        else beatMap[b][a] = (beatMap[b][a] || 0) + 1;
      }
    }
  }

  const headToHead = (a: Player, b: Player): number => {
    const aWins = beatMap[a.id]?.[b.id] || 0;
    const bWins = beatMap[b.id]?.[a.id] || 0;
    if (aWins === bWins) return 0;
    return aWins > bWins ? -1 : 1; // a ahead if more wins
  };

  // Sort by: point differential desc, then head-to-head, then initial seed
  return [...players].sort((a, b) => {
    const diffA = pointDiff[a.id] || 0;
    const diffB = pointDiff[b.id] || 0;
    if (diffB !== diffA) return diffB - diffA;
    const h2h = headToHead(a, b);
    if (h2h !== 0) return h2h;
    return a.seed - b.seed; // lower seed number is higher rank
  });
}

// Export ranking for use in UI/state decisions (e.g., locking eliminated placements)
export function rankPlayers(players: Player[], rounds: Round[]): Player[] {
  return rankForCut(players, rounds);
}
