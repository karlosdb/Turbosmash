export type Player = {
  id: string;
  name: string;
  seed: number;
  rating: number; // starts at 1000
  gamesPlayed: number;
  eliminatedAtRound?: 1 | 2;
  lockedRank?: number; // fixed leaderboard placement once eliminated
  pointsFor: number;
  pointsAgainst: number;
  lastPlayedAt?: number; // timestamp used to break ties for benching
};

export type Match = {
  id: string;
  roundIndex: 1 | 2 | 3;
  court: number;
  /** Optional mini-round batch index (1-based) for Round 1 batching */
  miniRound?: number;
  a1: string; // player id
  a2: string; // player id
  b1: string; // player id
  b2: string; // player id
  scoreA?: number; // points
  scoreB?: number; // points
  status: "scheduled" | "completed";
  notes?: string[]; // e.g., compromises like repeat partner unavoidable
};

export type Round = {
  index: 1 | 2 | 3;
  matches: Match[];
  status: "pending" | "active" | "closed";
  /** Round 1 only: current mini-round index (1-based). 0 means none generated yet. */
  currentMiniRound?: number;
  /** Round 1 only: number of matches to schedule per mini-round */
  miniRoundSize?: number;
  /** Round 1 only: target games per player (default 3) */
  targetGames?: number;
};

export type EventState = {
  players: Player[];
  rounds: Round[]; // 3 entries once generated
  currentRound: 1 | 2 | 3;
  createdAt: string;
  /** Signature of players+seeds when Round 1 was last generated */
  r1Signature?: string;
};

export type Id = string;

export function createEmptyEvent(): EventState {
  return {
    players: [],
    rounds: [],
    currentRound: 1,
    createdAt: new Date().toISOString(),
  };
}

export function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return items.reduce<Record<string, T>>((map, item) => {
    map[item.id] = item;
    return map;
  }, {});
}


