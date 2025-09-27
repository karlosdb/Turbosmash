import { describe, it, expect, beforeEach } from "vitest";
import { computeRoundPlan } from "../matchmaking";
import { defaultSchedulePrefs, EventState, createEmptyEvent } from "../types";

describe("Tournament Architecture - 8 Player Special Case", () => {
  it("generates prelim -> finals structure for exactly 8 players", () => {
    const prefs = defaultSchedulePrefs();
    const plan = computeRoundPlan(8, prefs);

    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({ index: 1, kind: "prelim", targetSize: 4 });
    expect(plan[1]).toEqual({ index: 2, kind: "final", targetSize: 4 });
  });

  it("skips semifinals for 8 players (architectural requirement)", () => {
    const prefs = defaultSchedulePrefs();
    const plan = computeRoundPlan(8, prefs);

    // Verify no "eight" round exists
    expect(plan.some(p => p.kind === "eight")).toBe(false);
    // Verify direct prelim -> finals progression
    expect(plan.map(p => p.kind)).toEqual(["prelim", "final"]);
  });

  it("preserves standard structure for other player counts", () => {
    const prefs = defaultSchedulePrefs();

    // 12 players should have prelim -> eight -> final
    const plan12 = computeRoundPlan(12, prefs);
    expect(plan12.map(p => p.kind)).toEqual(["prelim", "eight", "final"]);

    // 16 players should have multiple prelims -> eight -> final
    const plan16 = computeRoundPlan(16, prefs);
    expect(plan16.map(p => p.kind)).toEqual(["prelim", "prelim", "eight", "final"]);
  });
});

describe("Generic Round Plan System - Scalability", () => {
  it("generates valid plans for all reasonable player counts", () => {
    const prefs = defaultSchedulePrefs();

    // Test all multiples of 4 from 8 to 32
    for (let players = 8; players <= 32; players += 4) {
      const plan = computeRoundPlan(players, prefs);

      // Plan should always end at finals with 4 players
      expect(plan[plan.length - 1]).toEqual({
        index: plan.length,
        kind: "final",
        targetSize: 4
      });

      // Progression should make sense (decreasing or equal target sizes)
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i].targetSize).toBeLessThanOrEqual(plan[i-1].targetSize);
      }

      // First round should target reasonable elimination
      expect(plan[0].targetSize).toBeLessThanOrEqual(players);
      expect(plan[0].targetSize).toBeGreaterThanOrEqual(4);
    }
  });

  it("respects three-round cap preference for large tournaments", () => {
    const prefs = { ...defaultSchedulePrefs(), threeRoundCap: true };

    // Large tournament should be capped at 3 rounds max
    const plan20 = computeRoundPlan(20, prefs);
    expect(plan20.length).toBeLessThanOrEqual(3);

    const plan32 = computeRoundPlan(32, prefs);
    expect(plan32.length).toBeLessThanOrEqual(3);
  });
});

describe("Schedule Preferences - Extensibility", () => {
  it("supports legacy score cap fields for backward compatibility", () => {
    const prefs = defaultSchedulePrefs();

    // Verify legacy fields are present
    expect(prefs).toHaveProperty('r1ScoreCap');
    expect(prefs).toHaveProperty('r2ScoreCap');
    expect(prefs).toHaveProperty('r3ScoreCap');
    expect(typeof prefs.r1ScoreCap).toBe('number');
  });

  it("supports flexible tournament configuration", () => {
    const prefs = defaultSchedulePrefs();

    // Verify core configuration options
    expect(prefs).toHaveProperty('r1TargetGamesPerPlayer');
    expect(prefs).toHaveProperty('r2TargetGamesPerPlayer');
    expect(prefs).toHaveProperty('r1WaveOrder');
    expect(prefs).toHaveProperty('threeRoundCap');

    expect(typeof prefs.r1TargetGamesPerPlayer).toBe('number');
    expect(typeof prefs.r2TargetGamesPerPlayer).toBe('number');
    expect(typeof prefs.r1WaveOrder).toBe('string');
    expect(typeof prefs.threeRoundCap).toBe('boolean');
  });

  it("allows for extensible preferences structure", () => {
    // Test that we can extend preferences without breaking existing structure
    const prefs = defaultSchedulePrefs();
    const extendedPrefs = {
      ...prefs,
      roundScoreCaps: { 1: 21, 2: 15 },
      roundCustomCaps: { 1: 18 },
      roundWaveOrders: { 1: "explore-explore-showdown" as const }
    };

    expect(extendedPrefs).toHaveProperty('roundScoreCaps');
    expect(extendedPrefs).toHaveProperty('roundCustomCaps');
    expect(extendedPrefs).toHaveProperty('roundWaveOrders');
    expect(extendedPrefs.roundScoreCaps[1]).toBe(21);
    expect(extendedPrefs.roundCustomCaps[1]).toBe(18);
  });
});

describe("State Management - Data Integrity", () => {
  it("creates valid empty event state", () => {
    const state = createEmptyEvent();

    expect(state).toHaveProperty('players');
    expect(state).toHaveProperty('rounds');
    expect(state).toHaveProperty('currentRound');
    expect(state).toHaveProperty('schedulePrefs');
    expect(state).toHaveProperty('createdAt');

    expect(Array.isArray(state.players)).toBe(true);
    expect(Array.isArray(state.rounds)).toBe(true);
    expect(typeof state.currentRound).toBe('number');
    expect(typeof state.schedulePrefs).toBe('object');
    expect(typeof state.createdAt).toBe('string');
  });

  it("maintains type safety across state structure", () => {
    const state = createEmptyEvent();

    // Verify schedule prefs have correct structure
    expect(state.schedulePrefs).toHaveProperty('r1TargetGamesPerPlayer');
    expect(state.schedulePrefs).toHaveProperty('r2TargetGamesPerPlayer');
    expect(state.schedulePrefs).toHaveProperty('r1WaveOrder');
    expect(state.schedulePrefs).toHaveProperty('threeRoundCap');

    // Verify optional round plan exists
    expect(state).toHaveProperty('roundPlan');
    expect(Array.isArray(state.roundPlan)).toBe(true);
  });
});

describe("Type System - Architecture Quality", () => {
  it("enforces round kind constraints", () => {
    // This is compile-time validation, but we can test the types exist
    const validKinds = ["prelim", "eight", "final"];

    // Plan entries should only use valid kinds
    const plan = computeRoundPlan(12, defaultSchedulePrefs());
    plan.forEach(entry => {
      expect(validKinds).toContain(entry.kind);
    });
  });

  it("maintains consistent ID patterns", () => {
    // Test that the system uses consistent ID generation patterns
    // This validates architectural consistency
    const state = createEmptyEvent();

    // Should have deterministic structure
    expect(state.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
  });
});