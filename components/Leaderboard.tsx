"use client";

import { useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvent } from "@/lib/context";

export default function Leaderboard() {
  const { players, rounds } = useEvent();
  const prevRatings = useRef<Record<string, number>>({});
  useEffect(() => {
    const map: Record<string, number> = {};
    for (const p of players) map[p.id] = p.rating;
    prevRatings.current = map;
  }, [players]);

  // Show active players first (by rating), then eliminated players locked at bottom (by lockedRank)
  const sorted = useMemo(() => {
    const active = players.filter((p) => !p.eliminatedAtRound);
    const eliminated = players.filter((p) => p.eliminatedAtRound);
    const activeSorted = active.slice().sort((a, b) => b.rating - a.rating);
    const eliminatedSorted = eliminated
      .slice()
      .sort((a, b) => (a.lockedRank ?? Number.POSITIVE_INFINITY) - (b.lockedRank ?? Number.POSITIVE_INFINITY));
    return [...activeSorted, ...eliminatedSorted];
  }, [players]);

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
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-fit text-sm border-collapse table-fixed">
            <thead>
              <tr className="text-center text-slate-600">
                <th className="py-1 px-1 w-10">Rank</th>
                <th className="py-1 px-1 whitespace-nowrap text-left" style={{ width: `${nameColCh}ch` }}>Name</th>
                <th className="py-1 px-1 hidden sm:table-cell w-10">Seed</th>
                <th className="py-1 px-1 hidden md:table-cell w-20">Rating</th>
                <th className="py-1 px-1 w-12">Points Won</th>
                <th className="py-1 px-1 w-12">Points Lost</th>
                <th className="py-1 px-1 w-10">Wins</th>
                <th className="py-1 px-1 w-12">Losses</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const delta = (p.rating - (prevRatings.current[p.id] ?? p.rating)) || 0;
                const greyClass = p.eliminatedAtRound ? "text-slate-400" : "";
                const s = perRoundStats[p.id];
                const pfTotal = p.pointsFor;
                const paTotal = p.pointsAgainst;
                const winsTotal = s ? s.wins[1] + s.wins[2] + s.wins[3] : 0;
                const lossesTotal = s ? s.losses[1] + s.losses[2] + s.losses[3] : 0;
                const rowBgClass = !p.eliminatedAtRound && delta !== 0 ? (delta > 0 ? "bg-emerald-50" : "bg-rose-50") : "";
                return (
                  <tr key={p.id} className={`border-t border-slate-200 ${rowBgClass}`}>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums`}>{p.lockedRank ?? i + 1}</td>
                    <td className={`py-1 px-1 ${greyClass} text-left whitespace-nowrap`} style={{ width: `${nameColCh}ch` }} title={p.name}>{p.name}</td>
                    <td className={`py-1 px-1 ${greyClass} hidden sm:table-cell text-center tabular-nums`}>{p.seed}</td>
                    <td className={`py-1 px-1 ${greyClass} hidden md:table-cell tabular-nums`}>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                        <span className="col-start-2 justify-self-center text-center">{p.rating}</span>
                        {!p.eliminatedAtRound && delta !== 0 && (
                          <span className={`col-start-3 justify-self-end text-xs ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>{delta > 0 ? `+${Math.round(delta)}` : Math.round(delta)}</span>
                        )}
                      </div>
                    </td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtPointsTooltip(p.id, "pf")}>{pfTotal}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtPointsTooltip(p.id, "pa")}>{paTotal}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtWinsTooltip(p.id)}>{winsTotal}</td>
                    <td className={`py-1 px-1 ${greyClass} text-center tabular-nums cursor-help hover:underline focus:underline decoration-dotted underline-offset-2`} title={fmtLossesTooltip(p.id)}>{lossesTotal}</td>
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


