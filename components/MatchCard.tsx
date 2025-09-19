"use client";

import { motion } from "framer-motion";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEvent } from "@/lib/context";
import { useEffect, useMemo, useRef, useState } from "react";

const compromiseLabels: Record<string, string> = {
  "repeat-partner": "Repeat partner",
  "repeat-opponent": "Repeat opponent",
  "rating-gap": "Rating gap",
};

const compromiseStyles: Record<string, string> = {
  "repeat-partner": "bg-amber-100 text-amber-800 ring-amber-200",
  "repeat-opponent": "bg-amber-100 text-amber-800 ring-amber-200",
  "rating-gap": "bg-rose-100 text-rose-700 ring-rose-200",
};

export default function MatchCard({ matchId }: { matchId: string }) {
  const { rounds, players, submitScore } = useEvent();
  const match = useMemo(() => rounds.flatMap((r) => r.matches).find((m) => m.id === matchId), [rounds, matchId]);
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const [scoreA, setScoreA] = useState<string>(match?.scoreA !== undefined ? String(match.scoreA) : "");
  const [scoreB, setScoreB] = useState<string>(match?.scoreB !== undefined ? String(match.scoreB) : "");
  const [winner, setWinner] = useState<"A" | "B" | null>(() => {
    if (match?.scoreA !== undefined && match?.scoreB !== undefined) {
      if (match.scoreA > match.scoreB) return "A";
      if (match.scoreB > match.scoreA) return "B";
    }
    return null;
  });
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);
  const a1 = match ? byId[match.a1] : undefined;
  const a2 = match ? byId[match.a2] : undefined;
  const b1 = match ? byId[match.b1] : undefined;
  const b2 = match ? byId[match.b2] : undefined;

  const roundTarget = match && match.roundIndex === 1 ? 21 : 15;
  const waveLabel = match && match.roundIndex === 1 && match.miniRoundIndex ? `Wave ${match.miniRoundIndex}` : null;
  const compromiseLabel = match?.compromise ? compromiseLabels[match.compromise] ?? "" : "";
  const compromiseClass = match?.compromise ? compromiseStyles[match.compromise] ?? "" : "";

  useEffect(() => {
    if (!match) return;
    if (match.scoreA !== undefined) setScoreA(String(match.scoreA));
    if (match.scoreB !== undefined) setScoreB(String(match.scoreB));
    if (match.scoreA !== undefined && match.scoreB !== undefined) {
      if (match.scoreA > match.scoreB) setWinner("A");
      else if (match.scoreB > match.scoreA) setWinner("B");
      else setWinner(null);
    }
  }, [match]);

  const selectWinner = (side: "A" | "B") => {
    setWinner(side);
    if (side === "A") {
      setScoreA(String(roundTarget));
      setTimeout(() => inputBRef.current?.focus(), 0);
    } else {
      setScoreB(String(roundTarget));
      setTimeout(() => inputARef.current?.focus(), 0);
    }
  };

  const getIntendedScores = () => {
    let a = parseInt(scoreA || "0", 10);
    let b = parseInt(scoreB || "0", 10);
    if (winner === "A") a = roundTarget;
    else if (winner === "B") b = roundTarget;
    return [a, b] as const;
  };

  const onSave = () => {
    const [a, b] = getIntendedScores();
    if (match) submitScore(match.id, a, b);
  };

  const canSave =
    winner !== null && ((winner === "A" && scoreB !== "") || (winner === "B" && scoreA !== ""));

  const maxLosing = roundTarget - 1;
  const losingScoreStr = winner === "A" ? scoreB : winner === "B" ? scoreA : "";
  const losingScoreNum = parseInt(losingScoreStr, 10);
  const isLosingInvalid =
    losingScoreStr !== "" && (Number.isNaN(losingScoreNum) || losingScoreNum < 0 || losingScoreNum > maxLosing);

  const [intendedA, intendedB] = getIntendedScores();
  const buttonEnabled =
    !isLosingInvalid && (match?.status === "completed"
      ? canSave && (intendedA !== match.scoreA || intendedB !== match.scoreB)
      : canSave);

  if (!match) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span>Court {match.court}</span>
          {waveLabel && <Badge className="bg-indigo-100 text-indigo-700 ring-indigo-200">{waveLabel}</Badge>}
        </div>
        {compromiseLabel && (
          <Badge className={`text-xs ${compromiseClass}`}>{compromiseLabel}</Badge>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-center">
        <div className="space-y-1">
          <div className="font-medium">
            {a1?.name} <span className="text-xs text-slate-500">(#{a1?.seed})</span>
          </div>
          <div className="font-medium">
            {a2?.name} <span className="text-xs text-slate-500">(#{a2?.seed})</span>
          </div>
        </div>
        <div className="text-center text-slate-500">vs</div>
        <div className="space-y-1 sm:text-right">
          <div className="font-medium">
            {b1?.name} <span className="text-xs text-slate-500">(#{b1?.seed})</span>
          </div>
          <div className="font-medium">
            {b2?.name} <span className="text-xs text-slate-500">(#{b2?.seed})</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {winner === "B" ? (
          <Input
            ref={inputARef}
            type="number"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && buttonEnabled) onSave();
            }}
            min={0}
            max={maxLosing}
            aria-invalid={isLosingInvalid}
            className={`w-24 ${isLosingInvalid ? "border-rose-400 bg-rose-50 focus-visible:ring-rose-500" : ""}`}
          />
        ) : winner === "A" ? (
          <button
            type="button"
            onClick={() => setWinner(null)}
            title="Click to change winner"
            className="flex h-10 w-24 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            {scoreA || String(roundTarget)}
          </button>
        ) : (
          <Button
            variant="secondary"
            className="w-24 bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700"
            onClick={() => selectWinner("A")}
          >
            Winner
          </Button>
        )}

        <span className="text-slate-400">:</span>

        {winner === "A" ? (
          <Input
            ref={inputBRef}
            type="number"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && buttonEnabled) onSave();
            }}
            min={0}
            max={maxLosing}
            aria-invalid={isLosingInvalid}
            className={`w-24 ${isLosingInvalid ? "border-rose-400 bg-rose-50 focus-visible:ring-rose-500" : ""}`}
          />
        ) : winner === "B" ? (
          <button
            type="button"
            onClick={() => setWinner(null)}
            title="Click to change winner"
            className="flex h-10 w-24 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            {scoreB || String(roundTarget)}
          </button>
        ) : (
          <Button
            variant="secondary"
            className="w-24 bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700"
            onClick={() => selectWinner("B")}
          >
            Winner
          </Button>
        )}

        <Button onClick={onSave} className="ml-auto" disabled={!buttonEnabled}>
          {match.status === "completed" ? "Update" : "Save"}
        </Button>
      </div>
    </motion.div>
  );
}
