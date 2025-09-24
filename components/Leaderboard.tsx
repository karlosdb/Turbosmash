"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvent } from "@/lib/context";
import Button from "@/components/ui/button";

export default function Leaderboard() {
  const { players, rounds } = useEvent();
  const [showElo, setShowElo] = useState(false);
  const prevRatings = useRef<Record<string, number>>({});
  useEffect(() => {
    const map: Record<string, number> = {};
    for (const p of players) map[p.id] = p.rating;
    prevRatings.current = map;
  }, [players]);

  // Round multipliers (desktop session multipliers): R1=1.0, R2=1.2, R3=1.4
  const roundWeight: Record<1 | 2 | 3, number> = { 1: 1.0, 2: 1.2, 3: 1.4 };

  const nameById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p.name ?? p.id])), [players]);

  type Metric = {
    weightedPF: number;
    weightedPA: number;
    rawPF: number;
    rawPA: number;
    wins: number;
    losses: number;
    pdTotal: number;
    pdEntries: string[];
  };

  const metrics = useMemo(() => {
    const init = (): Metric => ({
      weightedPF: 0,
      weightedPA: 0,
      rawPF: 0,
      rawPA: 0,
      wins: 0,
      losses: 0,
      pdTotal: 0,
      pdEntries: [],
    });
    const map: Record<string, Metric> = {};
    const ensure = (id: string) => {
      if (!map[id]) map[id] = init();
      return map[id];
    };
    players.forEach((p) => ensure(p.id));
    for (const r of rounds) {
      for (const m of r.matches) {
        if (m.status !== "completed") continue;
        const ri = m.roundIndex as 1 | 2 | 3;
        const rw = roundWeight[ri] || 1.0;
        const scoreA = m.scoreA ?? 0;
        const scoreB = m.scoreB ?? 0;
        const diffA = scoreA - scoreB;
        const diffB = scoreB - scoreA;
        const cappedA = Math.max(-8, Math.min(8, diffA));
        const cappedB = Math.max(-8, Math.min(8, diffB));
        const labelBase = m.miniRoundIndex ? `R${ri}/W${m.miniRoundIndex}` : `R${ri}`;
        const opponentsA = [nameById[m.b1], nameById[m.b2]].filter(Boolean).join(" & ");
        const opponentsB = [nameById[m.a1], nameById[m.a2]].filter(Boolean).join(" & ");
        const buildEntry = (scored: number, allowed: number, diff: number, capped: number, opp: string) => {
          const cappedNote = capped !== diff ? ` (capped to ${capped})` : "";
          return `${labelBase} vs ${opp || "TBD"}: ${scored}-${allowed} (diff ${diff}${cappedNote})`;
        };
        const record = (
          id: string,
          scored: number,
          allowed: number,
          win: boolean,
          diff: number,
          cappedDiff: number,
          entry: string,
        ) => {
          const bucket = ensure(id);
          bucket.rawPF += scored;
          bucket.rawPA += allowed;
          bucket.weightedPF += scored * rw;
          bucket.weightedPA += allowed * rw;
          bucket.pdTotal += cappedDiff;
          bucket.pdEntries.push(entry);
          if (win) bucket.wins += 1;
          else bucket.losses += 1;
        };
        const entryA = buildEntry(scoreA, scoreB, diffA, cappedA, opponentsA);
        const entryB = buildEntry(scoreB, scoreA, diffB, cappedB, opponentsB);
        const aWon = diffA > 0;
        record(m.a1, scoreA, scoreB, aWon, diffA, cappedA, entryA);
        record(m.a2, scoreA, scoreB, aWon, diffA, cappedA, entryA);
        record(m.b1, scoreB, scoreA, !aWon, diffB, cappedB, entryB);
        record(m.b2, scoreB, scoreA, !aWon, diffB, cappedB, entryB);
      }
    }
    return map;
  }, [players, rounds, nameById]);

  const rankingTooltip = "Ranking tiebreakers: Score (weighted points) → Wins → Point differential (±8 cap) → Points lost → Seed.";
  const rankingDescription = "Score = weighted points (R1 x1.0, R2 x1.2, R3 x1.4). Tiebreakers: wins → point diff (±8 cap) → points lost → seed.";

  const defaultMetric = useMemo<Metric>(
    () => ({
      weightedPF: 0,
      weightedPA: 0,
      rawPF: 0,
      rawPA: 0,
      wins: 0,
      losses: 0,
      pdTotal: 0,
      pdEntries: [],
    }),
    []
  );

  const sorted = useMemo(() => {
    const active = players.filter((p) => !p.eliminatedAtRound);
    const eliminated = players.filter((p) => p.eliminatedAtRound);

    const activeSorted = active.slice().sort((a, b) => {
      const metricA = metrics[a.id] ?? defaultMetric;
      const metricB = metrics[b.id] ?? defaultMetric;
      if (metricB.weightedPF !== metricA.weightedPF) return metricB.weightedPF - metricA.weightedPF;
      if (metricB.wins !== metricA.wins) return metricB.wins - metricA.wins;
      if (metricB.pdTotal !== metricA.pdTotal) return metricB.pdTotal - metricA.pdTotal;
      if (metricA.rawPA !== metricB.rawPA) return metricA.rawPA - metricB.rawPA;
      return a.seed - b.seed;
    });

    const eliminatedSorted = eliminated
      .slice()
      .sort((a, b) => (a.lockedRank ?? Number.POSITIVE_INFINITY) - (b.lockedRank ?? Number.POSITIVE_INFINITY));

    return [...activeSorted, ...eliminatedSorted];
  }, [defaultMetric, metrics, players]);

  // Compute a tight content-based width for the Name column (in ch units)
  const nameColCh = useMemo(() => {
    const maxLen = players.reduce((m, p) => {
      const nameLen = (p.name || "").length;
      const seedLen = ` (#${p.seed})`.length; // Account for seed display like " (#12)"
      return Math.max(m, nameLen + seedLen);
    }, 0);
    // Add breathing room so the text is not flush against the next column
    return Math.max(3, maxLen + 2);
  }, [players]);

  // Build per-round stats for tooltips
  const perRoundStats = useMemo(() => {
    const init = () => ({ pf: { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>, pa: { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>, wins: { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>, losses: { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number> });
    const res: Record<string, { pf: Record<1 | 2 | 3, number>; pa: Record<1 | 2 | 3, number>; wins: Record<1 | 2 | 3, number>; losses: Record<1 | 2 | 3, number> }> = {};
    for (const r of rounds) {
      for (const m of r.matches) {
        if (m.status !== "completed") continue;
        const ri = m.roundIndex as 1 | 2 | 3;
        const ensure = (id: string) => (res[id] ||= init());
        const aWon = (m.scoreA ?? 0) > (m.scoreB ?? 0);
        // Side A
        ensure(m.a1).pf[ri] += m.scoreA ?? 0; res[m.a1].pa[ri] += m.scoreB ?? 0; (aWon ? res[m.a1].wins : res[m.a1].losses)[ri] += 1;
        ensure(m.a2).pf[ri] += m.scoreA ?? 0; res[m.a2].pa[ri] += m.scoreB ?? 0; (aWon ? res[m.a2].wins : res[m.a2].losses)[ri] += 1;
        // Side B
        ensure(m.b1).pf[ri] += m.scoreB ?? 0; res[m.b1].pa[ri] += m.scoreA ?? 0; (!aWon ? res[m.b1].wins : res[m.b1].losses)[ri] += 1;
        ensure(m.b2).pf[ri] += m.scoreB ?? 0; res[m.b2].pa[ri] += m.scoreA ?? 0; (!aWon ? res[m.b2].wins : res[m.b2].losses)[ri] += 1;
      }
    }
    return res;
  }, [rounds]);

  const fmtPointsTooltip = (id: string, kind: "pf" | "pa") => {
    const s = perRoundStats[id];
    if (!s) return "";
    return `R1: ${s[kind][1]} | R2: ${s[kind][2]} | R3: ${s[kind][3]}`;
  };
  const fmtWinsTooltip = (id: string) => {
    const s = perRoundStats[id];
    if (!s) return "";
    return `R1: ${s.wins[1]} | R2: ${s.wins[2]} | R3: ${s.wins[3]}`;
  };
  const fmtLossesTooltip = (id: string) => {
    const s = perRoundStats[id];
    if (!s) return "";
    return `R1: ${s.losses[1]} | R2: ${s.losses[2]} | R3: ${s.losses[3]}`;
  };
  const fmtPdTooltip = (id: string) => {
    const metric = metrics[id] ?? defaultMetric;
    if (!metric.pdEntries.length) return "No point differential history yet.";
    return metric.pdEntries.join("\n");
  };


  return (
    <Card className="w-fit">
      <CardHeader className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardTitle>Leaderboard</CardTitle>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
            title={rankingTooltip}
            aria-label="Leaderboard ranking tiebreakers"
          >
            ?
          </button>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowElo((v) => !v)}>
          {showElo ? "Hide Elo" : "Show Elo"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-xs text-slate-500">{rankingDescription}</div>
        <div className="overflow-x-auto">
          <table className="w-fit text-sm border-collapse table-fixed">
            <thead>
              <tr className="text-center text-slate-600">
                <th className="py-1 px-1 w-10">Rank</th>
                <th className="py-1 px-1 whitespace-nowrap text-left" style={{ width: `${nameColCh}ch` }}>Name</th>
                <th className="py-1 px-1 w-14">Score</th>
                <th className="py-1 px-1 w-14">Points Won</th>
                <th className="py-1 px-1 w-14">Points Lost</th>
                <th className="py-1 px-1 w-14">Point Diff</th>
                <th className="py-1 px-1 w-10">Wins</th>
                <th className="py-1 px-1 w-12">Losses</th>
                {showElo && <th className="py-1 px-1 hidden md:table-cell w-24">Elo</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const delta = (p.rating - (prevRatings.current[p.id] ?? p.rating)) || 0;
                const greyClass = p.eliminatedAtRound ? "text-slate-400" : "";
                const s = perRoundStats[p.id];
                const metric = metrics[p.id] ?? defaultMetric;
                const pfWeighted = metric.weightedPF;
                const pfRaw = metric.rawPF;
                const paRaw = metric.rawPA;
                const winsTotal = metric.wins;
                const lossesTotal = metric.losses;
                const pdTotal = metric.pdTotal;
                const pdTooltip = fmtPdTooltip(p.id);
                const scoreTooltipLines = [
                  "Weighted points (R1 x1.0, R2 x1.2, R3 x1.4).",
                ];
                if (metric.pdEntries.length) {
                  scoreTooltipLines.push("Point differential history (+/-8 cap):");
                  scoreTooltipLines.push(...metric.pdEntries);
                } else {
                  scoreTooltipLines.push("Point differential history: no matches yet.");
                }
                const scoreTitle = scoreTooltipLines.join("\n");
                const rowBgClass = showElo && !p.eliminatedAtRound && delta !== 0 ? (delta > 0 ? "bg-emerald-50" : "bg-rose-50") : "";
                return (
                  <tr key={p.id} className={`border-t border-slate-200 ${rowBgClass}`}>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums`}>{p.lockedRank ?? i + 1}</td>
                    <td className={`py-1 px-1 ${greyClass} text-left whitespace-nowrap`} style={{ width: `${nameColCh}ch` }} title={p.name}>
                      {p.name} <span className="ml-1 text-xs text-slate-400">(#{p.seed})</span>
                    </td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums`} title={scoreTitle}>{pfWeighted % 1 === 0 ? pfWeighted : pfWeighted.toFixed(1)}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtPointsTooltip(p.id, "pf")}>{pfRaw}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtPointsTooltip(p.id, "pa")}>{paRaw}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={pdTooltip}>{pdTotal}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtWinsTooltip(p.id)}>{winsTotal}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtLossesTooltip(p.id)}>{lossesTotal}</td>
                    {showElo && (
                      <td className={`py-1 px-1 ${greyClass} hidden md:table-cell tabular-nums`} title={(p.eloLog && p.eloLog.length > 0) ? p.eloLog.slice(-5).map(e => `${e.delta >= 0 ? '+' : ''}${e.delta}: ${e.reason}`).join('\n') : ''}>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                          <span className="col-start-2 justify-self-center text-center">{p.rating}</span>
                          {!p.eliminatedAtRound && delta !== 0 && (
                            <span className={`col-start-3 justify-self-end text-xs ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>{delta > 0 ? `+${Math.round(delta)}` : Math.round(delta)}</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}












