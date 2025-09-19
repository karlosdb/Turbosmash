import { describe, expect, it } from "vitest";
import { blended, seedPrior } from "../seeding";

describe("seedPrior", () => {
  it("is monotonic with lower seeds receiving higher priors", () => {
    const priors = Array.from({ length: 8 }, (_, i) => seedPrior(i + 1, 8));
    for (let i = 0; i < priors.length - 1; i++) {
      expect(priors[i]).toBeGreaterThan(priors[i + 1]);
    }
  });

  it("centers around 1000", () => {
    const avg = seedPrior(4, 7);
    expect(avg).toBeCloseTo(1000, 2);
  });
});

describe("blended", () => {
  it("returns the prior when beta is 0", () => {
    expect(blended(1100, 1000, 0)).toBe(1000);
  });

  it("returns the rating when beta is 1", () => {
    expect(blended(1100, 1000, 1)).toBe(1100);
  });

  it("interpolates proportionally otherwise", () => {
    expect(blended(1100, 1000, 0.4)).toBeCloseTo(1040, 4);
  });
});
