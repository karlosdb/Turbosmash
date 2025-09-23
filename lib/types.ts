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
  eliminatedAtRound?: 1 | 2;
  lockedRank?: number;
  lastPartnerId?: string;
  recentOpponents?: string[];
  lastPlayedAt?: number;
};

export type Match = {
  id: string;
  roundIndex: 1 | 2 | 3;
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
  index: 1 | 2 | 3;
  matches: Match[];
  status: "pending" | "active" | "closed";
  currentWave?: number;
  totalWaves?: number;
  waveSizes?: number[];
};

export type R1WaveOrder = "explore-showdown-explore-showdown" | "explore-explore-showdown";

export type SchedulePrefs = {
  courts: number;
  r1TargetGamesPerPlayer: number;
  r2TargetGamesPerPlayer: number;
  r1WaveOrder: R1WaveOrder;
};

export type EventState = {
  players: Player[];
  rounds: Round[];
  currentRound: 1 | 2 | 3;
  createdAt: string;
  schedulePrefs: SchedulePrefs;
  r1Signature?: string;
  // Capture starting ratings to compute post-event Elo deltas
  initialRatingsById?: Record<string, number>;
  // Deterministic R1 group assignments (by player id)
  r1Groups?: string[][];
};

export type Id = string;

export function defaultSchedulePrefs(): SchedulePrefs {
  return {
    courts: 3,
    r1TargetGamesPerPlayer: 3,
    r2TargetGamesPerPlayer: 2,
    r1WaveOrder: "explore-showdown-explore-showdown",
  };
}

export function createEmptyEvent(): EventState {
  return {
    players: [],
    rounds: [],
    currentRound: 1,
    createdAt: new Date().toISOString(),
    schedulePrefs: defaultSchedulePrefs(),
  };
}

export function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return items.reduce<Record<string, T>>((map, item) => {
    map[item.id] = item;
    return map;
  }, {});
}



