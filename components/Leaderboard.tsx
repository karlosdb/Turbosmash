"use client";

import { useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvent } from "@/lib/context";

export default function Leaderboard() {
  const { players } = useEvent();
  const prevRatings = useRef<Record<string, number>>({});
  useEffect(() => {
    const map: Record<string, number> = {};
    for (const p of players) map[p.id] = p.rating;
    prevRatings.current = map;
  }, [players]);

  const sorted = useMemo(() => players.slice().sort((a, b) => b.rating - a.rating), [players]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2">Rank</th>
                <th className="py-2">Name</th>
                <th className="py-2">Seed</th>
                <th className="py-2">Rating</th>
                <th className="py-2">Pts ±</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const delta = (p.rating - (prevRatings.current[p.id] ?? p.rating)) || 0;
                const deltaClass = delta > 0 ? "bg-green-50" : delta < 0 ? "bg-rose-50" : "";
                return (
                  <tr key={p.id} className={`border-t border-slate-200 transition-colors ${deltaClass}`}>
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.seed}</td>
                    <td className="py-2">{p.rating}</td>
                    <td className="py-2">{p.pointsFor - p.pointsAgainst}</td>
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


