import { getRoundTargetGames } from "./round-preferences";
import type { SchedulePrefs } from "./types";

const FINALS_MATCH_COUNT = 3;
const PLAYERS_PER_MATCH = 4;

export function targetGamesPerRound(roundIndex: 1 | 2 | 3) {
  if (roundIndex === 1) return 3;
  if (roundIndex === 2) return 2;
  return 0;
}

// Generic helper that mirrors legacy defaults and supports overrides
export function targetGamesPerRoundGeneric(roundIndex: number, prefs: SchedulePrefs) {
  return getRoundTargetGames(roundIndex, prefs, 0);
}

export function matchesNeeded(N: number, roundIndex: 1 | 2 | 3) {
  if (roundIndex === 3) return FINALS_MATCH_COUNT;
  const G = targetGamesPerRound(roundIndex);
  return Math.ceil((N * G) / PLAYERS_PER_MATCH);
}

// Generic helper that mirrors legacy defaults and supports overrides
export function matchesNeededGeneric(N: number, roundIndex: number, prefs: SchedulePrefs) {
  if (roundIndex === 3) return FINALS_MATCH_COUNT; // Finals always have 3 matches
  const G = targetGamesPerRoundGeneric(roundIndex, prefs);
  return Math.ceil((N * G) / PLAYERS_PER_MATCH);
}

export function wavesNeeded(matches: number, courts: number) {
  return Math.ceil(matches / Math.max(1, courts));
}