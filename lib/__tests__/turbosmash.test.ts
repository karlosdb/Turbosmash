import { describe, expect, it } from "vitest";
import { Player } from "../types";
import {
  BAND_SIZE,
  PARTNER_GAP_CAP,
  computeGates,
  generateExploratory,
  generateWave,
  planRound,
  defaultPointsForN,
} from "../turbosmash";

type SeedMatch = {
  teamA: [number, number];
  teamB: [number, number];
  gate?: [number, number];
};

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, idx) => {
    const seed = idx + 1;
    return {
      id: `p${seed}`,
      name: `Player ${seed}`,
      seed,
      rating: 1000,
      gamesPlayed: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    } satisfies Player;
  });
}

function ranksForN(N: 8 | 12 | 16 | 20 | 24) {
  return makePlayers(N);
}

function toSeedMatches<T extends { teamA: [Player, Player]; teamB: [Player, Player]; meta?: { gate?: [number, number] } }>(
  matches: T[]
): SeedMatch[] {
  return matches.map((match) => ({
    teamA: [match.teamA[0].seed, match.teamA[1].seed],
    teamB: [match.teamB[0].seed, match.teamB[1].seed],
    gate: match.meta?.gate,
  }));
}

function assertWaveBasics<T extends { teamA: [Player, Player]; teamB: [Player, Player] }>(
  matches: T[],
  N: number
) {
  expect(matches).toHaveLength(N / 4);
  const ids = new Set<string>();
  for (const match of matches) {
    for (const player of [...match.teamA, ...match.teamB]) {
      ids.add(player.id);
    }
    for (const team of [match.teamA, match.teamB]) {
      const gap = Math.abs(team[0].seed - team[1].seed);
      expect(gap).toBeLessThanOrEqual(PARTNER_GAP_CAP);
      const band = (seed: number) => Math.floor((seed - 1) / BAND_SIZE);
      const bandGap = Math.abs(band(team[0].seed) - band(team[1].seed));
      expect(bandGap).toBeLessThanOrEqual(1);
    }
  }
  expect(ids.size).toBe(N);
}

const EXPLORE_12: SeedMatch[] = [
  { teamA: [1, 6], teamB: [2, 5] },
  { teamA: [3, 8], teamB: [4, 7] },
  { teamA: [9, 12], teamB: [10, 11] },
];

const EXPLORE_16: SeedMatch[] = [
  { teamA: [1, 6], teamB: [2, 5] },
  { teamA: [3, 8], teamB: [4, 7] },
  { teamA: [9, 14], teamB: [10, 13] },
  { teamA: [11, 16], teamB: [12, 15] },
];

describe("computeGates", () => {
  it("lists expected gates for phase-one cohort sizes", () => {
    expect(computeGates(12)).toEqual([[4, 5], [8, 9]]);
    expect(computeGates(16)).toEqual([[4, 5], [8, 9], [12, 13]]);
    expect(computeGates(20)).toEqual([[4, 5], [8, 9], [12, 13], [16, 17]]);
    expect(computeGates(24)).toEqual([[4, 5], [8, 9], [12, 13], [16, 17], [20, 21]]);
  });
});

describe("Exploratory generator", () => {
  it("matches golden layout for N=12", () => {
    const ranks = ranksForN(12);
    const matches = generateExploratory(ranks);
    assertWaveBasics(matches, 12);
    expect(toSeedMatches(matches)).toEqual(EXPLORE_12);
  });

  it("matches golden layout for N=16", () => {
    const ranks = ranksForN(16);
    const matches = generateExploratory(ranks);
    assertWaveBasics(matches, 16);
    expect(toSeedMatches(matches)).toEqual(EXPLORE_16);
  });
});

describe("Wave programs", () => {
  it("3-wave program (E -> B -> B) uses golden layouts for N=12", () => {
    const ranks = ranksForN(12);
    const plan = planRound(ranks, { waves: 3 });
    expect(plan).toHaveLength(3);
    expect(plan[0].type).toBe("explore");
    expect(plan[1].type).toBe("bubble");
    expect(plan[2].type).toBe("bubble");
    plan.forEach((wave) => {
      expect(wave.pointsTo).toBe(defaultPointsForN(12));
      expect(wave.matches[0].wave).toBe(wave.wave);
      expect(wave.matches.every((m) => m.type === wave.type)).toBe(true);
    });
    expect(toSeedMatches(plan[0].matches)).toEqual(EXPLORE_12);
  });

  it("4-wave program (E -> B -> E -> B) uses golden layouts for N=16", () => {
    const ranks = ranksForN(16);
    const plan = planRound(ranks, { waves: 4 });
    expect(plan).toHaveLength(4);
    expect(plan.map((w) => w.type)).toEqual(["explore", "bubble", "explore", "bubble"]);
    plan.forEach((wave) => {
      expect(wave.pointsTo).toBe(defaultPointsForN(16));
      assertWaveBasics(wave.matches, 16);
    });
    expect(toSeedMatches(plan[0].matches)).toEqual(EXPLORE_16);
    expect(toSeedMatches(plan[2].matches)).toEqual(EXPLORE_16);
  });
});

describe("Determinism", () => {
  it("same inputs produce identical plans for both cohort sizes", () => {
    const ranks12 = ranksForN(12);
    const first12 = planRound(ranks12, { waves: 4 });
    const second12 = planRound(ranks12, { waves: 4 });
    expect(JSON.stringify(first12)).toBe(JSON.stringify(second12));

    const ranks16 = ranksForN(16);
    const first16 = planRound(ranks16, { waves: 4 });
    const second16 = planRound(ranks16, { waves: 4 });
    expect(JSON.stringify(first16)).toBe(JSON.stringify(second16));
  });
});

describe("generateWave helper", () => {
  it("routes to the specific generators", () => {
    const ranks = ranksForN(12);
    expect(toSeedMatches(generateWave("explore", ranks))).toEqual(EXPLORE_12);
  });
});

