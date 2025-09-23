export type PlayerLite = { id: string; name: string; seed: number; rank: number };
export type Pair = [string, string];
export type Match = { court: number; a: Pair; b: Pair; compromise?: "repeat-partner" };
export type Wave = {
  index: 1 | 2 | 3;
  matches: Match[];
  byes?: string[];
  byeCreditRule?: "median-team-points";
};
export type R1Plan = { waves: Wave[] };
export type WaveBuildOptions = {
  courts?: number;
  previousWaves?: Wave[];
};

export function targetGamesPerPlayerR1() {
  return 3;
}

export function matchesPerWaveEven(N: number) {
  return N / 4;
}

export function playablePlayersPerWave(N: number) {
  return 4 * Math.floor(N / 4);
}

export function byesPerWave(N: number) {
  return N - playablePlayersPerWave(N);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function wavesCountR1() {
  return 4;
}

type PairKey = string;

type InternalWaveOptions = {
  courts: number;
  byeCounts: Map<string, number>;
};

const MEDIAN_BYE_RULE: Wave["byeCreditRule"] = "median-team-points";

function makePairKey(a: string, b: string): PairKey {
  return [a, b].sort().join("|");
}

function resolveInternalOptions(options: WaveBuildOptions | undefined, waveIndex: 1 | 2 | 3): InternalWaveOptions {
  const prior = (options?.previousWaves ?? []).filter((w) => w.index < waveIndex);
  const byeCounts = new Map<string, number>();
  for (const wave of prior) {
    for (const id of wave.byes ?? []) {
      byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
    }
  }
  const courtsInput = options?.courts;
  const courts = typeof courtsInput === "number" && Number.isFinite(courtsInput) && courtsInput > 0
    ? Math.floor(courtsInput)
    : Number.MAX_SAFE_INTEGER;
  return { courts, byeCounts };
}

type PlayingSplit = { playing: PlayerLite[]; byes: string[] };

function splitPlayingAndByes(
  players: PlayerLite[],
  N: number,
  byeCounts: Map<string, number>
): PlayingSplit {
  const playable = playablePlayersPerWave(N);
  const byeCount = byesPerWave(N);
  if (byeCount <= 0) {
    return { playing: players.slice(0, playable), byes: [] };
  }
  const selectedByes = selectByeIds(players, byeCount, byeCounts);
  const byeSet = new Set(selectedByes);
  const playing = players.filter((p) => !byeSet.has(p.id)).slice(0, playable);
  return { playing, byes: selectedByes };
}

function selectByeIds(
  players: PlayerLite[],
  byeCount: number,
  byeCounts: Map<string, number>
): string[] {
  if (byeCount <= 0) return [];
  const ranked = players.map((player, idx) => ({
    player,
    rankIndex: idx,
    byesTaken: byeCounts.get(player.id) ?? 0,
  }));
  ranked.sort((a, b) => {
    if (a.byesTaken !== b.byesTaken) return a.byesTaken - b.byesTaken;
    if (a.rankIndex !== b.rankIndex) return b.rankIndex - a.rankIndex;
    return b.player.seed - a.player.seed;
  });
  return ranked.slice(0, byeCount).map((item) => item.player.id);
}

type Pairing = [number, number];

type PodResolution = { pairs: Pair[]; compromise?: "repeat-partner" };

function resolvePod(
  pod: PlayerLite[],
  pairings: Pairing[],
  priorPartners: Set<string>
): PodResolution {
  const working = [...pod];
  const attempts = 2;
  for (let iteration = 0; iteration < attempts; iteration += 1) {
    const pairs = pairings.map(([i, j]) => [working[i].id, working[j].id] as Pair);
    const repeatedIdx = pairs.findIndex((pair) => priorPartners.has(makePairKey(pair[0], pair[1])));
    if (repeatedIdx === -1) {
      for (const pair of pairs) priorPartners.add(makePairKey(pair[0], pair[1]));
      return { pairs };
    }
    const [i, j] = pairings[repeatedIdx];
    const lower = i > j ? i : j;
    const swapWith = (lower + 1) % working.length;
    if (swapWith === lower) break;
    const temp = working[lower];
    working[lower] = working[swapWith];
    working[swapWith] = temp;
  }
  const finalPairs = pairings.map(([i, j]) => [working[i].id, working[j].id] as Pair);
  for (const pair of finalPairs) priorPartners.add(makePairKey(pair[0], pair[1]));
  return { pairs: finalPairs, compromise: "repeat-partner" };
}

function buildMatchFromPairs(
  pairs: Pair[],
  court: number,
  compromise: "repeat-partner" | undefined
): Match {
  const match: Match = { court, a: pairs[0], b: pairs[1] };
  if (compromise) match.compromise = compromise;
  return match;
}

function assignCourts(matches: Match[], courts: number): Match[] {
  if (!Number.isFinite(courts) || courts <= 0) return matches;
  return matches.map((match, idx) => ({ ...match, court: (idx % courts) + 1 }));
}

export function buildWave1(
  players: PlayerLite[],
  waveIndex: 1,
  N: number,
  options?: WaveBuildOptions
): Wave {
  const resolved = resolveInternalOptions(options, waveIndex);
  const { playing, byes } = splitPlayingAndByes(players, N, resolved.byeCounts);

  const qSize = Math.ceil(playing.length / 4);
  const q1 = [...playing.slice(0, qSize)];
  const q2 = [...playing.slice(qSize, 2 * qSize)];
  const q3 = [...playing.slice(2 * qSize, 3 * qSize)];
  const q4 = [...playing.slice(3 * qSize)];

  type PodPlan = { players: PlayerLite[]; pairings: Pairing[] };
  const pods: PodPlan[] = [];

  const pushPod = (rawPlayers: Array<PlayerLite | undefined>, pairings: Pairing[]) => {
    if (rawPlayers.length !== 4) return;
    if (rawPlayers.some((p) => !p)) return;
    pods.push({ players: rawPlayers as PlayerLite[], pairings });
  };

  while (q1.length >= 2 && q2.length >= 2) {
    const a = q1.shift();
    const b = q1.shift();
    const c = q2.pop();
    const d = q2.pop();
    pushPod([a, b, c, d], [
      [0, 2],
      [1, 3],
    ]);
  }

  while (q1.length >= 1 && q2.length >= 1 && q3.length >= 2) {
    const a = q1.shift();
    const b = q2.shift();
    const c = q3.shift();
    const d = q3.shift();
    pushPod([a, b, c, d], [
      [0, 3],
      [1, 2],
    ]);
  }

  while (q2.length >= 2 && q3.length >= 2) {
    const a = q2.shift();
    const b = q2.shift();
    const c = q3.pop();
    const d = q3.pop();
    pushPod([a, b, c, d], [
      [0, 3],
      [1, 2],
    ]);
  }

  while (q3.length >= 2 && q4.length >= 2) {
    const highC = q3.pop();
    const highD = q4.pop();
    const lowC = q3.shift();
    const lowD = q4.shift();
    pushPod([highC, highD, lowC, lowD], [
      [0, 1],
      [2, 3],
    ]);
  }

  if (q3.length === 1 && q4.length >= 3) {
    const a = q3.shift();
    const b = q4.pop();
    const c = q4.shift();
    const d = q4.shift();
    pushPod([a, b, c, d], [
      [0, 1],
      [2, 3],
    ]);
  }

  while (q4.length >= 4) {
    const a = q4.shift();
    const b = q4.shift();
    const c = q4.pop();
    const d = q4.pop();
    pushPod([a, b, c, d], [
      [0, 3],
      [1, 2],
    ]);
  }

  const usedIds = new Set<string>();
  pods.forEach((pod) => pod.players.forEach((p) => usedIds.add(p.id)));

  const leftovers = playing.filter((p) => !usedIds.has(p.id));
  chunk(leftovers, 4).forEach((group) => {
    if (group.length === 4) {
      pushPod(group as Array<PlayerLite | undefined>, [
        [0, 3],
        [1, 2],
      ]);
    }
  });

  const matches: Match[] = [];
  const partnerSet = new Set<string>();
  pods.forEach(({ players: podPlayers, pairings }) => {
    const { pairs, compromise } = resolvePod(podPlayers, pairings, partnerSet);
    matches.push(buildMatchFromPairs(pairs, matches.length + 1, compromise));
  });

  const wave: Wave = {
    index: 1,
    matches: assignCourts(matches, resolved.courts),
  };
  if (byes.length) {
    wave.byes = byes;
    wave.byeCreditRule = MEDIAN_BYE_RULE;
  }
  return wave;
}

function buildEightBlockWaveMatches(
  block: PlayerLite[],
  priorPartners: Set<string>,
  baseCourtIndex: number
): { matches: Match[]; nextCourtIndex: number } {
  const matches: Match[] = [];
  let courtIdx = baseCourtIndex;
  if (block.length === 8) {
    const topPod = [block[0], block[1], block[4], block[5]];
    const bubblePod = [block[2], block[3], block[6], block[7]];
    const pairings: Pairing[] = [
      [0, 3],
      [1, 2],
    ];
    const topResolved = resolvePod(topPod, pairings, priorPartners);
    matches.push(buildMatchFromPairs(topResolved.pairs, courtIdx + 1, topResolved.compromise));
    courtIdx += 1;
    const bubbleResolved = resolvePod(bubblePod, pairings, priorPartners);
    matches.push(buildMatchFromPairs(bubbleResolved.pairs, courtIdx + 1, bubbleResolved.compromise));
    courtIdx += 1;
  } else if (block.length === 4) {
    const pairings: Pairing[] = [
      [0, 3],
      [1, 2],
    ];
    const resolved = resolvePod(block, pairings, priorPartners);
    matches.push(buildMatchFromPairs(resolved.pairs, courtIdx + 1, resolved.compromise));
    courtIdx += 1;
  }
  return { matches, nextCourtIndex: courtIdx };
}

export function buildWave2(
  rankedByEP: PlayerLite[],
  waveIndex: 2,
  N: number,
  priorPartners: Set<string>,
  options?: WaveBuildOptions
): Wave {
  const resolved = resolveInternalOptions(options, waveIndex);
  const { playing, byes } = splitPlayingAndByes(rankedByEP, N, resolved.byeCounts);
  const blocks = chunk(playing, 8);
  const matches: Match[] = [];
  let courtIdx = 0;
  blocks.forEach((block) => {
    const { matches: blockMatches, nextCourtIndex } = buildEightBlockWaveMatches(block, priorPartners, courtIdx);
    matches.push(...blockMatches);
    courtIdx = nextCourtIndex;
  });
  const assignedMatches = assignCourts(matches, resolved.courts);
  const wave: Wave = {
    index: 2,
    matches: assignedMatches,
  };
  if (byes.length) {
    wave.byes = byes;
    wave.byeCreditRule = MEDIAN_BYE_RULE;
  }
  return wave;
}

export function buildWave3(
  rankedByEP: PlayerLite[],
  waveIndex: 3,
  N: number,
  priorPartners: Set<string>,
  options?: WaveBuildOptions
): Wave {
  const resolved = resolveInternalOptions(options, waveIndex);
  const { playing, byes } = splitPlayingAndByes(rankedByEP, N, resolved.byeCounts);
  const blocks = chunk(playing, 8);
  const matches: Match[] = [];
  let courtIdx = 0;
  blocks.forEach((block) => {
    if (block.length === 8) {
      const showdownPod = [block[0], block[1], block[2], block[3]];
      const promoPod = [block[4], block[5], block[6], block[7]];
      const pairings: Pairing[] = [
        [0, 3],
        [1, 2],
      ];
      const showdown = resolvePod(showdownPod, pairings, priorPartners);
      matches.push(buildMatchFromPairs(showdown.pairs, courtIdx + 1, showdown.compromise));
      courtIdx += 1;
      const promo = resolvePod(promoPod, pairings, priorPartners);
      matches.push(buildMatchFromPairs(promo.pairs, courtIdx + 1, promo.compromise));
      courtIdx += 1;
    } else if (block.length === 4) {
      const pairings: Pairing[] = [
        [0, 3],
        [1, 2],
      ];
      const resolvedPod = resolvePod(block, pairings, priorPartners);
      matches.push(buildMatchFromPairs(resolvedPod.pairs, courtIdx + 1, resolvedPod.compromise));
      courtIdx += 1;
    }
  });
  const assignedMatches = assignCourts(matches, resolved.courts);
  const wave: Wave = {
    index: 3,
    matches: assignedMatches,
  };
  if (byes.length) {
    wave.byes = byes;
    wave.byeCreditRule = MEDIAN_BYE_RULE;
  }
  return wave;
}

export function buildR1Wave(
  waveIndex: 1 | 2 | 3,
  playersForThisWave: PlayerLite[],
  N: number,
  priorPartners: Set<string>,
  options?: WaveBuildOptions
): Wave {
  if (waveIndex === 1) return buildWave1(playersForThisWave, 1, N, options);
  if (waveIndex === 2) return buildWave2(playersForThisWave, 2, N, priorPartners, options);
  return buildWave3(playersForThisWave, 3, N, priorPartners, options);
}

export function recordPartnersFromWave(wave: Wave, bucket: Set<string>) {
  for (const match of wave.matches) {
    bucket.add(makePairKey(match.a[0], match.a[1]));
    bucket.add(makePairKey(match.b[0], match.b[1]));
  }
}

export function medianTeamPoints(teamScores: number[]): number {
  if (!teamScores.length) return 0;
  const sorted = [...teamScores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function waveTeamScoresForMedian(wave: Wave, scoreLookup: (team: Pair) => number | undefined): number[] {
  const scores: number[] = [];
  for (const match of wave.matches) {
    const aScore = scoreLookup(match.a);
    const bScore = scoreLookup(match.b);
    if (typeof aScore === "number") scores.push(aScore);
    if (typeof bScore === "number") scores.push(bScore);
  }
  return scores;
}

