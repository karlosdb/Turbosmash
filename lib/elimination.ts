import { EventState, Match, Player } from "./types";

export function cutSizeAfterR1(total: number): number {
  const minKeep = 6;
  const keep = Math.max(minKeep, total - Math.ceil(total / 4));
  return keep % 2 === 0 ? keep : keep - 1; // ensure even
}

export function cutAfterR1(players: Player[], rounds: EventState["rounds"]): {
  keepIds: string[];
  eliminatedIds: string[];
} {
  const keep = cutSizeAfterR1(players.length);
  const ranked = rankForCut(players, rounds);
  const keepIds = ranked.slice(0, keep).map((p) => p.id);
  const eliminatedIds = ranked.slice(keep).map((p) => p.id);
  return { keepIds, eliminatedIds };
}

export function cutAfterR2ToFinalFour(players: Player[], rounds: EventState["rounds"]): {
  keepIds: string[];
  eliminatedIds: string[];
} {
  const ranked = rankForCut(players, rounds);
  const keepIds = ranked.slice(0, 4).map((p) => p.id);
  const eliminatedIds = ranked.slice(4).map((p) => p.id);
  return { keepIds, eliminatedIds };
}

function rankForCut(players: Player[], rounds: EventState["rounds"]): Player[] {
  const pointDiff: Record<string, number> = {};
  for (const p of players) pointDiff[p.id] = p.pointsFor - p.pointsAgainst;
  // build head-to-head map from completed matches
  const completed: Match[] = rounds.flatMap((r) => r.matches).filter((m) => m.status === "completed");
  const beatMap: Record<string, Record<string, number>> = {}; // a->b wins
  const scoreMap: Record<string, Record<string, { for: number; against: number }>> = {};
  for (const m of completed) {
    const aIds = [m.a1, m.a2];
    const bIds = [m.b1, m.b2];
    const aWon = (m.scoreA ?? 0) > (m.scoreB ?? 0);
    for (const a of aIds) {
      for (const b of bIds) {
        beatMap[a] = beatMap[a] || {};
        beatMap[b] = beatMap[b] || {};
        scoreMap[a] = scoreMap[a] || {};
        scoreMap[b] = scoreMap[b] || {};
        scoreMap[a][b] = scoreMap[a][b] || { for: 0, against: 0 };
        scoreMap[b][a] = scoreMap[b][a] || { for: 0, against: 0 };
        scoreMap[a][b].for += m.scoreA ?? 0;
        scoreMap[a][b].against += m.scoreB ?? 0;
        scoreMap[b][a].for += m.scoreB ?? 0;
        scoreMap[b][a].against += m.scoreA ?? 0;
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

  // Sort by: current rating desc, then point differential desc, then head-to-head, then higher initial seed (lower number)
  return [...players].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    const diffA = pointDiff[a.id] || 0;
    const diffB = pointDiff[b.id] || 0;
    if (diffB !== diffA) return diffB - diffA;
    const h2h = headToHead(a, b);
    if (h2h !== 0) return h2h;
    return a.seed - b.seed; // lower seed number is higher rank
  });
}

// Export ranking for use in UI/state decisions (e.g., locking eliminated placements)
export function rankPlayers(players: Player[], rounds: EventState["rounds"]): Player[] {
  return rankForCut(players, rounds);
}


