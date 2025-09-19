"use client";

import { useMemo, useRef, useState } from "react";
import { useEvent } from "@/lib/context";
import Button from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTabs } from "@/components/ui/tabs";

export default function PlayersTable() {
  const {
    players,
    addPlayer,
    removePlayer,
    reorderPlayers,
    generateRound1,
    exportJSON,
    importJSON,
    resetTournament,
    resetAll,
    demo12,
    rounds,
    r1Signature,
  } = useEvent();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ id: string; position: "before" | "after" } | null>(null);
  const tabs = useTabs();

  const sortedPlayers = useMemo(
    () => players.slice().sort((a, b) => a.seed - b.seed),
    [players]
  );

  const currentSignature = useMemo(
    () => sortedPlayers.map((p) => `${p.seed}:${p.name}`).join("|"),
    [sortedPlayers]
  );

  const canStart = players.length >= 8 && (rounds.length === 0 || r1Signature !== currentSignature);

  const onStart = () => {
    if (!canStart) return;
    generateRound1();
    tabs.setValue("rounds");
  };

  const onAdd = () => {
    const raw = name.trim();
    if (!raw) return;
    const exists = players.some((p) => p.name.trim().toLowerCase() === raw.toLowerCase());
    if (exists) {
      setError("Name already exists");
      inputRef.current?.focus();
      return;
    }
    const nextSeed = players.length + 1;
    addPlayer(raw, nextSeed);
    setName("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || !dragOverTarget) return;

    const ids = sortedPlayers.map((p) => p.id);
    const fromIndex = ids.indexOf(draggingId);
    let insertIndex = ids.indexOf(targetId);

    if (fromIndex === -1 || insertIndex === -1) {
      setDraggingId(null);
      setDragOverTarget(null);
      return;
    }

    if (dragOverTarget.position === "after") {
      insertIndex += 1;
    }

    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      setDraggingId(null);
      setDragOverTarget(null);
      return;
    }

    if (fromIndex < insertIndex) {
      insertIndex -= 1;
    }

    next.splice(insertIndex, 0, moved);
    reorderPlayers(next);
    setDraggingId(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverTarget(null);
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
          <Button variant="ghost" onClick={() => resetTournament()}>Reset tournament</Button>
          <Button variant="destructive" onClick={() => resetAll()}>Reset all</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            ref={inputRef}
            aria-invalid={!!error}
            className="max-w-[240px]"
          />
          <Button onClick={onAdd}>Add player</Button>
        </div>
        {error && <div className="-mt-3 mb-3 text-sm text-rose-600">{error}</div>}

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
              {sortedPlayers.map((p, idx) => {
                const isDragging = draggingId === p.id;
                const indicator =
                  dragOverTarget?.id === p.id
                    ? dragOverTarget.position === "before"
                      ? { boxShadow: "inset 0 2px 0 0 rgba(79, 70, 229, 0.6)" }
                      : { boxShadow: "inset 0 -2px 0 0 rgba(79, 70, 229, 0.6)" }
                    : undefined;

                return (
                  <tr
                    key={p.id}
                    draggable
                    onDragStart={() => setDraggingId(p.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!draggingId || draggingId === p.id) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                      setDragOverTarget({ id: p.id, position });
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop(p.id);
                    }}
                    className={`border-t border-slate-200 transition-colors ${
                      isDragging ? "opacity-60" : ""
                    } cursor-grab active:cursor-grabbing`}
                    style={indicator}
                  >
                    <td className="py-2">
                      <div className="flex h-10 w-12 select-none items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm">
                        {idx + 1}
                      </div>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}




