"use client";

import { motion } from "framer-motion";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEvent } from "@/lib/context";
import { useMemo, useState } from "react";

export default function MatchCard({ matchId }: { matchId: string }) {
  const { rounds, players, submitScore } = useEvent();
  const match = useMemo(() => rounds.flatMap((r) => r.matches).find((m) => m.id === matchId), [rounds, matchId]);
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const [scoreA, setScoreA] = useState<string>(
    match?.scoreA !== undefined ? String(match.scoreA) : ""
  );
  const [scoreB, setScoreB] = useState<string>(
    match?.scoreB !== undefined ? String(match.scoreB) : ""
  );
  if (!match) return null;

  const a1 = byId[match.a1];
  const a2 = byId[match.a2];
  const b1 = byId[match.b1];
  const b2 = byId[match.b2];

  const onSave = () => {
    const a = parseInt(scoreA || "0", 10);
    const b = parseInt(scoreB || "0", 10);
    submitScore(match.id, a, b);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">Court {match.court}</div>
        <div className="flex gap-2">
          {match.notes?.map((n, i) => (
            <Badge key={i}>{n}</Badge>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-center">
        <div className="space-y-1">
          <div className="font-medium">{a1?.name} <span className="text-xs text-slate-500">(#{a1?.seed})</span></div>
          <div className="font-medium">{a2?.name} <span className="text-xs text-slate-500">(#{a2?.seed})</span></div>
        </div>
        <div className="text-center text-slate-500">vs</div>
        <div className="space-y-1 sm:text-right">
          <div className="font-medium">{b1?.name} <span className="text-xs text-slate-500">(#{b1?.seed})</span></div>
          <div className="font-medium">{b2?.name} <span className="text-xs text-slate-500">(#{b2?.seed})</span></div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Input
          type="number"
          value={scoreA}
          onChange={(e) => setScoreA(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          className="w-24"
        />
        <span className="text-slate-400">:</span>
        <Input
          type="number"
          value={scoreB}
          onChange={(e) => setScoreB(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          className="w-24"
        />
        <Button onClick={onSave} className="ml-auto">{match.status === "completed" ? "Update" : "Save"}</Button>
      </div>
    </motion.div>
  );
}


