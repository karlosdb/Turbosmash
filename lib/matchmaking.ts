import { Match, Player, Round, RoundKind, RoundPlanEntry, SchedulePrefs } from "./types";
import { generateExploratory } from "./waves";

type WaveKind = "explore" | "showdown";
type SnakeOrientation = "ascending" | "descending";

type RankedPlayerLite = {
  id: string;
  name: string;
  seed: number;
  rank: number;
};

type WaveHistory = {
  byes: string[];
};

const PRELIM_WAVE_SEQUENCES: Record<string, readonly WaveKind[]> = {
  "explore-showdown-explore-showdown": ["explore", "showdown", "explore", "showdown"],
  "explore-explore-showdown": ["explore", "explore", "showdown"],
};

const DEFAULT_PRELIM_WAVE_ORDER = "explore-showdown-explore-showdown";

const EIGHT_ROUND_PROGRAM: readonly WaveKind[] = ["explore", "showdown"];


const DEFAULT_PARTNER_GAP = 5;
function nextPrelimTarget(count: number): number {
  if (count <= 4) return 4;

  // For larger fields, walk down by fours while skipping shallow cuts that only trim two players.
  if (count > 14) {
    const nextTarget = Math.floor((count - 1) / 4) * 4;
    if (count % 4 === 2 && nextTarget - 4 >= 8) {
      return nextTarget - 4;
    }
    return Math.max(8, nextTarget);
  }

  // For 9-14 players: go directly to 8 (semifinals)
  return 8;
}

export function computeRoundPlan(totalPlayers: number, prefs: SchedulePrefs): RoundPlanEntry[] {
  const plan: RoundPlanEntry[] = [];
  if (totalPlayers < 4) return plan;
  const fast = !!prefs.threeRoundCap;
  let index = 1;
  let current = totalPlayers;

  if (fast) {
    if (current > 8) {
      plan.push({ index: index++, kind: "prelim", targetSize: 8 });
      current = 8;
    }
  } else {
    // Special case for exactly 8 players: prelim -> finals (skip semifinals)
    if (current === 8) {
      plan.push({ index: index++, kind: "prelim", targetSize: 4 });
      current = 4;
    }

    while (current > 8) {
      const next = nextPrelimTarget(current);
      if (next >= current) break;
      plan.push({ index: index++, kind: "prelim", targetSize: next });
      current = next;
    }
  }

  if (current > 8) {
    plan.push({ index: index++, kind: "prelim", targetSize: 8 });
    current = 8;
  }

  if (current > 4) {
    plan.push({ index: index++, kind: "eight", targetSize: 4 });
    current = 4;
  }

  if (current >= 4) {
    plan.push({ index: index++, kind: "final", targetSize: current });
  }

  return plan;
}

function waveKindToOrientation(kind: WaveKind): SnakeOrientation {
  return kind === "explore" ? "ascending" : "descending";
}

function uid(prefix: string = "m"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function playablePlayersPerWave(count: number): number {
  return 4 * Math.floor(count / 4);
}

function collectWaveHistories(players: Player[], round: Round, upToWave: number): WaveHistory[] {
  const playerIds = players.map((p) => p.id);
  const histories: WaveHistory[] = [];
  for (let wave = 1; wave < upToWave; wave += 1) {
    const matches = round.matches.filter(
      (m) => m.roundIndex === round.index && m.miniRoundIndex === wave
    );
    if (matches.length === 0) continue;
    const played = new Set<string>();
    matches.forEach((match) => {
      played.add(match.a1);
      played.add(match.a2);
      played.add(match.b1);
      played.add(match.b2);
    });
    const byes = playerIds.filter((id) => !played.has(id));
    histories.push({ byes });
  }
  return histories;
}

function splitPlayingAndByes(
  ordered: RankedPlayerLite[],
  histories: WaveHistory[]
): { playing: RankedPlayerLite[]; byeIds: string[] } {
  if (ordered.length === 0) return { playing: [], byeIds: [] };
  const playable = playablePlayersPerWave(ordered.length);
  if (playable === ordered.length) {
    return { playing: ordered, byeIds: [] };
  }
  const byeCount = ordered.length - playable;
  const byeTotals = new Map<string, number>();
  histories.forEach((wave) => {
    wave.byes.forEach((id) => {
      byeTotals.set(id, (byeTotals.get(id) ?? 0) + 1);
    });
  });
  const ranking = ordered.map((player, index) => ({
    player,
    index,
    byesTaken: byeTotals.get(player.id) ?? 0,
  }));
  ranking.sort((a, b) => {
    if (a.byesTaken !== b.byesTaken) return a.byesTaken - b.byesTaken;
    if (a.index !== b.index) return b.index - a.index;
    return b.player.seed - a.player.seed;
  });
  const byeSet = new Set(ranking.slice(0, byeCount).map((entry) => entry.player.id));
  const playing = ordered.filter((player) => !byeSet.has(player.id)).slice(0, playable);
  const byeIds = ordered.filter((player) => byeSet.has(player.id)).map((player) => player.id);
  return { playing, byeIds };
}

type SnakePairing = {
  teamA: [string, string];
  teamB: [string, string];
};

function snakePairings(
  ordered: RankedPlayerLite[],
  orientation: SnakeOrientation,
  partnerGapCap: number
): SnakePairing[] {
  if (ordered.length < 4) return [];
  if (ordered.length % 4 !== 0) {
    throw new Error("Snake wave requires a player count divisible by four");
  }
  const wavePlayers = ordered.map((player, idx) => ({ id: player.id, seed: idx + 1 }));
  const oriented = orientation === "ascending" ? wavePlayers : [...wavePlayers].reverse();
  const cfg = { BAND_SIZE: 4, PARTNER_GAP_CAP: partnerGapCap };
  const generated = generateExploratory(oriented, cfg);
  const matches = orientation === "ascending" ? generated : [...generated].reverse();
  return matches.map((match) => ({
    teamA: [match.teamA[0].id, match.teamA[1].id],
    teamB: [match.teamB[0].id, match.teamB[1].id],
  }));
}

function playersForWaveOrdering(players: Player[], waveIndex: number, round: Round): RankedPlayerLite[] {
  if (waveIndex === 1) {
    const bySeed = [...players].sort((a, b) => a.seed - b.seed);
    return bySeed.map((p, idx) => ({ id: p.id, name: p.name, seed: p.seed, rank: idx + 1 }));
  }

  type Metric = {
    weightedPF: number;
    rawPA: number;
    wins: number;
    pdTotal: number;
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
    if (m.roundIndex !== round.index) continue;
    const scoreA = m.scoreA ?? 0;
    const scoreB = m.scoreB ?? 0;
    const diffA = scoreA - scoreB;
    const diffB = -diffA;
    const cap = (d: number) => Math.max(-8, Math.min(8, d));

    const aWon = diffA > 0;
    const a1 = ensure(m.a1); a1.weightedPF += scoreA; a1.rawPA += scoreB; a1.pdTotal += cap(diffA); if (aWon) a1.wins += 1;
    const a2 = ensure(m.a2); a2.weightedPF += scoreA; a2.rawPA += scoreB; a2.pdTotal += cap(diffA); if (aWon) a2.wins += 1;
    const b1 = ensure(m.b1); b1.weightedPF += scoreB; b1.rawPA += scoreA; b1.pdTotal += cap(diffB); if (!aWon) b1.wins += 1;
    const b2 = ensure(m.b2); b2.weightedPF += scoreB; b2.rawPA += scoreA; b2.pdTotal += cap(diffB); if (!aWon) b2.wins += 1;
  }

  const sorted = [...players].sort((a, b) => {
    const ma = metrics.get(a.id) ?? { weightedPF: 0, rawPA: 0, wins: 0, pdTotal: 0 };
    const mb = metrics.get(b.id) ?? { weightedPF: 0, rawPA: 0, wins: 0, pdTotal: 0 };
    if (mb.weightedPF !== ma.weightedPF) return mb.weightedPF - ma.weightedPF;
    if (mb.wins !== ma.wins) return mb.wins - ma.wins;
    if (mb.pdTotal !== ma.pdTotal) return mb.pdTotal - ma.pdTotal;
    if (ma.rawPA !== mb.rawPA) return ma.rawPA - mb.rawPA;
    return a.seed - b.seed;
  });

  return sorted.map((p, idx) => ({ id: p.id, name: p.name, seed: p.seed, rank: idx + 1 }));
}

function partitionIntoGroupsBySeed(players: Player[]): Player[][] {
  const sorted = [...players].sort((a, b) => a.seed - b.seed);
  const N = sorted.length;
  const groups: Player[][] = [];
  let idx = 0;
  while (idx < N) {
    const remaining = N - idx;
    let size = 12;
    if (remaining < 12) {
      if (remaining >= 10) size = remaining;
      else if (remaining >= 8) size = remaining;
      else size = remaining;
    } else if (remaining % 12 === 0) {
      size = 12;
    } else if (remaining % 12 === 8) {
      size = 12;
    } else if (remaining % 10 === 0 || remaining % 10 >= 8) {
      size = 10;
    } else if (remaining % 8 === 0) {
      size = 8;
    } else {
      if (remaining - 12 >= 8) size = 12;
      else if (remaining - 10 >= 8) size = 10;
      else size = 8;
    }
    groups.push(sorted.slice(idx, idx + size));
    idx += size;
  }
  return groups;
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

function generateFinalFour(players: Player[], roundIndex: number): Match[] {
  if (players.length !== 4) return [];
  const sorted = [...players].sort((a, b) => a.seed - b.seed);
  const ffRank = new Map<string, number>(sorted.map((p, idx) => [p.id, idx + 1]));
  const combos: [[Player, Player], [Player, Player]][] = [
    [[sorted[0], sorted[1]], [sorted[2], sorted[3]]],
    [[sorted[0], sorted[2]], [sorted[1], sorted[3]]],
    [[sorted[0], sorted[3]], [sorted[1], sorted[2]]],
  ];
  return combos.map((teams, idx) => ({
    id: uid(`r${roundIndex}w${idx + 1}`),
    roundIndex,
    miniRoundIndex: 1,
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

export function prelimWaveSequenceFromPrefs(prefs: SchedulePrefs, roundIndex?: number): readonly WaveKind[] {
  // Use round-specific wave order if available, otherwise fall back to global r1WaveOrder
  const order = (roundIndex && prefs.roundWaveOrders?.[roundIndex]) || prefs.r1WaveOrder || DEFAULT_PRELIM_WAVE_ORDER;
  return PRELIM_WAVE_SEQUENCES[order] ?? PRELIM_WAVE_SEQUENCES[DEFAULT_PRELIM_WAVE_ORDER];
}

// Legacy alias for backward compatibility
export const r1WaveSequenceFromPrefs = prelimWaveSequenceFromPrefs;

function buildPrelimRound(roundIndex: number, players: Player[], prefs: SchedulePrefs): Round {
  const sequence = prelimWaveSequenceFromPrefs(prefs, roundIndex);
  const totalWaves = sequence.length;
  const playable = playablePlayersPerWave(players.length);
  const matchesPerWave = Math.max(1, Math.floor(Math.max(playable, 4) / 4));
  const waveSizes = sequence.map(() => matchesPerWave);
  return { index: roundIndex, kind: "prelim", matches: [], status: "active", currentWave: 0, totalWaves, waveSizes };
}

export function prepareRound1(players: Player[], prefs: SchedulePrefs): Round {
  return buildPrelimRound(1, players, prefs);
}

export function preparePrelimRound(roundIndex: number, players: Player[], prefs: SchedulePrefs): Round {
  return buildPrelimRound(roundIndex, players, prefs);
}

export function generatePrelimWave(
  waveIndex: number,
  players: Player[],
  round: Round,
  _priorRounds: Round[],
  prefs: SchedulePrefs
): { matches: Match[]; benched: Player[] } {
  const sequence = prelimWaveSequenceFromPrefs(prefs, round.index);
  if (waveIndex < 1 || waveIndex > sequence.length) return { matches: [], benched: [] };

  const waveKind = sequence[waveIndex - 1];
  const orientation = waveKindToOrientation(waveKind);
  const ordered = playersForWaveOrdering(players, waveIndex, round);
  const histories = collectWaveHistories(players, round, waveIndex);
  const { playing, byeIds } = splitPlayingAndByes(ordered, histories);

  const courtsHint = round.waveSizes?.[waveIndex - 1]
    ?? Math.max(1, Math.floor(Math.max(playablePlayersPerWave(players.length), 4) / 4));

  const rankLookup = new Map(ordered.map((entry) => [entry.id, entry.rank]));
  const pairings = snakePairings(playing, orientation, DEFAULT_PARTNER_GAP);

  const matches: Match[] = pairings.map((pairing, idx) => ({
    id: uid(`r${round.index}w${waveIndex}`),
    roundIndex: round.index,
    miniRoundIndex: waveIndex,
    court: (idx % courtsHint) + 1,
    a1: pairing.teamA[0],
    a2: pairing.teamA[1],
    b1: pairing.teamB[0],
    b2: pairing.teamB[1],
    a1Rank: rankLookup.get(pairing.teamA[0]),
    a2Rank: rankLookup.get(pairing.teamA[1]),
    b1Rank: rankLookup.get(pairing.teamB[0]),
    b2Rank: rankLookup.get(pairing.teamB[1]),
    status: "scheduled",
  }));

  const playingIds = new Set<string>();
  matches.forEach((m) => {
    playingIds.add(m.a1);
    playingIds.add(m.a2);
    playingIds.add(m.b1);
    playingIds.add(m.b2);
  });
  const benchSet = new Set(byeIds);
  const benched = players.filter((p) => !playingIds.has(p.id) || benchSet.has(p.id));

  return { matches, benched };
}

// Legacy alias for backward compatibility
export const generateR1Wave = generatePrelimWave;

export function generateLaterRound(
  players: Player[],
  priorRounds: Round[],
  roundIndex: number,
  kind: RoundKind,
  options?: { upToWave?: number }
): Match[] {
  if (kind === "final" || players.length === 4) {
    return generateFinalFour(players, roundIndex);
  }

  if (kind !== "eight") return [];

  const wavesToGenerate = EIGHT_ROUND_PROGRAM.slice(0, options?.upToWave ?? EIGHT_ROUND_PROGRAM.length);

  const pd = pointsDiffMapFromMatches(priorRounds.flatMap((r) => r.matches));
  const groups = partitionIntoGroupsBySeed(players).map((group) =>
    [...group].sort((a, b) => (pd[b.id] ?? 0) - (pd[a.id] ?? 0) || a.seed - b.seed)
  );

  const matches: Match[] = [];
  const inferredCourtCount = Math.max(1, Math.floor(players.length / 4));
  let courtCounter = 1;

  groups.forEach((group, gi) => {
    const baseEntries: RankedPlayerLite[] = group.map((player, idx) => ({
      id: player.id,
      name: player.name,
      seed: player.seed,
      rank: idx + 1,
    }));
    const rankLookup = new Map(baseEntries.map((entry) => [entry.id, entry.rank]));
    const partnerGapCap = Math.max(DEFAULT_PARTNER_GAP, group.length);

    wavesToGenerate.forEach((waveKind, waveIdx) => {
      const orientation = waveKindToOrientation(waveKind);
      const pairings = snakePairings(baseEntries, orientation, partnerGapCap);
      pairings.forEach((pairing) => {
        matches.push({
          id: uid(`r${roundIndex}w${waveIdx + 1}`),
          roundIndex,
          miniRoundIndex: waveIdx + 1,
          court: ((courtCounter - 1) % inferredCourtCount) + 1,
          groupIndex: gi + 1,
          a1: pairing.teamA[0],
          a2: pairing.teamA[1],
          b1: pairing.teamB[0],
          b2: pairing.teamB[1],
          a1Rank: rankLookup.get(pairing.teamA[0]),
          a2Rank: rankLookup.get(pairing.teamA[1]),
          b1Rank: rankLookup.get(pairing.teamB[0]),
          b2Rank: rankLookup.get(pairing.teamB[1]),
          status: "scheduled",
        });
        courtCounter += 1;
      });
    });
  });

  return matches;
}







