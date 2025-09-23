import { Player } from "./types";

export const BAND_SIZE = 4;
export const PARTNER_GAP_CAP = 2 * BAND_SIZE - 3;

export type WaveType = "explore" | "bubble";

export type MatchMeta = {
  gate?: [number, number];
  reason?: string;
};

export type BaseMatch = {
  teamA: [Player, Player];
  teamB: [Player, Player];
  meta?: MatchMeta;
};

export type TSMatch = BaseMatch & {
  wave: number;
  type: WaveType;
  pointsTo: number;
};

export type WavePlan = {
  wave: number;
  type: WaveType;
  pointsTo: number;
  matches: TSMatch[];
  summary: string;
};

type GeneratorConfig = {
  BAND_SIZE: number;
  PARTNER_GAP_CAP: number;
};

const DEFAULT_CFG: GeneratorConfig = {
  BAND_SIZE,
  PARTNER_GAP_CAP,
};

export function defaultPointsForN(N: number): number {
  return N >= 12 ? 15 : 11;
}

export function bandsOfSize(ranks: Player[], size: number): Player[][] {
  const bands: Player[][] = [];
  for (let i = 0; i < ranks.length; i += size) {
    bands.push(ranks.slice(i, i + size));
  }
  return bands;
}

export function bandsOf4(ranks: Player[]): Player[][] {
  return bandsOfSize(ranks, BAND_SIZE);
}

export function computeGates(N: number): Array<[number, number]> {
  const gates: Array<[number, number]> = [];
  for (let k = BAND_SIZE; k + 1 <= N; k += BAND_SIZE) {
    gates.push([k, k + 1]);
  }
  return gates;
}

const PROGRESSION_NEXT: Record<number, number> = {
  24: 16,
  20: 16,
  16: 12,
  12: 8,
  8: 4,
};

function rankIndexLookup(ranks: Player[]): Map<string, number> {
  const map = new Map<string, number>();
  ranks.forEach((player, idx) => map.set(player.id, idx + 1));
  return map;
}

function bandIndex(rank1Based: number, cfg: GeneratorConfig): number {
  return Math.floor((rank1Based - 1) / cfg.BAND_SIZE);
}

function partnerGap(rankOf: Map<string, number>, a: Player, b: Player): number {
  const ra = rankOf.get(a.id) ?? 0;
  const rb = rankOf.get(b.id) ?? 0;
  return Math.abs(ra - rb);
}

function isTeamValid(team: [Player, Player], rankOf: Map<string, number>, cfg: GeneratorConfig): boolean {
  const gap = partnerGap(rankOf, team[0], team[1]);
  if (gap > cfg.PARTNER_GAP_CAP) return false;
  const r1 = rankOf.get(team[0].id) ?? 0;
  const r2 = rankOf.get(team[1].id) ?? 0;
  const b1 = bandIndex(r1, cfg);
  const b2 = bandIndex(r2, cfg);
  return Math.abs(b1 - b2) <= 1;
}

function candidateOrderIndices(
  size: number,
  boundary: number,
  exclude: Set<number>,
  priority: "toward" | "away"
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < size; i++) {
    if (exclude.has(i)) continue;
    indices.push(i);
  }
  indices.sort((a, b) => {
    const distA = Math.abs(a - boundary);
    const distB = Math.abs(b - boundary);
    if (distA !== distB) {
      return priority === "toward" ? distA - distB : distB - distA;
    }
    return priority === "toward" ? a - b : b - a;
  });
  return indices;
}

function gatherCandidatesForEdge(
  bandIndexValue: number,
  bands: Player[][],
  orientation: "upper" | "lower",
  usedIds: Set<string>,
  reservedEdgeIds: Set<string>,
  gateEdgeIds: Set<string>
): Player[] {
  const candidates: Player[] = [];
  const bandCount = bands.length;
  if (bandIndexValue < 0 || bandIndexValue >= bandCount) return candidates;

  const processedBands = new Set<number>();
  const bandOrder: Array<{ idx: number; priority: "toward" | "away" }> =
    orientation === "upper"
      ? [
          { idx: bandIndexValue + 1, priority: "away" },
          { idx: bandIndexValue, priority: "away" },
        ]
      : [
          { idx: bandIndexValue, priority: "away" },
          { idx: bandIndexValue - 1, priority: "away" },
        ];

  const pushFromBand = (target: number, priority: "toward" | "away") => {
    if (target < 0 || target >= bandCount) return;
    if (processedBands.has(target)) return;
    processedBands.add(target);
    const band = bands[target];
    if (!band || band.length === 0) return;

    const boundary =
      target === bandIndexValue
        ? orientation === "upper"
          ? band.length - 1
          : 0
        : target < bandIndexValue
        ? band.length - 1
        : 0;

    const exclude = new Set<number>();
    exclude.add(boundary);
    const order = candidateOrderIndices(band.length, boundary, exclude, priority);
    for (const pos of order) {
      const player = band[pos];
      if (!player) continue;
      if (gateEdgeIds.has(player.id)) continue;
      if (usedIds.has(player.id)) continue;
      if (reservedEdgeIds.has(player.id) && !gateEdgeIds.has(player.id)) continue;
      if (candidates.some((p) => p.id === player.id)) continue;
      candidates.push(player);
    }
  };

  for (const { idx, priority } of bandOrder) {
    pushFromBand(idx, priority);
  }

  return candidates;
}

function primaryCutoffRank(N: number, gates: Array<[number, number]>): number {
  const target = PROGRESSION_NEXT[N];
  if (typeof target === "number") return target;
  const half = Math.floor(N / 2);
  const halfGate = gates.find(([lower]) => lower === half);
  if (halfGate) return half;
  const midIndex = Math.floor(gates.length / 2);
  return gates[midIndex][0];
}

function orderGatesCutoffFirst(N: number, gates: Array<[number, number]>): Array<[number, number]> {
  if (gates.length <= 1) return [...gates];
  const primaryLower = primaryCutoffRank(N, gates);
  let primaryIndex = gates.findIndex(([lower]) => lower === primaryLower);
  if (primaryIndex === -1) primaryIndex = Math.floor(gates.length / 2);
  const center = (gates.length - 1) / 2;
  const indices = gates.map((_, idx) => idx);
  const rest = indices.filter((idx) => idx !== primaryIndex);
  rest.sort((a, b) => {
    const distA = Math.abs(a - primaryIndex);
    const distB = Math.abs(b - primaryIndex);
    if (distA !== distB) return distA - distB;
    const centerA = Math.abs(a - center);
    const centerB = Math.abs(b - center);
    if (centerA !== centerB) return centerA - centerB;
    return a - b;
  });
  return [primaryIndex, ...rest].map((idx) => gates[idx]);
}

function assertWaveMatches(
  ranks: Player[],
  matches: BaseMatch[],
  cfg: GeneratorConfig,
  rankOf: Map<string, number>,
  context: string
): void {
  const expectedMatches = ranks.length / 4;
  if (matches.length !== expectedMatches) {
    throw new Error(`${context}: expected ${expectedMatches} matches, received ${matches.length}`);
  }
  const used = new Set<string>();
  matches.forEach((match, idx) => {
    for (const player of [...match.teamA, ...match.teamB]) {
      if (used.has(player.id)) {
        throw new Error(`${context}: player ${player.id} appears multiple times (match ${idx})`);
      }
      used.add(player.id);
    }
    if (!isTeamValid(match.teamA, rankOf, cfg)) {
      throw new Error(`${context}: invalid teamA in match ${idx}`);
    }
    if (!isTeamValid(match.teamB, rankOf, cfg)) {
      throw new Error(`${context}: invalid teamB in match ${idx}`);
    }
  });
  if (used.size !== ranks.length) {
    throw new Error(`${context}: expected every player exactly once`);
  }
}

type GateAssignment = {
  gate: [number, number];
  upperEdge: Player;
  lowerEdge: Player;
  partnerUpper: Player;
  partnerLower: Player;
  match: BaseMatch;
  gaps: [number, number];
  partnerSeeds: number[];
};

function enumerateGateChoices(
  gate: [number, number],
  ranks: Player[],
  bands: Player[][],
  cfg: GeneratorConfig,
  rankOf: Map<string, number>,
  reservedEdgeIds: Set<string>,
  usedIds: Set<string>
): GateAssignment[] {
  const [upperRank, lowerRank] = gate;
  const upperEdge = ranks[upperRank - 1];
  const lowerEdge = ranks[lowerRank - 1];
  const upperBandIdx = bandIndex(upperRank, cfg);
  const lowerBandIdx = bandIndex(lowerRank, cfg);
  const gateEdgeIds = new Set<string>([upperEdge.id, lowerEdge.id]);

  const upperCandidates = gatherCandidatesForEdge(
    upperBandIdx,
    bands,
    "upper",
    usedIds,
    reservedEdgeIds,
    gateEdgeIds
  );
  const lowerCandidates = gatherCandidatesForEdge(
    lowerBandIdx,
    bands,
    "lower",
    usedIds,
    reservedEdgeIds,
    gateEdgeIds
  );

  const choices: GateAssignment[] = [];

  for (const partnerUpper of upperCandidates) {
    for (const partnerLower of lowerCandidates) {
      if (!partnerUpper || !partnerLower) continue;
      if (partnerUpper.id === partnerLower.id) continue;
      if (usedIds.has(partnerUpper.id) || usedIds.has(partnerLower.id)) continue;
      const gapUpper = partnerGap(rankOf, upperEdge, partnerUpper);
      if (gapUpper > cfg.PARTNER_GAP_CAP) continue;
      const gapLower = partnerGap(rankOf, lowerEdge, partnerLower);
      if (gapLower > cfg.PARTNER_GAP_CAP) continue;
      const teamUpper: [Player, Player] = [upperEdge, partnerUpper];
      const teamLower: [Player, Player] = [lowerEdge, partnerLower];
      if (!isTeamValid(teamUpper, rankOf, cfg)) continue;
      if (!isTeamValid(teamLower, rankOf, cfg)) continue;

      const partnerSeeds = [
        rankOf.get(partnerUpper.id) ?? 0,
        rankOf.get(partnerLower.id) ?? 0,
      ];

      choices.push({
        gate,
        upperEdge,
        lowerEdge,
        partnerUpper,
        partnerLower,
        match: {
          teamA: teamUpper,
          teamB: teamLower,
          meta: { gate, reason: "gate" },
        },
        gaps: [gapUpper, gapLower],
        partnerSeeds,
      });
    }
  }

  choices.sort((a, b) => {
    const maxGapA = Math.max(a.gaps[0], a.gaps[1]);
    const maxGapB = Math.max(b.gaps[0], b.gaps[1]);
    if (maxGapA !== maxGapB) return maxGapA - maxGapB;
    const capCountA = a.gaps.filter((gap) => gap === cfg.PARTNER_GAP_CAP).length;
    const capCountB = b.gaps.filter((gap) => gap === cfg.PARTNER_GAP_CAP).length;
    if (capCountA !== capCountB) return capCountA - capCountB;
    const sumA = a.gaps[0] + a.gaps[1];
    const sumB = b.gaps[0] + b.gaps[1];
    if (sumA !== sumB) return sumA - sumB;
    // Prefer lower partner seeds (closer to edges)
    const aSeeds = [(rankOf.get(a.partnerUpper.id) ?? 0), (rankOf.get(a.partnerLower.id) ?? 0)].sort((x,y)=>x-y);
    const bSeeds = [(rankOf.get(b.partnerUpper.id) ?? 0), (rankOf.get(b.partnerLower.id) ?? 0)].sort((x,y)=>x-y);
    for (let i = 0; i < Math.min(aSeeds.length, bSeeds.length); i++) {
      if (aSeeds[i] !== bSeeds[i]) return aSeeds[i] - bSeeds[i];
    }
    return aSeeds.length - bSeeds.length;
  });

  return choices;
}

type FillResult = {
  match: BaseMatch;
  spread: number;
  bandSpan: number;
  targetDistance: number;
  targetMaxDistance: number;
};

function buildBalancedRemainder(
  ranks: Player[],
  usedIds: Set<string>,
  rankOf: Map<string, number>,
  cfg: GeneratorConfig,
  targetRank: number
): FillResult | undefined {
  const remaining = ranks.filter((player) => !usedIds.has(player.id));
  if (remaining.length === 0) return undefined;
  if (remaining.length !== 4) {
    throw new Error(`Bubble fill expects 4 leftover players, received ${remaining.length}`);
  }
  const sorted = [...remaining].sort((a, b) => {
    const ra = rankOf.get(a.id) ?? 0;
    const rb = rankOf.get(b.id) ?? 0;
    return ra - rb;
  });

  type FillOption = {
    teams: [[Player, Player], [Player, Player]];
    metrics: {
      distanceSum: number;
      maxDistance: number;
      spread: number;
      bandSpan: number;
      maxGap: number;
      capCount: number;
      sum: number;
      lexKey: number[];
    };
  };

  const options: FillOption[] = [];

  const pairings: Array<[[Player, Player], [Player, Player]]> = [
    // Prefer snake pairing first: top-bottom and mid-mid to match golden examples
    [[sorted[0], sorted[3]], [sorted[1], sorted[2]]],
    [[sorted[0], sorted[2]], [sorted[1], sorted[3]]],
    [[sorted[0], sorted[1]], [sorted[2], sorted[3]]],
  ];

  for (const [teamA, teamB] of pairings) {
    if (!isTeamValid(teamA, rankOf, cfg)) continue;
    if (!isTeamValid(teamB, rankOf, cfg)) continue;
    const gapA = partnerGap(rankOf, teamA[0], teamA[1]);
    const gapB = partnerGap(rankOf, teamB[0], teamB[1]);
    const ranksUsed = [...teamA, ...teamB].map((p) => rankOf.get(p.id) ?? 0);
    const sortedRanks = [...ranksUsed].sort((a, b) => a - b);
    const spread = sortedRanks[sortedRanks.length - 1] - sortedRanks[0];
    const bandValues = ranksUsed.map((rank) => bandIndex(rank, cfg));
    const bandSpan = Math.max(...bandValues) - Math.min(...bandValues);
    const distances = ranksUsed.map((rank) => Math.abs(rank - targetRank));
    const distanceSum = distances.reduce((acc, val) => acc + val, 0);
    const maxDistance = Math.max(...distances);
    options.push({
      teams: [teamA, teamB],
      metrics: {
        distanceSum,
        maxDistance,
        spread,
        bandSpan,
        maxGap: Math.max(gapA, gapB),
        capCount:
          (gapA === cfg.PARTNER_GAP_CAP ? 1 : 0) + (gapB === cfg.PARTNER_GAP_CAP ? 1 : 0),
        sum: gapA + gapB,
        lexKey: sortedRanks,
      },
    });
  }

  if (options.length === 0) return undefined;

  options.sort((a, b) => {
    if (a.metrics.distanceSum !== b.metrics.distanceSum) {
      return a.metrics.distanceSum - b.metrics.distanceSum;
    }
    if (a.metrics.maxDistance !== b.metrics.maxDistance) {
      return a.metrics.maxDistance - b.metrics.maxDistance;
    }
    if (a.metrics.spread !== b.metrics.spread) return a.metrics.spread - b.metrics.spread;
    if (a.metrics.bandSpan !== b.metrics.bandSpan) return a.metrics.bandSpan - b.metrics.bandSpan;
    // Prefer cross-band "snake" pairing in ties; this correlates with slightly larger maxGap
    if (a.metrics.maxGap !== b.metrics.maxGap) return b.metrics.maxGap - a.metrics.maxGap;
    if (a.metrics.capCount !== b.metrics.capCount) return a.metrics.capCount - b.metrics.capCount;
    if (a.metrics.sum !== b.metrics.sum) return a.metrics.sum - b.metrics.sum;
    const len = Math.min(a.metrics.lexKey.length, b.metrics.lexKey.length);
    for (let i = 0; i < len; i++) {
      if (a.metrics.lexKey[i] !== b.metrics.lexKey[i]) return a.metrics.lexKey[i] - b.metrics.lexKey[i];
    }
    return a.metrics.lexKey.length - b.metrics.lexKey.length;
  });

  const best = options[0];
  return {
    match: {
      teamA: best.teams[0],
      teamB: best.teams[1],
      meta: { reason: "balanced-remainder" },
    },
    spread: best.metrics.spread,
    bandSpan: best.metrics.bandSpan,
    targetDistance: best.metrics.distanceSum,
    targetMaxDistance: best.metrics.maxDistance,
  };
}

type WaveMetrics = {
  fillDistance: number;
  fillMaxDistance: number;
  fillSpread: number;
  fillBandSpan: number;
  gateDistance: number;
  maxGap: number;
  capCount: number;
  sumGap: number;
  lexKey: number[];
};

function computeWaveMetrics(
  matches: BaseMatch[],
  rankOf: Map<string, number>,
  cfg: GeneratorConfig,
  edgeIds: Set<string>,
  fillDistance: number,
  fillMaxDistance: number,
  fillSpread: number,
  fillBandSpan: number,
  gateDistance: number
): WaveMetrics {
  let maxGap = 0;
  let capCount = 0;
  let sumGap = 0;
  const partnerRanks: number[] = [];

  for (const match of matches) {
    for (const team of [match.teamA, match.teamB]) {
      const gap = partnerGap(rankOf, team[0], team[1]);
      maxGap = Math.max(maxGap, gap);
      sumGap += gap;
      if (gap === cfg.PARTNER_GAP_CAP) capCount += 1;
      for (const player of team) {
        if (!edgeIds.has(player.id)) {
          partnerRanks.push(rankOf.get(player.id) ?? 0);
        }
      }
    }
  }

  partnerRanks.sort((a, b) => a - b);

  return {
    fillDistance,
    fillMaxDistance,
    fillSpread,
    fillBandSpan,
    gateDistance,
    maxGap,
    capCount,
    sumGap,
    lexKey: partnerRanks,
  };
}

function compareWaveMetrics(a: WaveMetrics, b: WaveMetrics): number {
  // Prefer partners further from the gate centers (edge-vs-edge) to align with golden layouts
  if (a.gateDistance !== b.gateDistance) return b.gateDistance - a.gateDistance;
  if (a.fillDistance !== b.fillDistance) return a.fillDistance - b.fillDistance;
  if (a.fillMaxDistance !== b.fillMaxDistance) return a.fillMaxDistance - b.fillMaxDistance;
  if (a.fillSpread !== b.fillSpread) return a.fillSpread - b.fillSpread;
  if (a.fillBandSpan !== b.fillBandSpan) return a.fillBandSpan - b.fillBandSpan;
  if (a.maxGap !== b.maxGap) return a.maxGap - b.maxGap;
  if (a.capCount !== b.capCount) return a.capCount - b.capCount;
  if (a.sumGap !== b.sumGap) return a.sumGap - b.sumGap;
  const len = Math.min(a.lexKey.length, b.lexKey.length);
  for (let i = 0; i < len; i++) {
    if (a.lexKey[i] !== b.lexKey[i]) return a.lexKey[i] - b.lexKey[i];
  }
  return a.lexKey.length - b.lexKey.length;
}

export function generateExploratory(
  ranks: Player[],
  cfg: GeneratorConfig = DEFAULT_CFG
): BaseMatch[] {
  if (ranks.length % cfg.BAND_SIZE !== 0) {
    throw new Error("Exploratory: N must be divisible by BAND_SIZE.");
  }
  const rankOf = rankIndexLookup(ranks);
  const bands = bandsOfSize(ranks, cfg.BAND_SIZE);
  const matches: BaseMatch[] = [];

  for (let i = 0; i < bands.length; i += 2) {
    const bandA = bands[i];
    const bandB = bands[i + 1];
    if (bandB) {
      matches.push({
        teamA: [bandA[0], bandB[1]],
        teamB: [bandA[1], bandB[0]],
        meta: { reason: "exploratory-adjacent" },
      });
      matches.push({
        teamA: [bandA[2], bandB[3]],
        teamB: [bandA[3], bandB[2]],
        meta: { reason: "exploratory-adjacent" },
      });
    } else {
      matches.push({
        teamA: [bandA[0], bandA[3]],
        teamB: [bandA[1], bandA[2]],
        meta: { reason: "exploratory-intra-band" },
      });
    }
  }

  assertWaveMatches(ranks, matches, cfg, rankOf, "exploratory");
  return matches;
}

export function generateBubble(
  ranks: Player[],
  cfg: GeneratorConfig = DEFAULT_CFG
): BaseMatch[] {
  if (ranks.length % cfg.BAND_SIZE !== 0) {
    throw new Error("Bubble: N must be divisible by BAND_SIZE.");
  }

  const rankOf = rankIndexLookup(ranks);
  const gates = computeGates(ranks.length);
  if (gates.length === 0) {
    throw new Error("Bubble: requires at least one gate.");
  }

  const orderedGates = orderGatesCutoffFirst(ranks.length, gates);
  const primaryRank = primaryCutoffRank(ranks.length, gates);
  const bands = bandsOfSize(ranks, cfg.BAND_SIZE);
  const reservedEdgeIds = new Set<string>();
  for (const [lower, upper] of gates) {
    const upperEdge = ranks[lower - 1];
    const lowerEdge = ranks[upper - 1];
    reservedEdgeIds.add(upperEdge.id);
    reservedEdgeIds.add(lowerEdge.id);
  }

  const assignments: GateAssignment[] = [];
  const usedIds = new Set<string>();
  let best: { matches: BaseMatch[]; metrics: WaveMetrics } | undefined;

  const dfs = (index: number) => {
    if (index === orderedGates.length) {
      const fillResult = buildBalancedRemainder(ranks, usedIds, rankOf, cfg, primaryRank);
      if (!fillResult) return;
      const matches = assignments.map((a) => ({
        teamA: [...a.match.teamA],
        teamB: [...a.match.teamB],
        meta: a.match.meta ? { ...a.match.meta } : undefined,
      }));
      matches.push({
        teamA: [...fillResult.match.teamA],
        teamB: [...fillResult.match.teamB],
        meta: fillResult.match.meta ? { ...fillResult.match.meta } : undefined,
      });

            const gateDistance = assignments.reduce((sum, assignment) => {
        const [lower, upper] = assignment.gate;
        const center = (lower + upper) / 2;
        const partnerRanks = [
          rankOf.get(assignment.partnerUpper.id) ?? 0,
          rankOf.get(assignment.partnerLower.id) ?? 0,
        ];
        return sum + partnerRanks.reduce((acc, rank) => acc + Math.abs(rank - center), 0);
      }, 0);

      const metrics = computeWaveMetrics(
        matches,
        rankOf,
        cfg,
        reservedEdgeIds,
        fillResult.targetDistance,
        fillResult.targetMaxDistance,
        fillResult.spread,
        fillResult.bandSpan,
        gateDistance
      );
      if (!best || compareWaveMetrics(metrics, best.metrics) < 0) {
        best = { matches, metrics };
      }
      return;
    }

    const gate = orderedGates[index];
    const choices = enumerateGateChoices(gate, ranks, bands, cfg, rankOf, reservedEdgeIds, usedIds);
    // Deterministically prefer smaller max gap first, then sum, then lower partner seeds
    choices.sort((a, b) => {
      const aMax = Math.max(a.gaps[0], a.gaps[1]);
      const bMax = Math.max(b.gaps[0], b.gaps[1]);
      if (aMax !== bMax) return aMax - bMax;
      const aSum = a.gaps[0] + a.gaps[1];
      const bSum = b.gaps[0] + b.gaps[1];
      if (aSum !== bSum) return aSum - bSum;
      const aSeeds = [(rankOf.get(a.partnerUpper.id) ?? 0), (rankOf.get(a.partnerLower.id) ?? 0)].sort((x,y)=>x-y);
      const bSeeds = [(rankOf.get(b.partnerUpper.id) ?? 0), (rankOf.get(b.partnerLower.id) ?? 0)].sort((x,y)=>x-y);
      for (let i = 0; i < Math.min(aSeeds.length, bSeeds.length); i++) {
        if (aSeeds[i] !== bSeeds[i]) return aSeeds[i] - bSeeds[i];
      }
      return aSeeds.length - bSeeds.length;
    });

    for (const choice of choices) {
      assignments.push(choice);
      const added = [
        choice.upperEdge.id,
        choice.lowerEdge.id,
        choice.partnerUpper.id,
        choice.partnerLower.id,
      ];
      added.forEach((id) => usedIds.add(id));
      dfs(index + 1);
      assignments.pop();
      added.forEach((id) => usedIds.delete(id));
    }
  };

  dfs(0);

  if (!best) {
    throw new Error("Bubble: no feasible assignment (check rules).");
  }

  assertWaveMatches(ranks, best.matches, cfg, rankOf, "bubble");
  return best.matches;
}

export function generateWave(
  type: WaveType,
  ranks: Player[],
  cfg: GeneratorConfig = DEFAULT_CFG
): BaseMatch[] {
  return type === "explore"
    ? generateExploratory(ranks, cfg)
    : generateBubble(ranks, cfg);
}

function annotateMatches(
  matches: BaseMatch[],
  type: WaveType,
  wave: number,
  pointsTo: number
): TSMatch[] {
  return matches.map((match) => ({
    wave,
    type,
    pointsTo,
    teamA: [...match.teamA],
    teamB: [...match.teamB],
    meta: match.meta ? { ...match.meta } : undefined,
  }));
}

function summaryText(type: WaveType, N: number): string {
  if (type === "explore") {
    return "Broad, banded mix to refine rankings. Partners from same/adjacent bands; seed gap <=5. Avoids carry mode while gathering diverse signal.";
  }
  const gates = computeGates(N);
  const gateText = gates.map(([a, b]) => `${a}-${b}`).join(", ");
  const prefix = gateText ? `Gates: ${gateText}. ` : "";
  return `${prefix}Live promotion/demotion at band edges (edge vs edge) with balanced partners and banded fill. Win the bubble to move up; lose and you drop.`;
}

export function planRound(
  ranksAtStart: Player[],
  opts: { waves: 3 | 4; pointsTo?: number }
): WavePlan[] {
  if (ranksAtStart.length % BAND_SIZE !== 0) {
    throw new Error("TurboSmash Phase 1 supports N % 4 == 0 only");
  }
  const pointsTo = opts.pointsTo ?? defaultPointsForN(ranksAtStart.length);
  const order: WaveType[] = opts.waves === 3
    ? ["explore", "bubble", "bubble"]
    : ["explore", "bubble", "explore", "bubble"];

  const plans: WavePlan[] = [];
  for (let i = 0; i < order.length; i++) {
    const type = order[i];
    const baseMatches = type === "explore"
      ? generateExploratory(ranksAtStart, DEFAULT_CFG)
      : generateBubble(ranksAtStart, DEFAULT_CFG);
    const matches = annotateMatches(baseMatches, type, i + 1, pointsTo);
    plans.push({
      wave: i + 1,
      type,
      pointsTo,
      matches,
      summary: summaryText(type, ranksAtStart.length),
    });
  }
  return plans;
}







