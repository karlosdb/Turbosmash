import { Match, Player, Round } from "./types";

function uid(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function benchOneIfOdd(players: Player[]): { active: Player[]; benched?: Player } {
  if (players.length % 2 === 0) return { active: players };
  const sorted = [...players].sort((a, b) => {
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed; // fewest games
    const idleA = a.lastPlayedAt ?? 0;
    const idleB = b.lastPlayedAt ?? 0;
    if (idleA !== idleB) return idleA - idleB; // longest idle (older timestamp first)
    if (a.rating !== b.rating) return a.rating - b.rating; // lowest rating
    return b.seed - a.seed; // lastly, lower priority to worse seed (higher number)
  });
  const [benched, ...rest] = sorted;
  return { active: rest, benched };
}

function pairIndicesGreedy<T>(items: T[], cost: (a: T, b: T) => number): [T, T][] {
  const remaining = [...items];
  const pairs: [T, T][] = [];
  while (remaining.length >= 2) {
    let bestI = 0;
    let bestJ = 1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const c = cost(remaining[i], remaining[j]);
        if (c < bestCost) {
          bestCost = c;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const a = remaining.splice(bestI, 1)[0];
    const b = remaining.splice(bestJ - 1, 1)[0];
    pairs.push([a, b]);
  }
  return pairs;
}

function recentPartnersAndOpponents(players: Player[], rounds: Round[], window: number = 2) {
  const recentRounds = rounds.slice(-window);
  const partners: Record<string, Set<string>> = {};
  const opponents: Record<string, Set<string>> = {};
  for (const r of recentRounds) {
    for (const m of r.matches) {
      const a = [m.a1, m.a2];
      const b = [m.b1, m.b2];
      for (const p of a) {
        partners[p] = partners[p] || new Set();
        for (const q of a) if (q !== p) partners[p].add(q);
        opponents[p] = opponents[p] || new Set();
        for (const q of b) opponents[p].add(q);
      }
      for (const p of b) {
        partners[p] = partners[p] || new Set();
        for (const q of b) if (q !== p) partners[p].add(q);
        opponents[p] = opponents[p] || new Set();
        for (const q of a) opponents[p].add(q);
      }
    }
  }
  return { partners, opponents };
}

export function generateRound1(players: Player[]): { round: Round; benched?: Player } {
  const sortedBySeed = [...players].sort((a, b) => a.seed - b.seed);
  const matches: Match[] = [];
  const benchedPlayers: Player[] = [];

  // Helper to build partners/opponents from matches generated so far in this round
  const partners: Record<string, Set<string>> = {};
  const opponents: Record<string, Set<string>> = {};
  const ingestMatches = (ms: Match[]) => {
    for (const m of ms) {
      const a = [m.a1, m.a2];
      const b = [m.b1, m.b2];
      for (const p of a) {
        partners[p] = partners[p] || new Set();
        for (const q of a) if (q !== p) partners[p].add(q);
        opponents[p] = opponents[p] || new Set();
        for (const q of b) opponents[p].add(q);
      }
      for (const p of b) {
        partners[p] = partners[p] || new Set();
        for (const q of b) if (q !== p) partners[p].add(q);
        opponents[p] = opponents[p] || new Set();
        for (const q of a) opponents[p].add(q);
      }
    }
  };

  // Generate 3 games per player inside Round 1
  let courtOffset = 0;
  for (let slot = 0; slot < 3; slot++) {
    const active = [...sortedBySeed];
    // Rotate bench if odd count
    if (active.length % 2 === 1) {
      const idx = slot % active.length;
      const [b] = active.splice(idx, 1);
      if (b) benchedPlayers.push(b);
    }

    if (slot === 0) {
      // Quartile mixing for first set
      const N = active.length;
      const q = Math.ceil(N / 4);
      const Q1 = active.slice(0, q);
      const Q2 = active.slice(q, 2 * q);
      const Q3 = active.slice(2 * q, 3 * q);
      const Q4 = active.slice(3 * q);
      const poolA = shuffle([...Q1]).map((p, i) => [p, Q3[i % Math.max(1, Q3.length)]] as const);
      const poolB = shuffle([...Q2]).map((p, i) => [p, Q4[i % Math.max(1, Q4.length)]] as const);
      const rawPairs = [...poolA, ...poolB].slice(0, Math.floor(active.length / 2));
      const pairSums = rawPairs.map(([p1, p2]) => ({ players: [p1, p2] as const, ratingSum: p1.rating + p2.rating }));
      pairSums.sort((a, b) => a.ratingSum - b.ratingSum);
      const matchPairs: { a: [Player, Player]; b: [Player, Player] }[] = [];
      while (pairSums.length >= 2) {
        const low = pairSums.shift()!;
        let bestIdx = 0;
        let bestGap = Number.POSITIVE_INFINITY;
        for (let i = 0; i < pairSums.length; i++) {
          const gap = Math.abs(pairSums[i].ratingSum - low.ratingSum);
          if (gap < bestGap) {
            bestGap = gap;
            bestIdx = i;
          }
        }
        const high = pairSums.splice(bestIdx, 1)[0];
        matchPairs.push({ a: [low.players[0], low.players[1]], b: [high.players[0], high.players[1]] });
      }
      const ms: Match[] = matchPairs.map((m, idx) => ({
        id: uid("m1"),
        roundIndex: 1,
        court: courtOffset + idx + 1,
        a1: m.a[0].id,
        a2: m.a[1].id,
        b1: m.b[0].id,
        b2: m.b[1].id,
        status: "scheduled",
      }));
      matches.push(...ms);
      ingestMatches(ms);
      courtOffset += ms.length;
    } else {
      // Use cost-based pairing to avoid repeats for subsequent games
      const pairCost = (a: Player, b: Player) => {
        const partnerRepeat = partners[a.id]?.has(b.id) ? 100 : 0;
        const oppRepeat = (opponents[a.id]?.has(b.id) ? 1 : 0) * 5;
        const ratingBalance = 0.5 * Math.abs(a.rating - b.rating);
        return partnerRepeat + oppRepeat + ratingBalance;
      };
      const pairs = pairIndicesGreedy(active, pairCost);
      const pairSums = pairs.map(([p1, p2]) => ({ players: [p1, p2] as [Player, Player], ratingSum: p1.rating + p2.rating }));
      const used: boolean[] = pairSums.map(() => false);
      const ms: Match[] = [];
      for (let i = 0; i < pairSums.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        let bestJ = -1;
        let bestGap = Number.POSITIVE_INFINITY;
        for (let j = i + 1; j < pairSums.length; j++) {
          if (used[j]) continue;
          const gap = Math.abs(pairSums[i].ratingSum - pairSums[j].ratingSum);
          if (gap < bestGap) {
            bestGap = gap;
            bestJ = j;
          }
        }
        if (bestJ === -1) continue;
        used[bestJ] = true;
        const [a1, a2] = pairSums[i].players;
        const [b1, b2] = pairSums[bestJ].players;
        ms.push({
          id: uid("m1"),
          roundIndex: 1,
          court: courtOffset + ms.length + 1,
          a1: a1.id,
          a2: a2.id,
          b1: b1.id,
          b2: b2.id,
          status: "scheduled",
        });
      }
      matches.push(...ms);
      ingestMatches(ms);
      courtOffset += ms.length;
    }
  }

  const round: Round = { index: 1, matches, status: "active" };
  return { round, benched: benchedPlayers[0] };
}

export function generateRoundGeneric(players: Player[], priorRounds: Round[], roundIndex: 2 | 3): { round: Round; benched?: Player; compromises: string[] } {
  const { active, benched } = benchOneIfOdd(players);
  const { partners, opponents } = recentPartnersAndOpponents(active, priorRounds, 2);

  // Pair cost function per spec
  const cost = (a: Player, b: Player) => {
    const largePenalty = 50;
    const small = 3;
    const recentPartner = partners[a.id]?.has(b.id) ? largePenalty : 0;
    const recentOpponentCount = [...(opponents[a.id] || new Set())].includes(b.id) ? 1 : 0;
    const opponentPenalty = small * recentOpponentCount;
    const ratingBalance = 0.5 * Math.abs(a.rating - b.rating);
    const gamesBalance = 0.2 * Math.abs(a.gamesPlayed - b.gamesPlayed);
    return recentPartner + opponentPenalty + ratingBalance + gamesBalance;
  };

  const pairs = pairIndicesGreedy(active, cost);
  // Pair the pairs into matches minimizing team sum gap & repeated opponents
  const pairSums = pairs.map(([p1, p2]) => ({ players: [p1, p2] as [Player, Player], ratingSum: p1.rating + p2.rating }));
  const used: boolean[] = pairSums.map(() => false);
  const matches: Match[] = [];
  const compromises: string[] = [];

  for (let i = 0; i < pairSums.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let bestJ = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let j = i + 1; j < pairSums.length; j++) {
      if (used[j]) continue;
      const [a1, a2] = pairSums[i].players;
      const [b1, b2] = pairSums[j].players;
      const gap = Math.abs(pairSums[i].ratingSum - pairSums[j].ratingSum);
      const opponentRepeats =
        Number(opponents[a1.id]?.has(b1.id)) +
        Number(opponents[a1.id]?.has(b2.id)) +
        Number(opponents[a2.id]?.has(b1.id)) +
        Number(opponents[a2.id]?.has(b2.id));
      const score = gap + opponentRepeats * 5;
      if (score < bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }
    if (bestJ === -1) continue;
    used[bestJ] = true;
    const [pa1, pa2] = pairSums[i].players;
    const [pb1, pb2] = pairSums[bestJ].players;
    const notes: string[] = [];
    if (partners[pa1.id]?.has(pa2.id) || partners[pb1.id]?.has(pb2.id)) notes.push("Repeat partner (unavoidable)");
    const repeatedOpp =
      Number(opponents[pa1.id]?.has(pb1.id)) +
      Number(opponents[pa1.id]?.has(pb2.id)) +
      Number(opponents[pa2.id]?.has(pb1.id)) +
      Number(opponents[pa2.id]?.has(pb2.id));
    if (repeatedOpp > 0) notes.push("Repeat opponents (minimized)");
    matches.push({
      id: uid(roundIndex === 2 ? "m2" : "m3"),
      roundIndex,
      court: matches.length + 1,
      a1: pa1.id,
      a2: pa2.id,
      b1: pb1.id,
      b2: pb2.id,
      status: "scheduled",
      notes,
    });
    compromises.push(...notes);
  }

  const round: Round = { index: roundIndex, matches, status: "active" };
  return { round, benched, compromises };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Mini-round generation for Round 1 batching
export function generateMiniRound(
  players: Player[],
  priorRounds: Round[],
  roundIndex: 1,
  miniSize: number,
  currentMiniRoundIndex: number,
  existingMatchesInRound: Match[],
  courtOffset: number
): { matches: Match[]; compromises: string[] } {
  // Compute per-player games already played in this round (completed)
  const r1Games: Record<string, number> = {};
  for (const m of existingMatchesInRound) {
    if (m.roundIndex !== 1) continue;
    if (m.status !== "completed") continue;
    r1Games[m.a1] = (r1Games[m.a1] || 0) + 1;
    r1Games[m.a2] = (r1Games[m.a2] || 0) + 1;
    r1Games[m.b1] = (r1Games[m.b1] || 0) + 1;
    r1Games[m.b2] = (r1Games[m.b2] || 0) + 1;
  }

  // Select up to miniSize*4 players to play this mini-round, preferring those with fewer R1 games,
  // longer idle (older timestamp), and lower rating
  const capacity = Math.max(0, miniSize) * 4;
  const sortedForPlay = [...players].sort((a, b) => {
    const ga = r1Games[a.id] || 0;
    const gb = r1Games[b.id] || 0;
    if (ga !== gb) return ga - gb; // fewer R1 games first
    const ia = a.lastPlayedAt ?? 0;
    const ib = b.lastPlayedAt ?? 0;
    if (ia !== ib) return ia - ib; // longer idle first (older timestamp)
    if (a.rating !== b.rating) return a.rating - b.rating; // lower rating first
    return a.seed - b.seed; // better seed first
  });

  // Trim to a multiple of 4 and up to capacity
  let active = sortedForPlay.slice(0, capacity);
  const trimToMultipleOf4 = (n: number) => n - (n % 4);
  active = active.slice(0, trimToMultipleOf4(active.length));

  // If capacity is zero or not enough players, return empty
  if (active.length < 4) return { matches: [], compromises: [] };

  // Build partners/opponents set from recent rounds and this round so far
  const recent = recentPartnersAndOpponents(active, [...priorRounds, { index: 1, matches: existingMatchesInRound, status: "active" } as Round], 2);
  const partners = recent.partners;
  const opponents = recent.opponents;

  // Pair cost emphasizing avoiding repeat partners, then balance ratings
  const pairCost = (a: Player, b: Player) => {
    const partnerRepeat = partners[a.id]?.has(b.id) ? 100 : 0;
    const oppRepeat = (opponents[a.id]?.has(b.id) ? 1 : 0) * 5;
    const ratingBalance = 0.5 * Math.abs(a.rating - b.rating);
    return partnerRepeat + oppRepeat + ratingBalance;
  };

  const pairs = pairIndicesGreedy(active, pairCost);
  const pairSums = pairs.map(([p1, p2]) => ({ players: [p1, p2] as [Player, Player], ratingSum: p1.rating + p2.rating }));
  const used: boolean[] = pairSums.map(() => false);
  const matches: Match[] = [];
  const compromises: string[] = [];

  for (let i = 0; i < pairSums.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let bestJ = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let j = i + 1; j < pairSums.length; j++) {
      if (used[j]) continue;
      const [a1, a2] = pairSums[i].players;
      const [b1, b2] = pairSums[j].players;
      const gap = Math.abs(pairSums[i].ratingSum - pairSums[j].ratingSum);
      const opponentRepeats =
        Number(opponents[a1.id]?.has(b1.id)) +
        Number(opponents[a1.id]?.has(b2.id)) +
        Number(opponents[a2.id]?.has(b1.id)) +
        Number(opponents[a2.id]?.has(b2.id));
      const score = gap + opponentRepeats * 5;
      if (score < bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }
    if (bestJ === -1) continue;
    used[bestJ] = true;
    const [pa1, pa2] = pairSums[i].players;
    const [pb1, pb2] = pairSums[bestJ].players;
    const notes: string[] = [];
    if (partners[pa1.id]?.has(pa2.id) || partners[pb1.id]?.has(pb2.id)) notes.push("Repeat partner (unavoidable)");
    const repeatedOpp =
      Number(opponents[pa1.id]?.has(pb1.id)) +
      Number(opponents[pa1.id]?.has(pb2.id)) +
      Number(opponents[pa2.id]?.has(pb1.id)) +
      Number(opponents[pa2.id]?.has(pb2.id));
    if (repeatedOpp > 0) notes.push("Repeat opponents (minimized)");
    matches.push({
      id: uid("m1"),
      roundIndex,
      court: courtOffset + matches.length + 1,
      miniRound: currentMiniRoundIndex + 1,
      a1: pa1.id,
      a2: pa2.id,
      b1: pb1.id,
      b2: pb2.id,
      status: "scheduled",
      notes,
    });
    compromises.push(...notes);
    if (matches.length >= miniSize) break; // only up to miniSize matches
  }

  // Fallback: if no matches created (should be rare), pair sequentially
  if (matches.length === 0 && pairSums.length >= 2) {
    const indices = pairSums.map((_, i) => i);
    for (let k = 0; k + 1 < indices.length && matches.length < miniSize; k += 2) {
      const [pa1, pa2] = pairSums[indices[k]].players;
      const [pb1, pb2] = pairSums[indices[k + 1]].players;
      const notes: string[] = [];
      if (partners[pa1.id]?.has(pa2.id) || partners[pb1.id]?.has(pb2.id)) notes.push("Repeat partner (unavoidable)");
      matches.push({
        id: uid("m1"),
        roundIndex,
        court: courtOffset + matches.length + 1,
        miniRound: currentMiniRoundIndex + 1,
        a1: pa1.id,
        a2: pa2.id,
        b1: pb1.id,
        b2: pb2.id,
        status: "scheduled",
        notes,
      });
      compromises.push(...notes);
    }
  }

  return { matches, compromises };
}


