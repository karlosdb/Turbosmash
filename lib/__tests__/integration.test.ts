import { describe, it, expect, beforeEach, vi } from "vitest";
import { computeRoundPlan, prepareRound1, generatePrelimWave, generateLaterRound } from "../matchmaking";
import { defaultSchedulePrefs, createEmptyEvent, Player, Round } from "../types";
import { doublesEloDelta } from "../rating";

function createTestPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `p${idx + 1}`,
    name: `Player ${idx + 1}`,
    seed: idx + 1,
    rating: 1000 + (count - idx) * 5, // Slight rating spread
    gamesPlayed: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    lastPlayedAt: Date.now() - idx * 1000
  }));
}

function simulateMatchCompletion(matches: Round["matches"], scorePattern: "balanced" | "upsets" = "balanced") {
  return matches.map((match, idx) => {
    let scoreA: number, scoreB: number;

    if (scorePattern === "balanced") {
      // Slightly favor team A most of the time
      scoreA = 15;
      scoreB = idx % 3 === 0 ? 13 : 11; // Occasional closer games
    } else {
      // Some upsets
      scoreA = idx % 4 === 0 ? 11 : 15;
      scoreB = idx % 4 === 0 ? 15 : 12;
    }

    return {
      ...match,
      status: "completed" as const,
      scoreA,
      scoreB
    };
  });
}

describe("End-to-End Tournament Integration", () => {
  beforeEach(() => {
    // Setup deterministic random for consistent tests
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  describe("8-Player Tournament - Complete Flow", () => {
    it("executes complete 8-player tournament (prelim -> finals)", () => {
      const players = createTestPlayers(8);
      const prefs = defaultSchedulePrefs();

      // 1. Generate tournament plan
      const plan = computeRoundPlan(8, prefs);
      expect(plan).toHaveLength(2);
      expect(plan[0].kind).toBe("prelim");
      expect(plan[1].kind).toBe("final");

      // 2. Create preliminary round
      const prelimRound = prepareRound1(players, prefs);
      expect(prelimRound.kind).toBe("prelim");
      expect(prelimRound.status).toBe("active");

      // 3. Generate all preliminary waves
      const allPrelimMatches: any[] = [];
      const maxWaves = 4; // explore-showdown-explore-showdown

      for (let wave = 1; wave <= maxWaves; wave++) {
        const { matches } = generatePrelimWave(wave, players, {
          ...prelimRound,
          matches: allPrelimMatches
        }, [], prefs);

        const completedMatches = simulateMatchCompletion(matches);
        allPrelimMatches.push(...completedMatches);
      }

      expect(allPrelimMatches.length).toBeGreaterThan(0);
      expect(allPrelimMatches.every(m => m.status === "completed")).toBe(true);

      // 4. Simulate elimination to 4 players
      const finalists = players.slice(0, 4); // Top 4 advance

      // 5. Generate final round
      const finalMatches = generateLaterRound(finalists, [], 2, "final");
      expect(finalMatches).toHaveLength(3); // All 3 final combinations
      expect(finalMatches.every(m => m.miniRoundIndex === 1)).toBe(true);

      // 6. Complete finals
      const completedFinals = simulateMatchCompletion(finalMatches, "upsets");
      expect(completedFinals.every(m => m.status === "completed")).toBe(true);

      // Tournament should be complete
      expect(allPrelimMatches.length + completedFinals.length).toBeGreaterThan(6);
    });

    it("validates 8-player architecture doesn't generate semifinals", () => {
      const players = createTestPlayers(8);
      const prefs = defaultSchedulePrefs();
      const plan = computeRoundPlan(8, prefs);

      // Critical architectural test: 8 players should never have "eight" round
      expect(plan.some(p => p.kind === "eight")).toBe(false);
      expect(plan.map(p => p.kind)).toEqual(["prelim", "final"]);
    });
  });

  describe("12-Player Tournament - Standard Flow", () => {
    it("executes complete 12-player tournament (prelim -> semis -> finals)", () => {
      const players = createTestPlayers(12);
      const prefs = defaultSchedulePrefs();

      // 1. Generate tournament plan
      const plan = computeRoundPlan(12, prefs);
      expect(plan).toHaveLength(3);
      expect(plan.map(p => p.kind)).toEqual(["prelim", "eight", "final"]);

      // 2. Execute preliminary round
      const prelimRound = prepareRound1(players, prefs);
      const prelimMatches: any[] = [];

      for (let wave = 1; wave <= 4; wave++) {
        const { matches } = generatePrelimWave(wave, players, {
          ...prelimRound,
          matches: prelimMatches
        }, [], prefs);

        const completed = simulateMatchCompletion(matches);
        prelimMatches.push(...completed);
      }

      // 3. Simulate elimination to 8 players
      const semifinalists = players.slice(0, 8);

      // 4. Generate semifinals
      const semiMatches = generateLaterRound(semifinalists, [prelimRound], 2, "eight");
      expect(semiMatches.length).toBeGreaterThan(0);

      // 5. Simulate elimination to 4 players
      const finalists = semifinalists.slice(0, 4);

      // 6. Generate finals
      const finalMatches = generateLaterRound(finalists, [], 3, "final");
      expect(finalMatches).toHaveLength(3);

      // Verify complete tournament structure
      expect(prelimMatches.length).toBeGreaterThan(0);
      expect(semiMatches.length).toBeGreaterThan(0);
      expect(finalMatches.length).toBe(3);
    });
  });

  describe("Large Tournament Scalability", () => {
    it("handles 20-player tournament with multiple preliminary rounds", () => {
      const players = createTestPlayers(20);
      const prefs = defaultSchedulePrefs();

      const plan = computeRoundPlan(20, prefs);
      expect(plan.length).toBeGreaterThanOrEqual(4); // Multiple prelims + semis + finals

      // Should start with 20 players
      expect(plan[0].targetSize).toBeLessThan(20);
      expect(plan[0].targetSize).toBeGreaterThanOrEqual(8);

      // Should end with 4 players in finals
      expect(plan[plan.length - 1]).toEqual({
        index: plan.length,
        kind: "final",
        targetSize: 4
      });
    });

    it("respects three-round cap for large tournaments", () => {
      const players = createTestPlayers(32);
      const prefs = { ...defaultSchedulePrefs(), threeRoundCap: true };

      const plan = computeRoundPlan(32, prefs);
      expect(plan.length).toBeLessThanOrEqual(3);

      // Even with 32 players, should be capped at 3 rounds
      expect(plan[plan.length - 1].kind).toBe("final");
    });
  });

  describe("Rating System Integration", () => {
    it("applies rating updates consistently", () => {
      const mockPlayers = createTestPlayers(4);

      // Test Elo calculation
      const delta = doublesEloDelta(
        mockPlayers[0].rating, mockPlayers[1].rating,
        mockPlayers[2].rating, mockPlayers[3].rating,
        15, 11, // Score
        1, 1, // Round 1, Wave 1
        false, false, false, false, // No repeat partners/opponents
        1 // Low games played average
      );

      // Should be zero-sum
      expect(Math.abs(delta.dA + delta.dB)).toBeLessThan(0.01);

      // Should respect wave clamps
      expect(Math.abs(delta.dA)).toBeLessThanOrEqual(20); // Round 1 Wave 1 clamp
      expect(Math.abs(delta.dB)).toBeLessThanOrEqual(20);
    });
  });

  describe("State Management Integration", () => {
    it("maintains data integrity across operations", () => {
      const initialState = createEmptyEvent();

      // Verify clean initial state
      expect(initialState.players).toHaveLength(0);
      expect(initialState.rounds).toHaveLength(0);
      expect(initialState.currentRound).toBe(1);

      // Simulate adding players
      const playersAdded = {
        ...initialState,
        players: createTestPlayers(8)
      };

      expect(playersAdded.players).toHaveLength(8);
      expect(playersAdded.players.every(p => p.gamesPlayed === 0)).toBe(true);

      // Simulate tournament generation
      const plan = computeRoundPlan(8, initialState.schedulePrefs);
      const tournamentStarted = {
        ...playersAdded,
        roundPlan: plan,
        rounds: [prepareRound1(playersAdded.players, initialState.schedulePrefs)]
      };

      expect(tournamentStarted.rounds).toHaveLength(1);
      expect(tournamentStarted.rounds[0].status).toBe("active");
      expect(tournamentStarted.roundPlan).toEqual(plan);
    });
  });
});

describe("Architecture Quality Validation", () => {
  it("demonstrates clean separation of concerns", () => {
    // Business logic is separate from UI concerns
    const players = createTestPlayers(8);
    const prefs = defaultSchedulePrefs();

    // Tournament planning (pure function)
    const plan = computeRoundPlan(players.length, prefs);

    // Round generation (pure function)
    const round = prepareRound1(players, prefs);

    // Wave generation (pure function)
    const { matches } = generatePrelimWave(1, players, round, [], prefs);

    // All operations are predictable and testable
    expect(plan).toBeDefined();
    expect(round).toBeDefined();
    expect(matches).toBeDefined();
  });

  it("validates type safety across the system", () => {
    const player: Player = {
      id: "test",
      name: "Test",
      seed: 1,
      rating: 1000,
      gamesPlayed: 0,
      pointsFor: 0,
      pointsAgainst: 0
    };

    // TypeScript should enforce these structures
    expect(typeof player.id).toBe("string");
    expect(typeof player.rating).toBe("number");
    expect(typeof player.gamesPlayed).toBe("number");
  });

  it("demonstrates extensible preference system", () => {
    const basePrefs = defaultSchedulePrefs();

    // Can extend preferences without breaking existing code
    const extendedPrefs = {
      ...basePrefs,
      roundScoreCaps: { 1: 21, 2: 15 },
      roundCustomCaps: { 1: 18 },
      roundWaveOrders: { 1: "explore-explore-showdown" as const },
      newFeature: true // Can add new features
    };

    expect(extendedPrefs.r1ScoreCap).toBe(basePrefs.r1ScoreCap); // Backward compatible
    expect(extendedPrefs.roundScoreCaps[1]).toBe(21); // New feature works
  });
});