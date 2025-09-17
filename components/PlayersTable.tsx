"use client";

import { useState } from "react";
import { useEvent } from "@/lib/context";
import { useMemo } from "react";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTabs } from "@/components/ui/tabs";

export default function PlayersTable() {
  const { players, addPlayer, removePlayer, updateSeed, generateRound1, exportJSON, importJSON, reset, demo12, rounds, r1Signature } = useEvent();
  const [name, setName] = useState("");
  const [seed, setSeed] = useState<number>(players.length + 1);
  const tabs = useTabs();

  const onAdd = () => {
    if (!name.trim()) return;
    addPlayer(name.trim(), seed);
    setName("");
    setSeed((s) => s + 1);
  };

  // Compute current signature of players+seeds to gate the Start button
  const currentSignature = useMemo(() => (
    players
      .slice()
      .sort((a, b) => a.seed - b.seed)
      .map((p) => `${p.seed}:${p.name}`)
      .join("|")
  ), [players]);

  const canStart = players.length >= 8 && (rounds.length === 0 || r1Signature !== currentSignature);

  const onStart = () => {
    if (!canStart) return;
    generateRound1();
    // jump to rounds tab for a smoother flow
    tabs.setValue("rounds");
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Players</CardTitle>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => demo12()}>Demo 12</Button>
          <Button
            onClick={onStart}
            disabled={!canStart}
            className="shadow-sm hover:shadow-md active:scale-[0.99]"
          >
            Start tournament
          </Button>
          <Button variant="outline" onClick={() => {
            const blob = new Blob([exportJSON()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "turbosmash.json";
            a.click();
            URL.revokeObjectURL(url);
          }}>Export JSON</Button>
          <Button variant="outline" onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "application/json";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              const text = await file.text();
              importJSON(text);
            };
            input.click();
          }}>Import JSON</Button>
          <Button variant="ghost" onClick={() => reset()}>Reset</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-[240px]" />
          <Input placeholder="Seed" type="number" value={seed}
                 onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))} className="w-24" />
          <Button onClick={onAdd}>Add player</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2">Seed</th>
                <th className="py-2">Name</th>
                <th className="py-2">Rating</th>
                <th className="py-2">Pts+</th>
                <th className="py-2">Pts-</th>
                <th className="py-2">Eliminated?</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players
                .slice()
                .sort((a, b) => a.seed - b.seed)
                .map((p) => (
                  <tr key={p.id} className="border-t border-slate-200">
                    <td className="py-2">
                      <Input
                        type="number"
                        value={p.seed}
                        onChange={(e) => updateSeed(p.id, parseInt(e.target.value || "0", 10))}
                        className="w-20"
                      />
                    </td>
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.rating}</td>
                    <td className="py-2">{p.pointsFor}</td>
                    <td className="py-2">{p.pointsAgainst}</td>
                    <td className="py-2">{p.eliminatedAtRound ? `R${p.eliminatedAtRound}` : ""}</td>
                    <td className="py-2">
                      <Button variant="destructive" onClick={() => removePlayer(p.id)}>Remove</Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


