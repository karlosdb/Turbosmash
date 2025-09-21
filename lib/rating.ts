export function effTeam(R1: number, R2: number, s = 0.03) {
  return (R1 + R2) / 2 - s * Math.abs(R1 - R2);
}

export function expectedShare(RA: number, RB: number) {
  return 1 / (1 + Math.pow(10, (RB - RA) / 400));
}

export function actualShare(pA: number, pB: number) {
  const S = pA / Math.max(1, pA + pB);
  return Math.min(0.95, Math.max(0.05, S));
}

export function capRef(roundIndex: 1 | 2 | 3) {
  return roundIndex === 1 ? 21 : 15;
}

export function kBaseScaled(
  pA: number,
  pB: number,
  roundIndex: 1 | 2 | 3,
  GPavg: number,
  RA: number,
  RB: number,
  samePartner: boolean,
  repeatedOpp: boolean,
  E: number,
  S: number
) {
  const I = (pA + pB) / capRef(roundIndex);
  const u0 = 0.6;
  const U = 1.0 + u0 / Math.sqrt(Math.max(1, GPavg));
  const D = 1 + Math.max(-0.25, Math.min(0.25, (RB - RA) / 400));
  const repeatDamp = (samePartner ? 0.9 : 1.0) * (repeatedOpp ? 0.95 : 1.0);
  const surprise = 0.5 + Math.abs(S - E);

  const K_base = 24;
  const K = K_base * I * U * D * repeatDamp * surprise;
  return Math.max(8, Math.min(40, K));
}

export const clampDelta = (d: number, lim = 40) => Math.max(-lim, Math.min(lim, d));

export function waveClamp(roundIndex: 1 | 2 | 3, miniRoundIndex?: number) {
  if (roundIndex !== 1) return 40;
  if (miniRoundIndex === 1) return 20;
  if (miniRoundIndex === 2) return 30;
  return 40;
}

export function doublesEloDelta(
  Ra1: number,
  Ra2: number,
  Rb1: number,
  Rb2: number,
  pA: number,
  pB: number,
  roundIndex: 1 | 2 | 3,
  miniRoundIndex?: number,
  samePartnerA = false,
  repeatedOppA = false,
  samePartnerB = false,
  repeatedOppB = false,
  GPavg: number = 1
) {
  const RA = effTeam(Ra1, Ra2);
  const RB = effTeam(Rb1, Rb2);
  const E = expectedShare(RA, RB);
  const S = actualShare(pA, pB);

  const KA = kBaseScaled(pA, pB, roundIndex, GPavg, RA, RB, samePartnerA, repeatedOppA, E, S);
  // Compute KB for symmetry and potential future use. Currently KA determines dTeamA and dTeamB is symmetric.
  const KB = kBaseScaled(pB, pA, roundIndex, GPavg, RB, RA, samePartnerB, repeatedOppB, 1 - E, 1 - S);

  const dTeamA = KA * (S - E);
  const dTeamB = -dTeamA;

  const lim = waveClamp(roundIndex, miniRoundIndex);
  return {
    dA: clampDelta(dTeamA, lim),
    dB: clampDelta(dTeamB, lim),
  };
}

// Detailed variant that returns per-player splits and a brief reasoning message
export function doublesEloDeltaDetailed(
  Ra1: number,
  Ra2: number,
  Rb1: number,
  Rb2: number,
  pA: number,
  pB: number,
  roundIndex: 1 | 2 | 3,
  miniRoundIndex?: number,
  samePartnerA = false,
  repeatedOppA = false,
  samePartnerB = false,
  repeatedOppB = false,
  GPavg: number = 1
) {
  const RA = effTeam(Ra1, Ra2);
  const RB = effTeam(Rb1, Rb2);
  const E = expectedShare(RA, RB);
  const S = actualShare(pA, pB);

  const KA = kBaseScaled(pA, pB, roundIndex, GPavg, RA, RB, samePartnerA, repeatedOppA, E, S);
  const dTeamA = KA * (S - E);
  const lim = waveClamp(roundIndex, miniRoundIndex);
  const dA = clampDelta(dTeamA, lim);
  const dB = -dA;

  // Split team delta to players inversely proportional to their advantage vs partner
  // Stronger partner takes a smaller share; weaker partner gets a larger share
  const shareA1 = Ra1 === 0 && Ra2 === 0 ? 0.5 : (Ra2 > 0 ? Ra2 : 1) / ((Ra1 > 0 ? Ra1 : 1) + (Ra2 > 0 ? Ra2 : 1));
  const shareA2 = 1 - shareA1;
  const shareB1 = Rb2 === 0 && Rb1 === 0 ? 0.5 : (Rb2 > 0 ? Rb2 : 1) / ((Rb1 > 0 ? Rb1 : 1) + (Rb2 > 0 ? Rb2 : 1));
  const shareB2 = 1 - shareB1;

  const da1 = dA * shareA1;
  const da2 = dA * shareA2;
  const db1 = dB * shareB1;
  const db2 = dB * shareB2;

  // Build short reasoning string
  const tougher = RB - RA;
  const partnerGapA = Math.abs(Ra1 - Ra2);
  const partnerGapB = Math.abs(Rb1 - Rb2);
  const beats = S > E ? "outperformed" : "underperformed";
  const reason = `E=${(E*100).toFixed(0)}% vs S=${(S*100).toFixed(0)}%, opponent ${(tougher>0?"stronger":"weaker")} by ${Math.abs(tougher).toFixed(0)}, partner gaps A:${partnerGapA.toFixed(0)} B:${partnerGapB.toFixed(0)} (${beats} expectation)`;

  return {
    perPlayer: { da1: Math.round(da1), da2: Math.round(da2), db1: Math.round(db1), db2: Math.round(db2) },
    team: { dA: Math.round(dA), dB: Math.round(dB) },
    reason,
  };
}