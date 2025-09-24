import { Match, Player, Round, SchedulePrefs } from "./types";
import { generateEightShowdown, generateExploratory } from "./waves";
import { blended } from "./seeding";
import { buildR1Wave, playablePlayersPerWave, PlayerLite as R1PlayerLite, Wave as R1Wave } from "./r1_matchmaking";

type R1WaveKind = "explore" | "showdown";

const R1_WAVE_SEQUENCES: Record<string, readonly R1WaveKind[]> = {
  "explore-showdown-explore-showdown": ["explore", "showdown", "explore", "showdown"],
  "explore-explore-showdown": ["explore", "explore", "showdown"],
};

const DEFAULT_R1_WAVE_ORDER = "explore-showdown-explore-showdown";

export function r1WaveSequenceFromPrefs(prefs: SchedulePrefs): readonly R1WaveKind[] {
  const order = prefs.r1WaveOrder ?? DEFAULT_R1_WAVE_ORDER;
  return R1_WAVE_SEQUENCES[order] ?? R1_WAVE_SEQUENCES[DEFAULT_R1_WAVE_ORDER];
}

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

// Deterministic group partitioning by seed into chunks of 8-12
function partitionIntoGroupsBySeed(players: Player[]): Player[][] {
  const sorted = [...players].sort((a, b) => a.seed - b.seed);
  const N = sorted.length;
  const groups: Player[][] = [];
  let idx = 0;
  while (idx < N) {
    const remaining = N - idx;
    // Prefer 12, fallback to 10 or 8, avoid 9/11 only when necessary
    let size = 12;
    if (remaining < 12) {
      if (remaining >= 10) size = remaining; else if (remaining >= 8) size = remaining; else size = remaining;
    } else if (remaining % 12 === 0) {
      size = 12;
    } else if (remaining % 12 === 8) {
      size = 12;
    } else if (remaining % 10 === 0 || remaining % 10 >= 8) {
      size = 10;
    } else if (remaining % 8 === 0) {
      size = 8;
    } else {
      // Greedy: pick the largest that leaves 8-12 remainder
      if ((remaining - 12) >= 8) size = 12; else if ((remaining - 10) >= 8) size = 10; else size = 8;
    }
    groups.push(sorted.slice(idx, idx + size));
    idx += size;
  }
  return groups;
}

export function prepareRound1(players: Player[], prefs: SchedulePrefs): Round {
  const sequence = r1WaveSequenceFromPrefs(prefs);
  const totalWaves = sequence.length;
  const playable = playablePlayersPerWave(players.length);
  const matchesPerWave = Math.max(1, Math.floor(Math.max(playable, 4) / 4));
  const waveSizes = sequence.map(() => matchesPerWave);
  return { index: 1, matches: [], status: "active", currentWave: 0, totalWaves, waveSizes };
}

function makePairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function collectPriorPartnerKeys(matches: Match[]): Set<string> {
  const set = new Set<string>();
  for (const match of matches) {
    set.add(makePairKey(match.a1, match.a2));
    set.add(makePairKey(match.b1, match.b2));
  }
  return set;
}

function snapshotPreviousWaves(players: Player[], round: Round, upToWave: number): R1Wave[] {
  const allIds = players.map((p) => p.id);
  const waves: R1Wave[] = [];
  for (let wave = 1; wave < upToWave; wave++) {
    const matches = round.matches.filter((m) => m.miniRoundIndex === wave);
    if (matches.length === 0) continue;
    const converted = matches.map((m) => ({
      court: m.court,
      a: [m.a1, m.a2] as [string, string],
      b: [m.b1, m.b2] as [string, string],
      compromise: m.compromise === "repeat-partner" ? "repeat-partner" : undefined,
    }));
    const played = new Set<string>();
    matches.forEach((m) => {
      played.add(m.a1);
      played.add(m.a2);
      played.add(m.b1);
      played.add(m.b2);
    });
    const byes = allIds.filter((id) => !played.has(id));
    const snapshot: R1Wave = {
      index: wave as 1 | 2 | 3,
      matches: converted,
    };
    if (byes.length) {
      snapshot.byes = byes;
      snapshot.byeCreditRule = "median-team-points";
    }
    waves.push(snapshot);
  }
  return waves;
}

function playersForWaveOrdering(players: Player[], waveIndex: number, round: Round): R1PlayerLite[] {
  // Wave 1: deterministic by seed
  if (waveIndex === 1) {
    const bySeed = [...players].sort((a, b) => a.seed - b.seed);
    return bySeed.map((p, idx) => ({ id: p.id, name: p.name, seed: p.seed, rank: idx + 1 }));
  }

  // Waves 2+ within Round 1: align with leaderboard ordering rules
  // Score = weighted points; in R1, weight = 1.0 so raw points, but keep structure for consistency
  type Metric = {
    weightedPF: number;
    rawPA: number;
    wins: number;
    pdTotal: number; // capped to +/-8 per game
  };

  const metrics = new Map<string, Metric>();
  const ensure = (id: string): Metric => {
    const existing = metrics.get(id);
    if (existing) return existing;
    const init: Metric = { weightedPF: 0, rawPA: 0, wins: 0, pdTotal: 0 };
    metrics.set(id, init);
    return init;
  };

  for (const m of round.matches) {
    if (m.status !== "completed") continue;
    if (m.roundIndex !== 1) continue; // Only R1 should influence R1 wave ordering
    const scoreA = m.scoreA ?? 0;
    const scoreB = m.scoreB ?? 0;
    const diffA = scoreA - scoreB;
    const diffB = -diffA;
    const cap = (d: number) => Math.max(-8, Math.min(8, d));

    const aWon = diffA > 0;
    // Side A players
    const a1 = ensure(m.a1); a1.weightedPF += scoreA; a1.rawPA += scoreB; a1.pdTotal += cap(diffA); if (aWon) a1.wins += 1;
    const a2 = ensure(m.a2); a2.weightedPF += scoreA; a2.rawPA += scoreB; a2.pdTotal += cap(diffA); if (aWon) a2.wins += 1;
    // Side B players
    const b1 = ensure(m.b1); b1.weightedPF += scoreB; b1.rawPA += scoreA; b1.pdTotal += cap(diffB); if (!aWon) b1.wins += 1;
    const b2 = ensure(m.b2); b2.weightedPF += scoreB; b2.rawPA += scoreA; b2.pdTotal += cap(diffB); if (!aWon) b2.wins += 1;
  }

  const sorted = [...players].sort((a, b) => {
    const ma = metrics.get(a.id) ?? { weightedPF: 0, rawPA: 0, wins: 0, pdTotal: 0 };
    const mb = metrics.get(b.id) ?? { weightedPF: 0, rawPA: 0, wins: 0, pdTotal: 0 };
    if (mb.weightedPF !== ma.weightedPF) return mb.weightedPF - ma.weightedPF;
    if (mb.wins !== ma.wins) return mb.wins - ma.wins;
    if (mb.pdTotal !== ma.pdTotal) return mb.pdTotal - ma.pdTotal;
    if (ma.rawPA !== mb.rawPA) return ma.rawPA - mb.rawPA; // lower PA is better
    return a.seed - b.seed;
  });

  return sorted.map((p, idx) => ({ id: p.id, name: p.name, seed: p.seed, rank: idx + 1 }));
}

// Desktop deterministic: within each group of 8-12, pair (1&3 vs 2&4), (5&7 vs 6&8), and for 12 add (9&11 vs 10&12)
function createDeterministicGroupMatches(group: Player[], groupIndex: number, phase: 1 | 2, waveIndex: number): Match[] {
  // Rank within this deterministic group at scheduling time (1-based)
  const groupRank = new Map<string, number>(group.map((p, idx) => [p.id, idx + 1]));
  // Determine bench count per wave for group sizes > 8
  const size = group.length;
  let benchCount = 0;
  if (size === 9) benchCount = 1;
  else if (size === 10) benchCount = 2;
  else if (size === 11) benchCount = 3;
  else if (size >= 12) benchCount = 0;

  // Simple deterministic bye rotation patterns (repeat every 3 waves)
  const byePatterns: Record<number, number[][]> = {
    9: [[8], [7], [6]],
    10: [[8, 9], [6, 7], [4, 5]],
    11: [[8, 9, 10], [5, 6, 7], [2, 3, 4]],
    12: [[]],
  };
  const pattern = byePatterns[size] || [[]];
  const benchIdxs = pattern[(waveIndex - 1) % pattern.length] || [];

  const active: Player[] = group.filter((_, idx) => !benchIdxs.includes(idx)).slice(0, size >= 12 ? 12 : 8);

  const matches: Match[] = [];
  const ids = active.map((p) => p.id);
  const mk = (a1: number, a2: number, b1: number, b2: number, courtOffset: number) => ({
    id: uid(`r${phase}w${waveIndex}`),
    roundIndex: phase,
    miniRoundIndex: waveIndex,
    court: courtOffset,
    groupIndex,
    a1: ids[a1], a2: ids[a2], b1: ids[b1], b2: ids[b2],
    a1Rank: groupRank.get(ids[a1]),
    a2Rank: groupRank.get(ids[a2]),
    b1Rank: groupRank.get(ids[b1]),
    b2Rank: groupRank.get(ids[b2]),
    status: "scheduled" as const,
  });
  if (ids.length >= 8) {
    matches.push(mk(0, 2, 1, 3, 1));
    matches.push(mk(4, 6, 5, 7, 2));
  }
  if (ids.length >= 12) {
    matches.push(mk(8, 10, 9, 11, 3));
  }
  return matches;
}

function pointsDiffMapFromMatches(matches: Match[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const a = m.scoreA ?? 0;
    const b = m.scoreB ?? 0;
    const ids = [m.a1, m.a2, m.b1, m.b2];
    for (const id of ids) map[id] = map[id] ?? 0;
    map[m.a1] += a - b;
    map[m.a2] += a - b;
    map[m.b1] += b - a;
    map[m.b2] += b - a;
  }
  return map;
}

export function generateR1Wave(
  waveIndex: number,
  players: Player[],
  round: Round,
  _priorRounds: Round[],
  prefs: SchedulePrefs
): { matches: Match[]; benched: Player[] } {
  const sequence = r1WaveSequenceFromPrefs(prefs);
  const totalWaves = sequence.length;
  if (waveIndex < 1 || waveIndex > totalWaves) return { matches: [], benched: [] };

  const waveKind = sequence[waveIndex - 1];
  const playerOrder = playersForWaveOrdering(players, waveIndex, round);
  const priorPartners = collectPriorPartnerKeys(round.matches);
  const previousWaves = snapshotPreviousWaves(players, round, waveIndex);
  const courtsHint = round.waveSizes?.[waveIndex - 1] ?? Math.max(1, Math.floor(Math.max(playablePlayersPerWave(players.length), 4) / 4));
  const rankLookup = new Map(playerOrder.map((p) => [p.id, p.rank]));

  let matches: Match[];
  if (waveKind === "showdown") {
    // Showdown: two-band snakes over the whole cohort ordered by current ranks
    const cfg = { BAND_SIZE: 4, PARTNER_GAP_CAP: 5 };
    const wavePlayers = playerOrder.map((p) => ({ id: p.id, seed: p.rank }));
    const generated = generateEightShowdown(wavePlayers, cfg);
    matches = generated.map((gm, idx) => ({
      id: uid(`r1w${waveIndex}`),
      roundIndex: 1,
      miniRoundIndex: waveIndex,
      court: ((idx % courtsHint) + 1),
      a1: gm.teamA[0].id,
      a2: gm.teamA[1].id,
      b1: gm.teamB[0].id,
      b2: gm.teamB[1].id,
      a1Rank: rankLookup.get(gm.teamA[0].id),
      a2Rank: rankLookup.get(gm.teamA[1].id),
      b1Rank: rankLookup.get(gm.teamB[0].id),
      b2Rank: rankLookup.get(gm.teamB[1].id),
      status: "scheduled",
    }));
  } else if (waveKind === "explore") {
    // Exploratory wave: snake pairings across the cohort using current ranks
    const cfg = { BAND_SIZE: 4, PARTNER_GAP_CAP: 5 };
    const wavePlayers = playerOrder.map((p) => ({ id: p.id, seed: p.rank }));
    const generated = generateExploratory(wavePlayers, cfg);
    matches = generated.map((gm, idx) => ({
      id: uid(`r1w${waveIndex}`),
      roundIndex: 1,
      miniRoundIndex: waveIndex,
      court: ((idx % courtsHint) + 1),
      a1: gm.teamA[0].id,
      a2: gm.teamA[1].id,
      b1: gm.teamB[0].id,
      b2: gm.teamB[1].id,
      a1Rank: rankLookup.get(gm.teamA[0].id),
      a2Rank: rankLookup.get(gm.teamA[1].id),
      b1Rank: rankLookup.get(gm.teamB[0].id),
      b2Rank: rankLookup.get(gm.teamB[1].id),
      status: "scheduled",
    }));
  } else {
    const wave = buildR1Wave(waveIndex as 1 | 2 | 3, playerOrder, players.length, priorPartners, {
      courts: courtsHint,
      previousWaves,
    });
    matches = wave.matches.map((match, idx) => {
      const scheduled: Match = {
        id: uid(`r1w${waveIndex}`),
        roundIndex: 1,
        miniRoundIndex: waveIndex,
        court: match.court ?? ((idx % courtsHint) + 1),
        a1: match.a[0],
        a2: match.a[1],
        b1: match.b[0],
        b2: match.b[1],
        a1Rank: rankLookup.get(match.a[0]),
        a2Rank: rankLookup.get(match.a[1]),
        b1Rank: rankLookup.get(match.b[0]),
        b2Rank: rankLookup.get(match.b[1]),
        status: "scheduled",
      };
      if (match.compromise) scheduled.compromise = match.compromise;
      return scheduled;
    });
  }

  const playingIds = new Set<string>();
  matches.forEach((m) => {
    playingIds.add(m.a1);
    playingIds.add(m.a2);
    playingIds.add(m.b1);
    playingIds.add(m.b2);
  });

  const benched = players.filter((p) => !playingIds.has(p.id));
  return { matches, benched };
}


function generateFinalFour(players: Player[]): Match[] {
  if (players.length !== 4) return [];
  const sorted = [...players].sort((a, b) => a.seed - b.seed);
  // Rank within Final Four seeding order at scheduling time
  const ffRank = new Map<string, number>(sorted.map((p, idx) => [p.id, idx + 1]));
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
    a1Rank: ffRank.get(teams[0][0].id),
    a2Rank: ffRank.get(teams[0][1].id),
    b1Rank: ffRank.get(teams[1][0].id),
    b2Rank: ffRank.get(teams[1][1].id),
    status: "scheduled",
  }));
}

export function generateLaterRound(
  players: Player[],
  priorRounds: Round[],
  roundIndex: 2 | 3,
  options?: { upToWave?: number }
): Match[] {
  if (roundIndex === 3 && players.length === 4) {
    return generateFinalFour(players);
  }
  if (roundIndex === 2) {
    const pd = pointsDiffMapFromMatches(priorRounds.flatMap((r) => r.matches));
    const groups = partitionIntoGroupsBySeed(players).map((group) =>
      [...group].sort((a, b) => (pd[b.id] ?? 0) - (pd[a.id] ?? 0) || a.seed - b.seed)
    );

    const matches: Match[] = [];
    const inferredCourtCount = Math.max(1, Math.floor(players.length / 4));
    let courtCounter = 1;
    const includeWave1 = (options?.upToWave ?? 2) >= 1;
    const includeWave2 = (options?.upToWave ?? 2) >= 2;

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      if (!group.length) continue;
      const rankLookup = new Map(group.map((p, idx) => [p.id, idx + 1]));
      const partnerGapCap = Math.max(5, group.length);
      const cfg = { BAND_SIZE: 4, PARTNER_GAP_CAP: partnerGapCap };
      const wavePlayers = group.map((p, idx) => ({ id: p.id, seed: idx + 1 }));

      if (includeWave1) {
        const exploratoryWave = generateExploratory(wavePlayers, cfg);
        exploratoryWave.forEach((gm) => {
          matches.push({
            id: uid('r2w1'),
            roundIndex: 2,
            miniRoundIndex: 1,
            court: ((courtCounter - 1) % inferredCourtCount) + 1,
            groupIndex: gi + 1,
            a1: gm.teamA[0].id,
            a2: gm.teamA[1].id,
            b1: gm.teamB[0].id,
            b2: gm.teamB[1].id,
            a1Rank: rankLookup.get(gm.teamA[0].id),
            a2Rank: rankLookup.get(gm.teamA[1].id),
            b1Rank: rankLookup.get(gm.teamB[0].id),
            b2Rank: rankLookup.get(gm.teamB[1].id),
            status: 'scheduled',
          });
          courtCounter += 1;
        });
      }

      if (includeWave2) {
        const showdownWave = generateEightShowdown(wavePlayers, cfg);
        showdownWave.forEach((gm) => {
          matches.push({
            id: uid('r2w2'),
            roundIndex: 2,
            miniRoundIndex: 2,
            court: ((courtCounter - 1) % inferredCourtCount) + 1,
            groupIndex: gi + 1,
            a1: gm.teamA[0].id,
            a2: gm.teamA[1].id,
            b1: gm.teamB[0].id,
            b2: gm.teamB[1].id,
            a1Rank: rankLookup.get(gm.teamA[0].id),
            a2Rank: rankLookup.get(gm.teamA[1].id),
            b1Rank: rankLookup.get(gm.teamB[0].id),
            b2Rank: rankLookup.get(gm.teamB[1].id),
            status: 'scheduled',
          });
          courtCounter += 1;
        });
      }
    }

    return matches;
  }
  return [];
}
