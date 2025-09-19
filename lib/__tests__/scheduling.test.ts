import { describe, expect, it } from "vitest";
import { matchesNeeded, targetGamesPerRound, wavesNeeded } from "../scheduling";

describe("targetGamesPerRound", () => {
  it("returns configured targets", () => {
    expect(targetGamesPerRound(1)).toBe(3);
    expect(targetGamesPerRound(2)).toBe(2);
    expect(targetGamesPerRound(3)).toBe(0);
  });
});

describe("matchesNeeded", () => {
  it("computes round 1 matches for various field sizes", () => {
    expect(matchesNeeded(8, 1)).toBe(6);
    expect(matchesNeeded(12, 1)).toBe(9);
    expect(matchesNeeded(16, 1)).toBe(12);
  });

  it("returns 3 for the final round to cover partner swaps", () => {
    expect(matchesNeeded(4, 3)).toBe(3);
    expect(matchesNeeded(8, 3)).toBe(3);
  });

  it("handles round 2 target gracefully", () => {
    expect(matchesNeeded(8, 2)).toBe(4);
    expect(matchesNeeded(12, 2)).toBe(6);
  });
});

describe("wavesNeeded", () => {
  it("scales with available courts", () => {
    expect(wavesNeeded(9, 4)).toBe(3);
    expect(wavesNeeded(6, 2)).toBe(3);
    expect(wavesNeeded(12, 3)).toBe(4);
  });
});
