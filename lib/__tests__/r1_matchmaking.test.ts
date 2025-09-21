import { describe, expect, it } from "vitest";
import {
  buildWave1,
  buildWave2,
  buildWave3,
  buildR1Wave,
  recordPartnersFromWave,
  medianTeamPoints,
  waveTeamScoresForMedian,
  PlayerLite,
} from "../r1_matchmaking";

function makePlayers(count: number): PlayerLite[] {
  return Array.from({ length: count }, (_, idx) => {
    const seed = idx + 1;
    return { id: `p${seed}`, name: `Player ${seed}`, seed };
  });
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

describe("buildWave1", () => {
  it("forms quartile pods for even fields", () => {
    const players = makePlayers(12);
    const wave = buildWave1(players, 1, players.length);
    expect(wave.matches).toHaveLength(3);
    expect(wave.matches[0].a).toEqual(["p1", "p10"]);
    expect(wave.matches[0].b).toEqual(["p4", "p7"]);
    expect(wave.matches[1].a).toEqual(["p2", "p11"]);
    expect(wave.matches[1].b).toEqual(["p5", "p8"]);
    expect(wave.byes).toBeUndefined();
  });

  it("selects rotating byes for odd fields", () => {
    const players = makePlayers(11);
    const wave = buildWave1(players, 1, players.length);
    expect(wave.matches).toHaveLength(2);
    expect(wave.byes).toEqual(["p11", "p10", "p9"]);
    const priorPartners = new Set<string>();
    recordPartnersFromWave(wave, priorPartners);
    const next = buildWave2(players, 2, players.length, priorPartners, { previousWaves: [wave] });
    expect(next.byes).toEqual(["p8", "p7", "p6"]);
  });
});

describe("buildWave2", () => {
  it("creates top and bubble pods with no partner repeats", () => {
    const players = makePlayers(12);
    const wave1 = buildWave1(players, 1, players.length);
    const priorPartners = new Set<string>();
    recordPartnersFromWave(wave1, priorPartners);
    const wave2 = buildWave2(players, 2, players.length, priorPartners, { previousWaves: [wave1], courts: 3 });
    expect(wave2.matches).toHaveLength(3);
    expect(wave2.matches[0].a).toEqual(["p1", "p6"]);
    expect(wave2.matches[0].b).toEqual(["p2", "p5"]);
    expect(priorPartners.has(pairKey("p1", "p6"))).toBe(true);
  });
});

describe("buildWave3", () => {
  it("builds showdown and promotion pods", () => {
    const players = makePlayers(12);
    const wave1 = buildWave1(players, 1, players.length);
    const priorPartners = new Set<string>();
    recordPartnersFromWave(wave1, priorPartners);
    const wave2 = buildWave2(players, 2, players.length, priorPartners, { previousWaves: [wave1] });
    recordPartnersFromWave(wave2, priorPartners);
    const wave3 = buildWave3(players, 3, players.length, priorPartners, { previousWaves: [wave1, wave2], courts: 3 });
    expect(wave3.matches[0].a).toEqual(["p1", "p4"]);
    expect(wave3.matches[0].b).toEqual(["p2", "p3"]);
    expect(wave3.matches[2].a).toEqual(["p9", "p12"]);
    expect(wave3.matches[2].b).toEqual(["p10", "p11"]);
  });
});

describe("buildR1Wave", () => {
  it("delegates to specific wave builders", () => {
    const players = makePlayers(8);
    const partners = new Set<string>();
    const w1 = buildR1Wave(1, players, players.length, partners);
    recordPartnersFromWave(w1, partners);
    const w2 = buildR1Wave(2, players, players.length, partners, { previousWaves: [w1] });
    expect(w1.index).toBe(1);
    expect(w2.index).toBe(2);
    expect(w2.matches.length).toBeGreaterThan(0);
  });
});

describe("median helpers", () => {
  it("computes medians from team scores", () => {
    expect(medianTeamPoints([10, 20, 30])).toBe(20);
    expect(medianTeamPoints([10, 20, 30, 40])).toBe(25);
  });

  it("collects wave team scores via lookup", () => {
    const players = makePlayers(8);
    const wave = buildWave1(players, 1, players.length);
    const scoreMap = new Map<string, number>();
    wave.matches.forEach((match, idx) => {
      scoreMap.set(pairKey(match.a[0], match.a[1]), 15 + idx);
      scoreMap.set(pairKey(match.b[0], match.b[1]), 10 + idx);
    });
    const scores = waveTeamScoresForMedian(wave, (team) => scoreMap.get(pairKey(team[0], team[1])));
    expect(scores).toHaveLength(4);
    expect(scores).toContain(15);
    expect(scores).toContain(10);
  });
});
