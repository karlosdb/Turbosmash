import { describe, expect, it } from "vitest";
import { actualShare, doublesEloDelta, effTeam, expectedShare, waveClamp } from "../rating";

describe("effTeam", () => {
  it("penalizes uneven pairings", () => {
    expect(effTeam(1000, 1000)).toBe(1000);
    expect(effTeam(1100, 900)).toBeCloseTo(994, 4);
  });
});

describe("expectedShare", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(expectedShare(1000, 1000)).toBeCloseTo(0.5, 4);
  });

  it("favors the stronger team", () => {
    expect(expectedShare(1050, 950)).toBeGreaterThan(0.5);
  });
});

describe("actualShare", () => {
  it("clamps to avoid extremes", () => {
    expect(actualShare(21, 0)).toBeCloseTo(0.95, 4);
    expect(actualShare(0, 21)).toBeCloseTo(0.05, 4);
  });
});

describe("waveClamp", () => {
  it("returns wave-specific caps for round 1", () => {
    expect(waveClamp(1, 1)).toBe(20);
    expect(waveClamp(1, 2)).toBe(30);
    expect(waveClamp(1, 3)).toBe(40);
  });

  it("returns 40 outside round 1", () => {
    expect(waveClamp(2)).toBe(40);
    expect(waveClamp(3)).toBe(40);
  });
});

describe("doublesEloDelta", () => {
  it("applies symmetric deltas for round 1 wave 1", () => {
    const { dA, dB } = doublesEloDelta(1000, 1000, 1000, 1000, 21, 18, 1, 1, false, false, false, false, 1);
    expect(dA).toBeGreaterThan(0);
    expect(dA).toBeLessThanOrEqual(20);
    expect(dB).toBeCloseTo(-dA, 10);
  });

  it("accounts for later round shorter games", () => {
    const { dA, dB } = doublesEloDelta(1025, 1010, 995, 980, 15, 13, 2, undefined, false, false, false, false, 4);
    expect(Math.sign(dA)).toBe(1);
    expect(Math.sign(dB)).toBe(-1);
    expect(dA + dB).toBeCloseTo(0, 10);
    expect(Math.abs(dA)).toBeLessThanOrEqual(40);
  });
});
