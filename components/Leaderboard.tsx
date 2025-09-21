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

  // Show active players first by weighted points scored, then eliminated players by locked rank
  const sorted = useMemo(() => {
    const active = players.filter((p) => !p.eliminatedAtRound);
    const eliminated = players.filter((p) => p.eliminatedAtRound);
    const weightedPF: Record<string, number> = {};
    const weightedPA: Record<string, number> = {};
    for (const p of players) { weightedPF[p.id] = 0; weightedPA[p.id] = 0; }
    for (const r of rounds) {
      for (const m of r.matches) {
        if (m.status !== "completed") continue;
        const rw = roundWeight[m.roundIndex as 1 | 2 | 3] || 1.0;
        const a = m.scoreA ?? 0;
        const b = m.scoreB ?? 0;
        weightedPF[m.a1] += a * rw; weightedPF[m.a2] += a * rw;
        weightedPF[m.b1] += b * rw; weightedPF[m.b2] += b * rw;
        weightedPA[m.a1] += b * rw; weightedPA[m.a2] += b * rw;
        weightedPA[m.b1] += a * rw; weightedPA[m.b2] += a * rw;
      }
    }
    const activeSorted = active.slice().sort((a, b) => {
      const aw = weightedPF[a.id] || 0;
      const bw = weightedPF[b.id] || 0;
      if (bw !== aw) return bw - aw; // more weighted points first
      const awa = weightedPA[a.id] || 0;
      const bwa = weightedPA[b.id] || 0;
      if (awa !== bwa) return awa - bwa; // fewer against next
      return a.seed - b.seed; // then seed
    });
    const eliminatedSorted = eliminated
      .slice()
      .sort((a, b) => (a.lockedRank ?? Number.POSITIVE_INFINITY) - (b.lockedRank ?? Number.POSITIVE_INFINITY));
    return [...activeSorted, ...eliminatedSorted];
  }, [players, rounds]);

  // Compute a tight content-based width for the Name column (in ch units)
  const nameColCh = useMemo(() => {
    const maxLen = players.reduce((m, p) => Math.max(m, (p.name || "").length), 0);
    // Add a tiny breathing room so the text is not flush against the next column
    return Math.max(3, maxLen + 1);
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
    return `R1: ${s[kind][1]}  ·  R2: ${s[kind][2]}  ·  R3: ${s[kind][3]}`;
  };
  const fmtWinsTooltip = (id: string) => {
    const s = perRoundStats[id];
    if (!s) return "";
    return `R1: ${s.wins[1]}  ·  R2: ${s.wins[2]}  ·  R3: ${s.wins[3]}`;
  };
  const fmtLossesTooltip = (id: string) => {
    const s = perRoundStats[id];
    if (!s) return "";
    return `R1: ${s.losses[1]}  ·  R2: ${s.losses[2]}  ·  R3: ${s.losses[3]}`;
  };

  return (
    <Card className="w-fit">
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>Leaderboard</CardTitle>
        <Button variant="secondary" size="sm" onClick={() => setShowElo((v) => !v)}>
          {showElo ? "Hide Elo" : "Show Elo"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-xs text-slate-500">Score = weighted points (R1×1.0, R2×1.2, R3×1.4)</div>
        <div className="overflow-x-auto">
          <table className="w-fit text-sm border-collapse table-fixed">
            <thead>
              <tr className="text-center text-slate-600">
                <th className="py-1 px-1 w-10">Rank</th>
                <th className="py-1 px-1 whitespace-nowrap text-left" style={{ width: `${nameColCh}ch` }}>Name</th>
                <th className="py-1 px-1 w-14">Score</th>
                <th className="py-1 px-1 w-14">Points Won</th>
                <th className="py-1 px-1 w-14">Points Lost</th>
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
                const pfWeighted = (s ? s.pf[1] * roundWeight[1] + s.pf[2] * roundWeight[2] + s.pf[3] * roundWeight[3] : 0);
                const paWeighted = (s ? s.pa[1] * roundWeight[1] + s.pa[2] * roundWeight[2] + s.pa[3] * roundWeight[3] : 0);
                const pfRaw = (s ? s.pf[1] + s.pf[2] + s.pf[3] : 0);
                const paRaw = (s ? s.pa[1] + s.pa[2] + s.pa[3] : 0);
                const winsTotal = s ? s.wins[1] + s.wins[2] + s.wins[3] : 0;
                const lossesTotal = s ? s.losses[1] + s.losses[2] + s.losses[3] : 0;
                const rowBgClass = showElo && !p.eliminatedAtRound && delta !== 0 ? (delta > 0 ? "bg-emerald-50" : "bg-rose-50") : "";
                return (
                  <tr key={p.id} className={`border-t border-slate-200 ${rowBgClass}`}>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums`}>{p.lockedRank ?? i + 1}</td>
                    <td className={`py-1 px-1 ${greyClass} text-left whitespace-nowrap`} style={{ width: `${nameColCh}ch` }} title={p.name}>
                      {p.name} <span className="ml-1 text-xs text-slate-400">(#{p.seed})</span>
                    </td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums`} title="Weighted points (by round multipliers)">{Math.round(pfWeighted)}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtPointsTooltip(p.id, "pf")}>{pfRaw}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtPointsTooltip(p.id, "pa")}>{paRaw}</td>
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


