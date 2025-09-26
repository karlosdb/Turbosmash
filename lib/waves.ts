export type Player = { id: string; seed: number };
export type Team = [Player, Player];
export type Match = { teamA: Team; teamB: Team; type: "exploratory" };
export type Cfg = { BAND_SIZE: number; PARTNER_GAP_CAP: number };

// Sorting and helpers (deterministic)
export function bySeed(a: Player, b: Player): number {
  if (a.seed !== b.seed) return a.seed - b.seed;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function chunkAscending<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function mk(a: Player, b: Player, c: Player, d: Player): Match {
  const teamA = a.seed <= b.seed ? [a, b] : [b, a];
  const teamB = c.seed <= d.seed ? [c, d] : [d, c];
  return { teamA: teamA as Team, teamB: teamB as Team, type: "exploratory" };
}

// Adjacent-band "safe snakes" for two bands A,B (each length = BAND_SIZE, sorted)
export function snakesTwoBands(A: Player[], B: Player[]): Match[] {
  return [
    mk(A[0], B[1], A[1], B[0]),
    mk(A[2], B[3], A[3], B[2]),
  ];
}

// Lone intra-band snake when a single band remains (BAND_SIZE = 4)
export function snakeOneBand(C: Player[]): Match {
  return mk(C[0], C[3], C[1], C[2]);
}

export function bandIndex(p: Player, cfg: Cfg): number {
  return Math.floor((p.seed - 1) / cfg.BAND_SIZE);
}

export function assertWave(matches: Match[], players: Player[], cfg: Cfg): void {
  const allowed = new Set(players.map((p) => p.id));
  const seen = new Map<string, number>();
  for (const m of matches) {
    for (const p of [...m.teamA, ...m.teamB]) {
      if (!allowed.has(p.id)) throw new Error("player outside cohort encountered");
      seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
    }
  }
  for (const p of players) {
    if (seen.get(p.id) !== 1) throw new Error(`player ${p.id} appears ${seen.get(p.id) ?? 0} times`);
  }
  for (const m of matches) {
    for (const team of [m.teamA, m.teamB]) {
      const [a, b] = team;
      const bandDiff = Math.abs(bandIndex(a, cfg) - bandIndex(b, cfg));
      if (bandDiff > 1) throw new Error("partners not from same/adjacent bands");
      const gap = Math.abs(a.seed - b.seed);
      if (gap > cfg.PARTNER_GAP_CAP) throw new Error("partner gap cap violated");
    }
  }
  if (matches.length !== players.length / 4) throw new Error("wrong number of matches for cohort size");
}

export function generateExploratory(players: Player[], cfg: Cfg): Match[] {
  if (players.length % 4 !== 0) throw new Error("exploratory requires N % 4 = 0");
  const bands = chunkAscending(players, cfg.BAND_SIZE);
  const out: Match[] = [];
  for (let i = 0; i < bands.length; i += 2) {
    const A = bands[i];
    const B = bands[i + 1];
    if (B) out.push(...snakesTwoBands(A, B));
    else out.push(snakeOneBand(A));
  }
  assertWave(out, players, cfg);
  return out;
}

export function planFirstRound(ranksAtStart: Player[], cfg: Cfg): Match[][] {
  const sorted = ranksAtStart.slice().sort(bySeed);
  const reversed = [...sorted].reverse();
  const showdownMatches = generateExploratory(reversed, cfg);
  const reversedShowdownMatches = [...showdownMatches].reverse();
  return [
    generateExploratory(sorted, cfg),
    reversedShowdownMatches,
    generateExploratory(sorted, cfg),
    reversedShowdownMatches,
  ];
}
