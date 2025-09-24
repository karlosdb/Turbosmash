import { describe, expect, it } from "vitest";
import type { Cfg, Match, Player } from "../waves";
import { generateEightShowdown, generateExploratory, planFirstRound } from "../waves";

const BAND_SIZE = 4;
const PARTNER_GAP_CAP = 2 * BAND_SIZE - 3;
const CFG: Cfg = { BAND_SIZE, PARTNER_GAP_CAP };

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, idx) => {
    const seed = idx + 1;
        return { id: `p${seed}`, seed };
  });
}

type SeedMatch = {
  type: Match["type"];
  teamA: [number, number];
  teamB: [number, number];
};

function toSeedMatches(matches: Match[]): SeedMatch[] {
  return matches.map((match) => ({
    type: match.type,
    teamA: [match.teamA[0].seed, match.teamA[1].seed],
    teamB: [match.teamB[0].seed, match.teamB[1].seed],
  }));
}

function assertWaveBasics(matches: Match[], players: Player[], cfg: Cfg) {
  expect(matches).toHaveLength(players.length / 4);
  const seen = new Map<string, number>();
  for (const match of matches) {
    for (const player of [...match.teamA, ...match.teamB]) {
      seen.set(player.id, (seen.get(player.id) ?? 0) + 1);
    }
    for (const team of [match.teamA, match.teamB]) {
      const gap = Math.abs(team[0].seed - team[1].seed);
      expect(gap).toBeLessThanOrEqual(cfg.PARTNER_GAP_CAP);
      const band = (seed: number) => Math.floor((seed - 1) / cfg.BAND_SIZE);
      const bandGap = Math.abs(band(team[0].seed) - band(team[1].seed));
      expect(bandGap).toBeLessThanOrEqual(1);
    }
  }
  for (const player of players) {
    expect(seen.get(player.id)).toBe(1);
  }
}

const EXPLORE_12: SeedMatch[] = [
  { type: "exploratory", teamA: [1, 6], teamB: [2, 5] },
  { type: "exploratory", teamA: [3, 8], teamB: [4, 7] },
  { type: "exploratory", teamA: [9, 12], teamB: [10, 11] },
];

const EXPLORE_16: SeedMatch[] = [
  { type: "exploratory", teamA: [1, 6], teamB: [2, 5] },
  { type: "exploratory", teamA: [3, 8], teamB: [4, 7] },
  { type: "exploratory", teamA: [9, 14], teamB: [10, 13] },
  { type: "exploratory", teamA: [11, 16], teamB: [12, 15] },
];

const EIGHT_12: SeedMatch[] = [
  { type: "eight", teamA: [5, 10], teamB: [6, 9] },
  { type: "eight", teamA: [7, 12], teamB: [8, 11] },
  { type: "exploratory", teamA: [1, 4], teamB: [2, 3] },
];

const EIGHT_16: SeedMatch[] = [
  { type: "eight", teamA: [9, 14], teamB: [10, 13] },
  { type: "eight", teamA: [11, 16], teamB: [12, 15] },
  { type: "exploratory", teamA: [1, 6], teamB: [2, 5] },
  { type: "exploratory", teamA: [3, 8], teamB: [4, 7] },
];

describe("generateExploratory", () => {
  it("matches golden layout for N=12", () => {
    const players = makePlayers(12);
    const matches = generateExploratory(players, CFG);
    assertWaveBasics(matches, players, CFG);
    expect(toSeedMatches(matches)).toEqual(EXPLORE_12);
  });

  it("matches golden layout for N=16", () => {
    const players = makePlayers(16);
    const matches = generateExploratory(players, CFG);
    assertWaveBasics(matches, players, CFG);
    expect(toSeedMatches(matches)).toEqual(EXPLORE_16);
  });
});

describe("generateEightShowdown", () => {
  it("focuses bottom two bands for N=12", () => {
    const players = makePlayers(12);
    const matches = generateEightShowdown(players, CFG);
    assertWaveBasics(matches, players, CFG);
    expect(toSeedMatches(matches)).toEqual(EIGHT_12);
  });

  it("focuses bottom two bands for N=16", () => {
    const players = makePlayers(16);
    const matches = generateEightShowdown(players, CFG);
    assertWaveBasics(matches, players, CFG);
    expect(toSeedMatches(matches)).toEqual(EIGHT_16);
  });
});

describe("planFirstRound", () => {
  it("runs exploratory -> eight -> exploratory -> eight program", () => {
    const players = makePlayers(16);
    const plan = planFirstRound(players, CFG);
    expect(plan).toHaveLength(4);
    plan.forEach((wave) => {
      assertWaveBasics(wave, players, CFG);
    });
    expect(toSeedMatches(plan[0])).toEqual(EXPLORE_16);
    expect(toSeedMatches(plan[1])).toEqual(EIGHT_16);
    expect(toSeedMatches(plan[2])).toEqual(EXPLORE_16);
    expect(toSeedMatches(plan[3])).toEqual(EIGHT_16);
  });
});
