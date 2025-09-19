export function targetGamesPerRound(roundIndex: 1 | 2 | 3) {
  if (roundIndex === 1) return 3;
  if (roundIndex === 2) return 2;
  return 0;
}

export function matchesNeeded(N: number, roundIndex: 1 | 2 | 3) {
  if (roundIndex === 3) return 3;
  const G = targetGamesPerRound(roundIndex);
  return Math.ceil((N * G) / 4);
}

export function wavesNeeded(matches: number, courts: number) {
  return Math.ceil(matches / Math.max(1, courts));
}
