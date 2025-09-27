import { SchedulePrefs, R1WaveOrder } from "./types";

const LEGACY_ROUND_CAP_FALLBACKS: Record<number, number> = {
  1: 21,
  2: 11,
  3: 11,
};
const DEFAULT_ADDITIONAL_ROUND_CAP = 11;

const LEGACY_TARGET_GAMES: Record<number, number> = {
  1: 3,
  2: 2,
};
const DEFAULT_TARGET_GAMES = 0;

const LEGACY_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.4,
};
const MULTIPLIER_INCREMENT = 0.2;

const DEFAULT_WAVE_ORDER: R1WaveOrder = "explore-showdown-explore-showdown";
const SPECIAL_UI_ROUND_INDEX = 1;
const SPECIAL_UI_MIN_PLAYERS = 15; // roundIndex === 1 && players.length > 14

const getLegacyMultiplier = (roundIndex: number): number => {
  if (roundIndex <= 1) return LEGACY_MULTIPLIERS[1];
  if (LEGACY_MULTIPLIERS[roundIndex] !== undefined) {
    return LEGACY_MULTIPLIERS[roundIndex];
  }
  return LEGACY_MULTIPLIERS[1] + (roundIndex - 1) * MULTIPLIER_INCREMENT;
};

/**
 * Generic helper functions to replace hardcoded round-specific logic.
 * These functions prioritize the new Record-based system but fall back to legacy fields.
 */
export function getRoundScoreCap(roundIndex: number, prefs: SchedulePrefs, defaultCap = DEFAULT_ADDITIONAL_ROUND_CAP): number {
  const dynamicCap = prefs.roundScoreCaps?.[roundIndex];
  if (dynamicCap !== undefined) {
    return dynamicCap;
  }

  if (roundIndex === 1 && prefs.r1ScoreCap !== undefined) return prefs.r1ScoreCap;
  if (roundIndex === 2 && prefs.r2ScoreCap !== undefined) return prefs.r2ScoreCap;
  if (roundIndex === 3 && prefs.r3ScoreCap !== undefined) return prefs.r3ScoreCap;

  if (LEGACY_ROUND_CAP_FALLBACKS[roundIndex] !== undefined) {
    return LEGACY_ROUND_CAP_FALLBACKS[roundIndex];
  }

  return defaultCap;
}

export function getRoundTargetGames(roundIndex: number, prefs: SchedulePrefs, defaultGames = DEFAULT_TARGET_GAMES): number {
  const dynamicGames = prefs.roundTargetGames?.[roundIndex];
  if (dynamicGames !== undefined) {
    return dynamicGames;
  }

  if (roundIndex === 1 && prefs.r1TargetGamesPerPlayer !== undefined) return prefs.r1TargetGamesPerPlayer;
  if (roundIndex === 2 && prefs.r2TargetGamesPerPlayer !== undefined) return prefs.r2TargetGamesPerPlayer;

  if (LEGACY_TARGET_GAMES[roundIndex] !== undefined) {
    return LEGACY_TARGET_GAMES[roundIndex];
  }

  return defaultGames;
}

export function getRoundMultiplier(roundIndex: number, prefs: SchedulePrefs): number {
  const dynamicMultiplier = prefs.roundMultipliers?.[roundIndex];
  if (dynamicMultiplier !== undefined) {
    return dynamicMultiplier;
  }

  return getLegacyMultiplier(roundIndex);
}

export function getRoundWaveOrder(roundIndex: number, prefs: SchedulePrefs): R1WaveOrder {
  const dynamicOrder = prefs.roundWaveOrders?.[roundIndex];
  if (dynamicOrder) {
    return dynamicOrder;
  }

  const baseOrder = prefs.r1WaveOrder ?? DEFAULT_WAVE_ORDER;
  if (roundIndex === 1) {
    return baseOrder;
  }

  const inheritedOrder = prefs.roundWaveOrders?.[roundIndex - 1];
  if (inheritedOrder) {
    return inheritedOrder;
  }

  return baseOrder;
}

export function getRoundCustomCap(roundIndex: number, prefs: SchedulePrefs): number | undefined {
  return prefs.roundCustomCaps?.[roundIndex];
}

export function setRoundCustomCap(roundIndex: number, value: number, prefs: SchedulePrefs): Partial<SchedulePrefs> {
  return {
    roundCustomCaps: {
      ...(prefs.roundCustomCaps ?? {}),
      [roundIndex]: value,
    },
  };
}

export function setRoundScoreCap(roundIndex: number, value: number, prefs: SchedulePrefs): Partial<SchedulePrefs> {
  return {
    roundScoreCaps: {
      ...(prefs.roundScoreCaps ?? {}),
      [roundIndex]: value,
    },
  };
}

export function setRoundWaveOrder(roundIndex: number, order: R1WaveOrder, prefs: SchedulePrefs): Partial<SchedulePrefs> {
  return {
    roundWaveOrders: {
      ...(prefs.roundWaveOrders ?? {}),
      [roundIndex]: order,
    },
  };
}

// Helper to check if a wave label should be shown (currently only round 1 shows wave labels)
export function shouldShowWaveLabel(roundIndex: number): boolean {
  return roundIndex === SPECIAL_UI_ROUND_INDEX;
}

// Helper for special round 1 UI (currently only round 1 with > 14 players)
export function shouldShowSpecialRoundUI(roundIndex: number, playerCount: number): boolean {
  return roundIndex === SPECIAL_UI_ROUND_INDEX && playerCount >= SPECIAL_UI_MIN_PLAYERS;
}