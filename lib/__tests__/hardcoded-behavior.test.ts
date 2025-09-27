import { describe, it, expect } from "vitest";
import {
  getRoundScoreCap,
  getRoundTargetGames,
  getRoundMultiplier,
  getRoundWaveOrder,
  getRoundCustomCap,
  setRoundCustomCap,
  setRoundScoreCap,
  setRoundWaveOrder,
  shouldShowWaveLabel,
  shouldShowSpecialRoundUI,
} from "../round-preferences";
import {
  capRef,
  capRefGeneric,
  adjustExpectationForRace,
  adjustExpectationForRaceGeneric,
  kBaseScaled,
  kBaseScaledGeneric,
} from "../rating";
import {
  targetGamesPerRound,
  matchesNeeded,
  targetGamesPerRoundGeneric,
  matchesNeededGeneric,
} from "../scheduling";
import { defaultSchedulePrefs, type SchedulePrefs } from "../types";

const makePrefs = (): SchedulePrefs => ({ ...defaultSchedulePrefs() });

const withoutDynamicPrefs = (prefs: SchedulePrefs): SchedulePrefs => {
  const clone: SchedulePrefs = { ...prefs };
  delete (clone as Record<string, unknown>).roundScoreCaps;
  delete (clone as Record<string, unknown>).roundCustomCaps;
  delete (clone as Record<string, unknown>).roundTargetGames;
  delete (clone as Record<string, unknown>).roundMultipliers;
  delete (clone as Record<string, unknown>).roundWaveOrders;
  return clone;
};

describe("round score caps", () => {
  it("matches legacy defaults when dynamic values are absent", () => {
    const prefs = withoutDynamicPrefs(makePrefs());

    expect(getRoundScoreCap(1, prefs)).toBe(prefs.r1ScoreCap ?? 21);
    expect(getRoundScoreCap(2, prefs)).toBe(prefs.r2ScoreCap ?? 11);
    expect(getRoundScoreCap(3, prefs)).toBe(prefs.r3ScoreCap ?? 11);
    expect(getRoundScoreCap(4, prefs)).toBe(11);

    const missingLegacy = { ...prefs, r1ScoreCap: undefined, r2ScoreCap: undefined, r3ScoreCap: undefined } as SchedulePrefs;
    expect(getRoundScoreCap(1, missingLegacy)).toBe(21);
    expect(getRoundScoreCap(2, missingLegacy)).toBe(11);
    expect(getRoundScoreCap(3, missingLegacy)).toBe(11);
  });

  it("prefers dynamic overrides when provided", () => {
    const prefs = makePrefs();
    const dynamicPrefs: SchedulePrefs = {
      ...withoutDynamicPrefs(prefs),
      roundScoreCaps: { 1: 23, 2: 12, 5: 19 },
    };

    expect(getRoundScoreCap(1, dynamicPrefs)).toBe(23);
    expect(getRoundScoreCap(2, dynamicPrefs)).toBe(12);
    expect(getRoundScoreCap(5, dynamicPrefs)).toBe(19);
  });

  it("merges updates without losing existing caps", () => {
    const prefs = makePrefs();
    const patch = setRoundScoreCap(2, 13, prefs);
    const merged = { ...prefs, ...patch };

    expect(getRoundScoreCap(2, merged)).toBe(13);
    expect(getRoundScoreCap(1, merged)).toBe(prefs.r1ScoreCap ?? 21);

    const secondPatch = setRoundScoreCap(4, 17, merged);
    const mergedAgain = { ...merged, ...secondPatch };
    expect(getRoundScoreCap(2, mergedAgain)).toBe(13);
    expect(getRoundScoreCap(4, mergedAgain)).toBe(17);
  });
});

describe("round target games", () => {
  it("matches legacy hardcoded values when dynamic config is absent", () => {
    const prefs = withoutDynamicPrefs(makePrefs());

    expect(getRoundTargetGames(1, prefs)).toBe(3);
    expect(getRoundTargetGames(2, prefs)).toBe(2);
    expect(getRoundTargetGames(3, prefs)).toBe(0);
    expect(getRoundTargetGames(4, prefs)).toBe(0);
  });

  it("respects dynamic overrides", () => {
    const prefs = {
      ...makePrefs(),
      roundTargetGames: { 1: 4, 3: 1 },
    } satisfies SchedulePrefs;

    expect(getRoundTargetGames(1, prefs)).toBe(4);
    expect(getRoundTargetGames(3, prefs)).toBe(1);
    expect(getRoundTargetGames(2, prefs)).toBe(2);
  });
});

describe("round multiplier logic", () => {
  it("matches legacy escalation pattern", () => {
    const prefs = withoutDynamicPrefs(makePrefs());

    expect(getRoundMultiplier(1, prefs)).toBe(1.0);
    expect(getRoundMultiplier(2, prefs)).toBe(1.2);
    expect(getRoundMultiplier(3, prefs)).toBe(1.4);
    expect(getRoundMultiplier(4, prefs)).toBe(1.6);
    expect(getRoundMultiplier(7, prefs)).toBeCloseTo(2.2, 6);
  });

  it("uses dynamic multipliers when supplied", () => {
    const prefs = {
      ...makePrefs(),
      roundMultipliers: { 2: 1.25, 5: 2.0 },
    } satisfies SchedulePrefs;

    expect(getRoundMultiplier(2, prefs)).toBe(1.25);
    expect(getRoundMultiplier(5, prefs)).toBe(2.0);
  });
});

describe("wave order helpers", () => {
  it("falls back to round 1 order when unspecified", () => {
    const prefs = withoutDynamicPrefs(makePrefs());
    expect(getRoundWaveOrder(1, prefs)).toBe(prefs.r1WaveOrder);
    expect(getRoundWaveOrder(2, prefs)).toBe(prefs.r1WaveOrder);
  });

  it("inherits previous round order when later rounds lack explicit config", () => {
    const prefs = {
      ...makePrefs(),
      roundWaveOrders: { 2: "explore-explore-showdown" },
    } satisfies SchedulePrefs;

    expect(getRoundWaveOrder(2, prefs)).toBe("explore-explore-showdown");
    expect(getRoundWaveOrder(3, prefs)).toBe("explore-explore-showdown");
  });
});

describe("round preference set helpers", () => {
  it("stores and retrieves custom caps per round", () => {
    const prefs = makePrefs();
    const patch = setRoundCustomCap(2, 19, prefs);
    const merged = { ...prefs, ...patch };

    expect(getRoundCustomCap(2, merged)).toBe(19);
    expect(getRoundCustomCap(1, merged)).toBeUndefined();
  });

  it("updates wave orders without losing previous value", () => {
    const prefs = makePrefs();
    const patch = setRoundWaveOrder(2, "explore-explore-showdown", prefs);
    const merged = { ...prefs, ...patch };

    expect(getRoundWaveOrder(2, merged)).toBe("explore-explore-showdown");
    expect(getRoundWaveOrder(3, merged)).toBe("explore-explore-showdown");
  });
});

describe("ui convenience helpers", () => {
  it("shows wave labels only for round 1", () => {
    expect(shouldShowWaveLabel(1)).toBe(true);
    expect(shouldShowWaveLabel(2)).toBe(false);
  });

  it("shows special round ui only for round 1 with enough players", () => {
    expect(shouldShowSpecialRoundUI(1, 16)).toBe(true);
    expect(shouldShowSpecialRoundUI(1, 12)).toBe(false);
    expect(shouldShowSpecialRoundUI(2, 16)).toBe(false);
  });
});

describe("rating helpers maintain legacy behaviour", () => {
  it("matches legacy cap reference defaults", () => {
    const prefs = withoutDynamicPrefs(makePrefs());

    expect(capRefGeneric(1, prefs)).toBe(capRef(1));
    expect(capRefGeneric(2, prefs)).toBe(capRef(2));
    expect(capRefGeneric(3, prefs)).toBe(capRef(3));
  });

  it("aligns expectation adjustment with legacy implementation", () => {
    const prefs = withoutDynamicPrefs(makePrefs());
    const E = 0.62;

    expect(adjustExpectationForRaceGeneric(E, 1, prefs)).toBeCloseTo(adjustExpectationForRace(E, 1), 8);
    expect(adjustExpectationForRaceGeneric(E, 2, prefs)).toBeCloseTo(adjustExpectationForRace(E, 2), 8);
    expect(adjustExpectationForRaceGeneric(E, 3, prefs)).toBeCloseTo(adjustExpectationForRace(E, 3), 8);
  });

  it("matches legacy k-factor scaling", () => {
    const prefs = withoutDynamicPrefs(makePrefs());
    const inputs = {
      pA: 21,
      pB: 19,
      GPavg: 6,
      RA: 1500,
      RB: 1475,
      samePartner: false,
      repeatedOpp: true,
      E: 0.64,
      S: 0.55,
    };

    const legacy = kBaseScaled(
      inputs.pA,
      inputs.pB,
      2,
      inputs.GPavg,
      inputs.RA,
      inputs.RB,
      inputs.samePartner,
      inputs.repeatedOpp,
      inputs.E,
      inputs.S,
    );

    const generic = kBaseScaledGeneric(
      inputs.pA,
      inputs.pB,
      2,
      inputs.GPavg,
      inputs.RA,
      inputs.RB,
      inputs.samePartner,
      inputs.repeatedOpp,
      inputs.E,
      inputs.S,
      prefs,
    );

    expect(generic).toBeCloseTo(legacy, 8);
  });
});

describe("scheduling helpers", () => {
  it("match legacy target games and matches needed", () => {
    const prefs = withoutDynamicPrefs(makePrefs());

    for (const round of [1, 2, 3] as const) {
      expect(targetGamesPerRoundGeneric(round, prefs)).toBe(targetGamesPerRound(round));
      expect(matchesNeededGeneric(16, round, prefs)).toBe(matchesNeeded(16, round));
    }
  });

  it("respects dynamic target games when they are provided", () => {
    const prefs = {
      ...makePrefs(),
      roundTargetGames: { 1: 4, 2: 3, 4: 2 },
    } satisfies SchedulePrefs;

    expect(targetGamesPerRoundGeneric(1, prefs)).toBe(4);
    expect(targetGamesPerRoundGeneric(2, prefs)).toBe(3);
    expect(targetGamesPerRoundGeneric(3, prefs)).toBe(0);
    expect(targetGamesPerRoundGeneric(4, prefs)).toBe(2);

    expect(matchesNeededGeneric(20, 2, prefs)).toBe(Math.ceil((20 * 3) / 4));
  });
});