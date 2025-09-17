export type Player = {
  id: string;
  name: string;
  seed: number;
  rating: number; // starts at 1000
  gamesPlayed: number;
  eliminatedAtRound?: 1 | 2;
  pointsFor: number;
  pointsAgainst: number;
  lastPlayedAt?: number; // timestamp used to break ties for benching
};

export type Match = {
  id: string;
  roundIndex: 1 | 2 | 3;
  court: number;
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
};

export type EventState = {
  players: Player[];
  rounds: Round[]; // 3 entries once generated
  currentRound: 1 | 2 | 3;
  createdAt: string;
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


