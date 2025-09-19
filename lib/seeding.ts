export function seedPrior(seed: number, N: number, S = 25) {
  return 1000 + S * ((N + 1 - 2 * seed) / 2);
}

export function blended(R: number, R0: number, beta: number) {
  return R0 + beta * (R - R0);
}
