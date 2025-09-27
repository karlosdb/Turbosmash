export type RoundKind = "prelim" | "eight" | "final";

export type RoundPlanEntry = {
  index: number;
  kind: RoundKind;
  targetSize: number;
};

export type Player = {
  id: string;
  name: string;
  seed: number;
  rating: number;
  // Log of Elo updates with brief reasoning strings
  eloLog?: { matchId: string; delta: number; reason: string }[];
  seedPrior?: number;
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  eliminatedAtRound?: number;
  lockedRank?: number;
  lastPartnerId?: string;
  recentOpponents?: string[];
  lastPlayedAt?: number;
};

export type Match = {
  id: string;
  roundIndex: number;
  miniRoundIndex?: number;
  court: number;
  // Deterministic grouping identifier for Round 1/2 scheduling
  groupIndex?: number;
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  a1Rank?: number;
  a2Rank?: number;
  b1Rank?: number;
  b2Rank?: number;
  scoreA?: number;
  scoreB?: number;
  status: "scheduled" | "completed";
  compromise?: "repeat-partner" | "repeat-opponent" | "rating-gap";
};

export type Round = {
  index: number;
  kind: RoundKind;
  matches: Match[];
  status: "pending" | "active" | "closed";
  currentWave?: number;
  totalWaves?: number;
  waveSizes?: number[];
  targetSize?: number;
};

export type R1WaveOrder = "explore-showdown-explore-showdown" | "explore-explore-showdown";

export type SchedulePrefs = {
  // Legacy fields keep persisted data compatible
  r1ScoreCap?: number;
  r2ScoreCap?: number;
  r3ScoreCap?: number;
  r1TargetGamesPerPlayer: number;
  r2TargetGamesPerPlayer: number;
  r1WaveOrder: R1WaveOrder;

  // Generic dynamic system
  roundScoreCaps?: Record<number, number>;
  roundCustomCaps?: Record<number, number>;
  roundTargetGames?: Record<number, number>;
  roundMultipliers?: Record<number, number>;
  roundWaveOrders?: Record<number, R1WaveOrder>;

  threeRoundCap?: boolean;
};

export type EventState = {
  players: Player[];
  rounds: Round[];
  currentRound: number;
  createdAt: string;
  schedulePrefs: SchedulePrefs;

  // Legacy fields (backward compatibility)
  r1Signature?: string;
  r1Groups?: string[][]; // Deterministic R1 group assignments (by player id)

  // Generic round tracking
  roundSignatures?: Record<number, string>;
  roundGroups?: Record<number, string[][]>;

  // Capture starting ratings to compute post-event Elo deltas
  initialRatingsById?: Record<string, number>;
  roundPlan?: RoundPlanEntry[];
};

export type Id = string;

const DEFAULT_R1_WAVE_ORDER: R1WaveOrder = "explore-showdown-explore-showdown";
const DEFAULT_ROUND_TARGET_GAMES: Record<number, number> = { 1: 3, 2: 2 };
const DEFAULT_ROUND_MULTIPLIERS: Record<number, number> = { 1: 1.0, 2: 1.2, 3: 1.4 };

export function defaultSchedulePrefs(): SchedulePrefs {
  return {
    r1ScoreCap: 15,
    r2ScoreCap: 11,
    r3ScoreCap: 11,
    r1TargetGamesPerPlayer: 3,
    r2TargetGamesPerPlayer: 2,
    r1WaveOrder: DEFAULT_R1_WAVE_ORDER,
    roundScoreCaps: {},
    roundTargetGames: { ...DEFAULT_ROUND_TARGET_GAMES },
    roundMultipliers: { ...DEFAULT_ROUND_MULTIPLIERS },
    roundWaveOrders: { 1: DEFAULT_R1_WAVE_ORDER },
    threeRoundCap: false,
  };
}

export function createEmptyEvent(): EventState {
  return {
    players: [],
    rounds: [],
    currentRound: 1,
    createdAt: new Date().toISOString(),
    schedulePrefs: defaultSchedulePrefs(),
    roundPlan: [],
  };
}

export function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return items.reduce<Record<string, T>>((map, item) => {
    map[item.id] = item;
    return map;
  }, {});
}