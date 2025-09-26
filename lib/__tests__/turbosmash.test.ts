import { describe, expect, it } from "vitest";
import type { Cfg, Match, Player } from "../waves";
import { generateExploratory, planFirstRound } from "../waves";

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
  teamA: [number, number];
  teamB: [number, number];
};

function toSeedMatches(matches: Match[]): SeedMatch[] {
  return matches.map((match) => ({
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

describe("planFirstRound", () => {
  it("runs four exploratory waves using snake orientation", () => {
    const players = makePlayers(16);
    const plan = planFirstRound(players, CFG);
    expect(plan).toHaveLength(4);
    plan.forEach((wave) => {
      assertWaveBasics(wave, players, CFG);
      expect(wave.every((match) => match.type === "exploratory")).toBe(true);
      expect(toSeedMatches(wave)).toEqual(EXPLORE_16);
    });
  });
});
