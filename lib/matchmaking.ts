import { Match, Player, Round, SchedulePrefs } from "./types";
import { matchesNeeded, wavesNeeded } from "./scheduling";
import { blended } from "./seeding";

function uid(prefix: string = "m"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

type History = {
  partners: Map<string, Set<string>>;
  opponents: Map<string, Set<string>>;
};

function ensure(map: Map<string, Set<string>>, key: string) {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key)!;
}

function buildHistory(matches: Match[]): History {
  const partners = new Map<string, Set<string>>();
  const opponents = new Map<string, Set<string>>();
  for (const match of matches) {
    const teamA = [match.a1, match.a2];
    const teamB = [match.b1, match.b2];
    for (const id of teamA) {
      const mates = ensure(partners, id);
      for (const mate of teamA) if (mate !== id) mates.add(mate);
      const foes = ensure(opponents, id);
      for (const foe of teamB) foes.add(foe);
    }
    for (const id of teamB) {
      const mates = ensure(partners, id);
      for (const mate of teamB) if (mate !== id) mates.add(mate);
      const foes = ensure(opponents, id);
      for (const foe of teamA) foes.add(foe);
    }
  }
  return { partners, opponents };
}


function cloneHistory(history: History): History {
  const partners = new Map<string, Set<string>>();
  const opponents = new Map<string, Set<string>>();
  for (const [id, set] of history.partners.entries()) partners.set(id, new Set(set));
  for (const [id, set] of history.opponents.entries()) opponents.set(id, new Set(set));
  return { partners, opponents };
}

function applyMatchToHistory(history: History, match: Match) {
  const teamA = [match.a1, match.a2];
  const teamB = [match.b1, match.b2];
  for (const id of teamA) {
    const mates = ensure(history.partners, id);
    for (const mate of teamA) if (mate !== id) mates.add(mate);
    const foes = ensure(history.opponents, id);
    for (const foe of teamB) foes.add(foe);
  }
  for (const id of teamB) {
    const mates = ensure(history.partners, id);
    for (const mate of teamB) if (mate !== id) mates.add(mate);
    const foes = ensure(history.opponents, id);
    for (const foe of teamA) foes.add(foe);
  }
}

function waveBeta(waveIndex: number) {
  if (waveIndex === 1) return 0;
  if (waveIndex === 2) return 0.4;
  return 0.7;
}

function playerBlend(player: Player, beta: number) {
  const prior = player.seedPrior ?? 1000;
  return blended(player.rating, prior, beta);
}

function selectPlayersForWave(players: Player[], count: number, beta: number) {
  if (count >= players.length) return [...players];
  const sorted = [...players].sort((a, b) => {
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
    const idleA = a.lastPlayedAt ?? 0;
    const idleB = b.lastPlayedAt ?? 0;
    if (idleA !== idleB) return idleA - idleB;
    const blendA = playerBlend(a, beta);
    const blendB = playerBlend(b, beta);
    if (blendA !== blendB) return blendA - blendB;
    return a.seed - b.seed;
  });
  return sorted.slice(0, count);
}

function computeWaveSizes(totalMatches: number, courts: number) {
  if (totalMatches <= 0) return [];
  const waves = Math.max(1, wavesNeeded(totalMatches, courts));
  const base = Math.floor(totalMatches / waves);
  const extra = totalMatches % waves;
  const sizes: number[] = [];
  for (let i = 0; i < waves; i++) {
    let size = base + (i < extra ? 1 : 0);
    size = Math.min(size, courts);
    if (size <= 0) size = 1;
    sizes.push(size);
  }
  let assigned = sizes.reduce((acc, v) => acc + v, 0);
  let idx = sizes.length - 1;
  while (assigned > totalMatches && idx >= 0) {
    if (sizes[idx] > 1) {
      sizes[idx] -= 1;
      assigned -= 1;
    } else {
      idx -= 1;
    }
  }
  return sizes.filter((s) => s > 0);
}



function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function teamCompromise(teamA: [Player, Player], teamB: [Player, Player], history: History) {
  const partnerRepeat =
    history.partners.get(teamA[0].id)?.has(teamA[1].id) || history.partners.get(teamB[0].id)?.has(teamB[1].id);
  if (partnerRepeat) return "repeat-partner" as const;
  let opponentRepeat = false;
  for (const player of teamA) {
    const seen = history.opponents.get(player.id);
    if (seen && (seen.has(teamB[0].id) || seen.has(teamB[1].id))) {
      opponentRepeat = true;
      break;
    }
  }
  if (opponentRepeat) return "repeat-opponent" as const;
  const gap = Math.abs(teamA[0].rating + teamA[1].rating - (teamB[0].rating + teamB[1].rating));
  if (gap > 80) return "rating-gap" as const;
  return undefined;
}

type PairMeta = {
  players: [Player, Player];
  blendSum: number;
  partnerRepeat: boolean;
};

function buildPairs(metas: { player: Player; blend: number; tier: number }[], history: History): PairMeta[] {
  const remaining = [...metas];
  const pairs: PairMeta[] = [];
  while (remaining.length >= 2) {
    let bestI = 0;
    let bestJ = 1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const cost = pairCost(remaining[i], remaining[j], history);
        if (cost < bestCost) {
          bestCost = cost;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const metaA = remaining.splice(bestI, 1)[0];
    const metaB = remaining.splice(bestJ - 1, 1)[0];
    pairs.push({
      players: [metaA.player, metaB.player],
      blendSum: metaA.blend + metaB.blend,
      partnerRepeat: history.partners.get(metaA.player.id)?.has(metaB.player.id) ?? false,
    });
  }
  return pairs;
}

function pairCost(a: { player: Player; blend: number; tier: number }, b: { player: Player; blend: number; tier: number }, history: History) {
  const tierDistance = Math.abs(a.tier - b.tier);
  const tierPenalty = tierDistance === 0 ? 0 : tierDistance === 1 ? 25 : 250;
  const partnerPenalty = history.partners.get(a.player.id)?.has(b.player.id) ? 5_000 : 0;
  const ratingPenalty = Math.abs(a.blend - b.blend);
  return partnerPenalty + tierPenalty + ratingPenalty;
}


function selectPlayersForBalancedRound(
  players: Player[],
  gamesAllocated: Map<string, number>,
  beta: number
) {
  const sorted = [...players].sort((a, b) => {
    const ga = gamesAllocated.get(a.id) ?? 0;
    const gb = gamesAllocated.get(b.id) ?? 0;
    if (ga !== gb) return ga - gb;
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
    const idleA = a.lastPlayedAt ?? 0;
    const idleB = b.lastPlayedAt ?? 0;
    if (idleA !== idleB) return idleA - idleB;
    const blendA = playerBlend(a, beta);
    const blendB = playerBlend(b, beta);
    if (blendA !== blendB) return blendA - blendB;
    return a.seed - b.seed;
  });
  return sorted.slice(0, 4);
}

function bestTeamsForPlayers(players: Player[], history: History, beta: number) {
  if (players.length < 4) return null;
  const sorted = [...players].sort((a, b) => playerBlend(a, beta) - playerBlend(b, beta));
  const [p1, p2, p3, p4] = sorted;
  const combos: [[Player, Player], [Player, Player]][] = [
    [[p1, p2], [p3, p4]],
    [[p1, p3], [p2, p4]],
    [[p1, p4], [p2, p3]],
  ];
  let best = combos[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const combo of combos) {
    const [teamA, teamB] = combo;
    const partnerPenalty = teamPartnerPenalty(teamA, history) + teamPartnerPenalty(teamB, history);
    const opponentRepeats = countOpponentRepeats(teamA, teamB, history);
    const ratingGap = Math.abs(sumRatings(teamA) - sumRatings(teamB));
    const score = partnerPenalty * 120 + opponentRepeats * 60 + ratingGap;
    if (score < bestScore) {
      bestScore = score;
      best = combo;
    }
  }
  const [teamA, teamB] = best;
  return {
    teamA,
    teamB,
    compromise: teamCompromise(teamA, teamB, history),
  };
}

function teamPartnerPenalty(team: [Player, Player], history: History) {
  return history.partners.get(team[0].id)?.has(team[1].id) ? 1 : 0;
}


function matchCost(a: PairMeta, b: PairMeta, history: History) {
  const ratingGap = Math.abs(a.blendSum - b.blendSum);
  const opponentPenalty = countOpponentRepeats(a.players, b.players, history) * 40;
  const partnerPenalty = (a.partnerRepeat ? 120 : 0) + (b.partnerRepeat ? 120 : 0);
  return ratingGap + opponentPenalty + partnerPenalty;
}

function evaluateCompromise(a: PairMeta, b: PairMeta, history: History) {
  if (a.partnerRepeat || b.partnerRepeat) return "repeat-partner" as const;
  if (countOpponentRepeats(a.players, b.players, history) > 0) return "repeat-opponent" as const;
  const gap = Math.abs(sumRatings(a.players) - sumRatings(b.players));
  if (gap > 80) return "rating-gap" as const;
  return undefined;
}

function countOpponentRepeats(teamA: [Player, Player], teamB: [Player, Player], history: History) {
  let count = 0;
  for (const a of teamA) {
    const seen = history.opponents.get(a.id);
    if (!seen) continue;
    if (seen.has(teamB[0].id)) count++;
    if (seen.has(teamB[1].id)) count++;
  }
  return count;
}

function sumRatings(team: [Player, Player]) {
  return team[0].rating + team[1].rating;
}

// Pair the PairMeta list into matches minimizing rating gap and repeats.
function pairTeamsForWave(pairs: PairMeta[], history: History): { teams: [[Player, Player], [Player, Player]]; compromise?: "repeat-partner" | "repeat-opponent" | "rating-gap" }[] {
  const remaining = [...pairs];
  const matches: { teams: [[Player, Player], [Player, Player]]; compromise?: "repeat-partner" | "repeat-opponent" | "rating-gap" }[] = [];
  while (remaining.length >= 2) {
    let bestI = 0;
    let bestJ = 1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const cost = matchCost(remaining[i], remaining[j], history);
        if (cost < best) {
          best = cost;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const a = remaining.splice(bestI, 1)[0];
    const b = remaining.splice(bestJ - 1, 1)[0];
    matches.push({
      teams: [a.players, b.players],
      compromise: evaluateCompromise(a, b, history),
    });
  }
  return matches;
}

function mergeHistory(...histories: History[]): History {
  const partners = new Map<string, Set<string>>();
  const opponents = new Map<string, Set<string>>();
  for (const h of histories) {
    for (const [id, set] of h.partners.entries()) {
      const dest = partners.get(id) ?? new Set<string>();
      for (const v of set) dest.add(v);
      partners.set(id, dest);
    }
    for (const [id, set] of h.opponents.entries()) {
      const dest = opponents.get(id) ?? new Set<string>();
      for (const v of set) dest.add(v);
      opponents.set(id, dest);
    }
  }
  return { partners, opponents };
}

function createWave1Matches(players: Player[], waveIndex: number, history: History) {
  const sorted = [...players].sort((a, b) => a.seed - b.seed);
  const matches: Match[] = [];
  const blocks = chunk(sorted, 4);
  blocks.forEach((block, idx) => {
    if (block.length < 4) return;
    const [p1, p2, p3, p4] = block;
    const teamA: [Player, Player] = [p1, p4];
    const teamB: [Player, Player] = [p2, p3];
    matches.push({
      id: uid(`r1w${waveIndex}`),
      roundIndex: 1,
      miniRoundIndex: waveIndex,
      court: idx + 1,
      a1: teamA[0].id,
      a2: teamA[1].id,
      b1: teamB[0].id,
      b2: teamB[1].id,
      status: "scheduled",
      compromise: teamCompromise(teamA, teamB, history),
    });
  });
  return matches;
}

function createAdaptiveWaveMatches(players: Player[], waveIndex: number, history: History): Match[] {
  const beta = waveBeta(waveIndex);
  const sorted = [...players].sort((a, b) => playerBlend(a, beta) - playerBlend(b, beta));
  const metas = sorted.map((player, idx) => ({
    player,
    blend: playerBlend(player, beta),
    tier: Math.floor(idx / 4),
  }));
  const pairs = buildPairs(metas, history);
  const grouped = pairTeamsForWave(pairs, history);
  return grouped.map((g, idx) => {
    const m: Match = {
      id: uid(`r1w${waveIndex}`),
      roundIndex: 1,
      miniRoundIndex: waveIndex,
      court: idx + 1,
      a1: g.teams[0][0].id,
      a2: g.teams[0][1].id,
      b1: g.teams[1][0].id,
      b2: g.teams[1][1].id,
      status: "scheduled",
      compromise: g.compromise,
    };
    return m;
  });
}

export function prepareRound1(players: Player[], prefs: SchedulePrefs): Round {
  const totalMatches = matchesNeeded(players.length, 1);
  const derivedCourts = Math.max(1, Math.floor(players.length / 4));
  const waveSizes = computeWaveSizes(totalMatches, derivedCourts);
  return {
    index: 1,
    matches: [],
    status: "active",
    currentWave: 0,
    totalWaves: waveSizes.length,
    waveSizes,
  };
}

export function generateR1Wave(
  waveIndex: number,
  players: Player[],
  round: Round,
  priorRounds: Round[]
): { matches: Match[]; benched: Player[] } {
  const waveSize = round.waveSizes?.[waveIndex - 1] ?? 0;
  if (waveSize <= 0) return { matches: [], benched: [] };
  const beta = waveBeta(waveIndex);
  const playerCount = Math.min(players.length, waveSize * 4);
  const wavePlayers = selectPlayersForWave(players, playerCount, beta);
  const waveSet = new Set(wavePlayers.map((p) => p.id));
  const benched = players.filter((p) => !waveSet.has(p.id));
  const history = mergeHistory(buildHistory(round.matches), buildHistory(priorRounds.flatMap((r) => r.matches)));
  let matches: Match[];
  if (waveIndex === 1) {
    matches = createWave1Matches(wavePlayers, waveIndex, history);
  } else {
    matches = createAdaptiveWaveMatches(wavePlayers, waveIndex, history);
  }
  matches = matches.slice(0, waveSize);
  matches.forEach((m, idx) => {
    m.court = (idx % Math.max(1, waveSize)) + 1;
  });
  return { matches, benched };
}

function generateFinalFour(players: Player[]): Match[] {
  if (players.length !== 4) return [];
  const sorted = [...players].sort((a, b) => a.seed - b.seed);
  const combos: [[Player, Player], [Player, Player]][] = [
    [[sorted[0], sorted[1]], [sorted[2], sorted[3]]],
    [[sorted[0], sorted[2]], [sorted[1], sorted[3]]],
    [[sorted[0], sorted[3]], [sorted[1], sorted[2]]],
  ];
  return combos.map((teams, idx) => ({
    id: uid("r3"),
    roundIndex: 3,
    miniRoundIndex: idx + 1,
    court: idx + 1,
    a1: teams[0][0].id,
    a2: teams[0][1].id,
    b1: teams[1][0].id,
    b2: teams[1][1].id,
    status: "scheduled",
  }));
}

export function generateLaterRound(
  players: Player[],
  priorRounds: Round[],
  roundIndex: 2 | 3,
  courts: number
): Match[] {
  if (roundIndex === 3 && players.length === 4) {
    return generateFinalFour(players);
  }
  const totalMatches = matchesNeeded(players.length, roundIndex);
  if (totalMatches <= 0) return [];
  const history = mergeHistory(...priorRounds.map((r) => buildHistory(r.matches)));
  const beta = roundIndex === 2 ? 0.7 : 0.8;
  const metas = [...players]
    .sort((a, b) => playerBlend(a, beta) - playerBlend(b, beta))
    .map((player, idx) => ({ player, blend: playerBlend(player, beta), tier: Math.floor(idx / 4) }));
  const pairs = buildPairs(metas, history);
  const grouped = pairTeamsForWave(pairs, history).slice(0, totalMatches);
  return grouped.map((g, idx) => {
    const m: Match = {
      id: uid(`r${roundIndex}`),
      roundIndex,
      miniRoundIndex: idx + 1,
      court: (idx % courts) + 1,
      a1: g.teams[0][0].id,
      a2: g.teams[0][1].id,
      b1: g.teams[1][0].id,
      b2: g.teams[1][1].id,
      status: "scheduled",
      compromise: g.compromise,
    };
    return m;
  });
}








