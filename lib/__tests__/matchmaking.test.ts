import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeRoundPlan, generateR1Wave, generateLaterRound, prepareRound1 } from "../matchmaking";
import { defaultSchedulePrefs, Player, Round } from "../types";

function makePlayer(seed: number, overrides: Partial<Player> = {}): Player {
  return {
    id: `p${seed}`,
    name: overrides.name ?? `Player ${seed}`,
    seed,
    rating: overrides.rating ?? 1200 - seed * 3,
    gamesPlayed: overrides.gamesPlayed ?? 0,
    pointsFor: overrides.pointsFor ?? 0,
    pointsAgainst: overrides.pointsAgainst ?? 0,
    seedPrior: overrides.seedPrior,
    eloLog: overrides.eloLog,
    eliminatedAtRound: overrides.eliminatedAtRound,
    lockedRank: overrides.lockedRank,
    lastPartnerId: overrides.lastPartnerId,
    recentOpponents: overrides.recentOpponents,
    lastPlayedAt: overrides.lastPlayedAt,
  };
}

function createPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, idx) => makePlayer(idx + 1));
}

function markCompleted(matches: Round["matches"], scores: Array<[number, number]>): Round["matches"] {
  return matches.map((match, idx) => {
    const [scoreA, scoreB] = scores[idx] ?? [15, 11];
    return {
      ...match,
      status: "completed" as const,
      scoreA,
      scoreB,
    };
  });
}

function setupDeterministicIds() {
  const randomValues = [0.12345, 0.54321, 0.22222, 0.88888];
  let randomIdx = 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    const value = randomValues[randomIdx % randomValues.length];
    randomIdx += 1;
    return value;
  });
  let now = 1_700_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => {
    now += 17;
    return now;
  });
}

describe("computeRoundPlan", () => {
  it("produces expected plan for 14 players", () => {
    const prefs = defaultSchedulePrefs();
    const plan = computeRoundPlan(14, prefs);
    expect(plan.map((p) => p.targetSize)).toEqual([8, 4, 4]);
  });

  it("produces expected plan for 16 players", () => {
    const prefs = defaultSchedulePrefs();
    const plan = computeRoundPlan(16, prefs);
    expect(plan.map((p) => p.targetSize)).toEqual([12, 8, 4, 4]);
  });

  it("produces expected plan for 18 players", () => {
    const prefs = defaultSchedulePrefs();
    const plan = computeRoundPlan(18, prefs);
    expect(plan.map((p) => p.targetSize)).toEqual([12, 8, 4, 4]);
  });

  it("produces expected plan for 20 players", () => {
    const prefs = defaultSchedulePrefs();
    const plan = computeRoundPlan(20, prefs);
    expect(plan.map((p) => p.targetSize)).toEqual([16, 12, 8, 4, 4]);
  });

  it("honors three-round cap preference", () => {
    const prefs = { ...defaultSchedulePrefs(), threeRoundCap: true };
    const plan = computeRoundPlan(18, prefs);
    expect(plan.map((p) => p.targetSize)).toEqual([8, 4, 4]);
  });
});
describe("generateR1Wave", () => {
  beforeEach(() => {
    setupDeterministicIds();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates explore wave pairings from seed order", () => {
    const players = createPlayers(8);
    const prefs = defaultSchedulePrefs();
    const round = prepareRound1(players, prefs);

    const { matches, benched } = generateR1Wave(1, players, round, [], prefs);

    expect(benched).toEqual([]);
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.roundIndex === 1 && m.miniRoundIndex === 1)).toBe(true);
    expect(matches.map((m) => [m.a1, m.a2, m.b1, m.b2])).toEqual([
      ["p1", "p6", "p2", "p5"],
      ["p3", "p8", "p4", "p7"],
    ]);
  });

  it("uses completed results to seed showdown wave order", () => {
    const players = createPlayers(8);
    const prefs = defaultSchedulePrefs();
    const round = prepareRound1(players, prefs);

    const wave1 = generateR1Wave(1, players, round, [], prefs);
    const roundAfterWave1: Round = {
      ...round,
      matches: markCompleted(wave1.matches, [
        [15, 7],
        [11, 15],
      ]),
    };

    const { matches } = generateR1Wave(2, players, roundAfterWave1, [], prefs);

    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.roundIndex === 1 && m.miniRoundIndex === 2)).toBe(true);
    expect(matches.map((m) => [m.a1, m.a2, m.b1, m.b2])).toEqual([
      ["p1", "p8", "p6", "p3"],
      ["p4", "p5", "p7", "p2"],
    ]);
  });
});

describe("generateLaterRound", () => {
  beforeEach(() => {
    setupDeterministicIds();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds round-two exploratory and showdown waves", () => {
    const players = createPlayers(8);
    const prefs = defaultSchedulePrefs();
    const round = prepareRound1(players, prefs);
    const wave1 = generateR1Wave(1, players, round, [], prefs);
    const roundAfterWave1: Round = {
      ...round,
      matches: markCompleted(wave1.matches, [
        [15, 7],
        [11, 15],
      ]),
    };
    const wave2 = generateR1Wave(2, players, roundAfterWave1, [], prefs);
    const roundAfterWave2: Round = {
      ...roundAfterWave1,
      matches: [
        ...roundAfterWave1.matches,
        ...markCompleted(wave2.matches, [
          [13, 15],
          [15, 9],
        ]),
      ],
    };

    const matches = generateLaterRound(players, [roundAfterWave2], 2, "eight");

    expect(matches).toHaveLength(4);
    const wave1Matches = matches.filter((m) => m.miniRoundIndex === 1);
    const wave2Matches = matches.filter((m) => m.miniRoundIndex === 2);
    expect(wave1Matches).toHaveLength(2);
    expect(wave2Matches).toHaveLength(2);
    expect(new Set(matches.map((m) => m.groupIndex))).toEqual(new Set([1]));
    expect(matches.map((m) => [m.a1, m.a2, m.b1, m.b2])).toEqual([
      ["p4", "p7", "p6", "p5"],
      ["p1", "p2", "p3", "p8"],
      ["p4", "p7", "p6", "p5"],
      ["p1", "p2", "p3", "p8"],
    ]);
  });

  it("creates final four rotation when four players remain", () => {
    const finalists = createPlayers(4);
    const matches = generateLaterRound(finalists, [], 3, "final");

    expect(matches).toHaveLength(3);
    expect(matches.map((m) => [m.a1, m.a2, m.b1, m.b2])).toEqual([
      ["p1", "p2", "p3", "p4"],
      ["p1", "p3", "p2", "p4"],
      ["p1", "p4", "p2", "p3"],
    ]);
    expect(matches.map((m) => m.miniRoundIndex)).toEqual([1, 1, 1]);
  });
});




