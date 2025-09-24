"use client";

import { useEffect, useRef, useState } from "react";

import { useEvent } from "@/lib/context";
import type { Match, R1WaveOrder } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import MatchCard from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Leaderboard from "@/components/Leaderboard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const R1_CAP_OPTIONS = [21, 15, 11];

const R2_WAVE_META: Record<number, { title: string; summary: string }> = {
  1: { title: "Wave 1 - Exploratory", summary: "Band-balanced opener exploring new pairings before the showdown." },
  2: { title: "Wave 2 - Showdown", summary: "Promotion showdown between top and bottom bands. Win and move on." },
};

const waveOrderOptions: { value: R1WaveOrder; label: string; detail: string; waves: string }[] = [
  {
    value: "explore-showdown-explore-showdown",
    label: "Explore > Showdown > Explore > Showdown",
    detail: "Four-wave flow that alternates explore pods with showdowns.",
    waves: "4 waves",
  },
  {
    value: "explore-explore-showdown",
    label: "Explore > Explore > Showdown",
    detail: "Three-wave sprint that doubles exploration before the showdown pod.",
    waves: "3 waves",
  },
];

export default function RoundsEditor() {
  const {
    rounds,
    players,
    schedulePrefs,
    updateSchedulePrefs,
    closeRound1,
    closeRound2,
    closeEvent,
    currentRound,
    submitScore,
    advanceR1Wave,
    advanceR2Wave,
  } = useEvent();

  const capOptions = R1_CAP_OPTIONS;
  const r1ScoreCap = schedulePrefs.r1ScoreCap ?? 15;
  const [editingCap, setEditingCap] = useState(false);
  const [capDraft, setCapDraft] = useState(String(r1ScoreCap));
  const capInputRef = useRef<HTMLInputElement>(null);
  const [r1HistoryOpen, setR1HistoryOpen] = useState(false);

  const [r2HistoryOpen, setR2HistoryOpen] = useState(false);

  // R2 game cap state
  const r2ScoreCap = schedulePrefs.r2ScoreCap ?? 11;
  const [editingR2Cap, setEditingR2Cap] = useState(false);
  const [r2CapDraft, setR2CapDraft] = useState(String(r2ScoreCap));
  const r2CapInputRef = useRef<HTMLInputElement>(null);

  // R3 game cap state
  const r3ScoreCap = schedulePrefs.r3ScoreCap ?? 11;
  const [editingR3Cap, setEditingR3Cap] = useState(false);
  const [r3CapDraft, setR3CapDraft] = useState(String(r3ScoreCap));
  const r3CapInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingCap) return;
    setCapDraft(String(r1ScoreCap));
    const raf = window.requestAnimationFrame(() => {
      capInputRef.current?.focus();
      capInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [editingCap, r1ScoreCap]);

  useEffect(() => {
    if (editingCap) return;
    setCapDraft(String(r1ScoreCap));
  }, [editingCap, r1ScoreCap]);

  // R2 cap editing effects
  useEffect(() => {
    if (!editingR2Cap) return;
    setR2CapDraft(String(r2ScoreCap));
    const raf = window.requestAnimationFrame(() => {
      r2CapInputRef.current?.focus();
      r2CapInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [editingR2Cap, r2ScoreCap]);

  useEffect(() => {
    if (editingR2Cap) return;
    setR2CapDraft(String(r2ScoreCap));
  }, [editingR2Cap, r2ScoreCap]);

  // R3 cap editing effects
  useEffect(() => {
    if (!editingR3Cap) return;
    setR3CapDraft(String(r3ScoreCap));
    const raf = window.requestAnimationFrame(() => {
      r3CapInputRef.current?.focus();
      r3CapInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [editingR3Cap, r3ScoreCap]);

  useEffect(() => {
    if (editingR3Cap) return;
    setR3CapDraft(String(r3ScoreCap));
  }, [editingR3Cap, r3ScoreCap]);

  const startCapEdit = () => {
    setCapDraft(String(r1ScoreCap));
    setEditingCap(true);
  };

  const cancelCapEdit = () => {
    setEditingCap(false);
    setCapDraft(String(r1ScoreCap));
  };

  const commitCapDraft = () => {
    const parsed = parseInt(capDraft, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      cancelCapEdit();
      return;
    }
    if (parsed !== r1ScoreCap) {
      updateSchedulePrefs({ r1ScoreCap: parsed });
    }
    setEditingCap(false);
  };

  const handleCapChipClick = (cap: number) => {
    if (cap === r1ScoreCap) {
      startCapEdit();
      return;
    }
    updateSchedulePrefs({ r1ScoreCap: cap });
    setEditingCap(false);
  };

  // R2 cap functions
  const startR2CapEdit = () => {
    setR2CapDraft(String(r2ScoreCap));
    setEditingR2Cap(true);
  };

  const cancelR2CapEdit = () => {
    setEditingR2Cap(false);
    setR2CapDraft(String(r2ScoreCap));
  };

  const commitR2CapDraft = () => {
    const parsed = parseInt(r2CapDraft, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      cancelR2CapEdit();
      return;
    }
    if (parsed !== r2ScoreCap) {
      updateSchedulePrefs({ r2ScoreCap: parsed });
    }
    setEditingR2Cap(false);
  };

  const handleR2CapChipClick = (cap: number) => {
    if (cap === r2ScoreCap) {
      startR2CapEdit();
      return;
    }
    updateSchedulePrefs({ r2ScoreCap: cap });
    setEditingR2Cap(false);
  };

  // R3 cap functions
  const startR3CapEdit = () => {
    setR3CapDraft(String(r3ScoreCap));
    setEditingR3Cap(true);
  };

  const cancelR3CapEdit = () => {
    setEditingR3Cap(false);
    setR3CapDraft(String(r3ScoreCap));
  };

  const commitR3CapDraft = () => {
    const parsed = parseInt(r3CapDraft, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      cancelR3CapEdit();
      return;
    }
    if (parsed !== r3ScoreCap) {
      updateSchedulePrefs({ r3ScoreCap: parsed });
    }
    setEditingR3Cap(false);
  };

  const handleR3CapChipClick = (cap: number) => {
    if (cap === r3ScoreCap) {
      startR3CapEdit();
      return;
    }
    updateSchedulePrefs({ r3ScoreCap: cap });
    setEditingR3Cap(false);
  };

  const r1 = rounds.find((r) => r.index === 1);
  const r2 = rounds.find((r) => r.index === 2);
  const r3 = rounds.find((r) => r.index === 3);

  const selectedOrder = schedulePrefs.r1WaveOrder;
  const waveOrderLocked = Boolean(r1 && (r1.currentWave ?? 0) > 0);
  const handleWaveOrderChange = (value: R1WaveOrder) => {
    if (waveOrderLocked || value === selectedOrder) return;
    updateSchedulePrefs({ r1WaveOrder: value });
  };

  const plannedWavesForOrder = selectedOrder === "explore-explore-showdown" ? 3 : 4;

  const targetGamesPlanned = r1?.totalWaves ?? r1?.waveSizes?.length ?? plannedWavesForOrder;

  const randomScoreForTarget = (target: number): [number, number] => {
    const winnerA = Math.random() < 0.5;
    const losing = Math.floor(Math.random() * target);
    return winnerA ? [target, losing] : [losing, target];
  };

  const totalWaves = r1?.totalWaves ?? r1?.waveSizes?.length ?? plannedWavesForOrder;
  const currentWave = r1?.currentWave ?? 0;

  const matchesByWave = new Map<number, Match[]>();
  if (r1) {
    r1.matches.forEach((match) => {
      const waveIndex = match.miniRoundIndex ?? 0;
      if (waveIndex <= 0) return;
      if (!matchesByWave.has(waveIndex)) matchesByWave.set(waveIndex, []);
      matchesByWave.get(waveIndex)!.push(match);
    });
  }

  const sortedWaveIndices = Array.from(matchesByWave.keys()).sort((a, b) => a - b);
  const activeWaveIndex =
    currentWave > 0
      ? currentWave
      : sortedWaveIndices.length > 0
        ? sortedWaveIndices[sortedWaveIndices.length - 1]
        : 1;
  const currentWaveMatches = currentWave > 0 ? matchesByWave.get(currentWave) ?? [] : [];
  const activeWaveMatches = matchesByWave.get(activeWaveIndex) ?? [];
  const historyWaveIndices = sortedWaveIndices.filter((idx) => idx !== activeWaveIndex).sort((a, b) => b - a);

  const waveCompleted = currentWaveMatches.length > 0 && currentWaveMatches.every((m) => m.status === "completed");
  const hasNextWave = currentWave > 0 && totalWaves > currentWave;
  const canAdvanceWave = currentWave === 0 || (hasNextWave && waveCompleted && r1?.status === "active");

  useEffect(() => {
    setR1HistoryOpen(false);
  }, [currentWave]);

  const totalMatchesPlanned = r1?.waveSizes?.reduce((acc, value) => acc + value, 0) ?? r1?.matches.length ?? 0;
  const completedMatches = r1?.matches.filter((m) => m.status === "completed").length ?? 0;
  const averageGames = players.length > 0 ? completedMatches / (players.length / 4) : 0;
  const canCloseRound1 = totalMatchesPlanned > 0 && completedMatches === totalMatchesPlanned && r1?.status !== "closed";

  // Round 2 wave logic
  const r2CurrentWave = r2?.currentWave ?? 1;
  const r2TotalWaves = 2; // Round 2 always has 2 waves
  const r2MatchesByWave = new Map<number, Match[]>();
  if (r2) {
    r2.matches.forEach((match) => {
      const waveIndex = match.miniRoundIndex ?? 0;
      if (waveIndex <= 0) return;
      if (!r2MatchesByWave.has(waveIndex)) r2MatchesByWave.set(waveIndex, []);
      r2MatchesByWave.get(waveIndex)!.push(match);
    });
  }

  const metaForR2Wave = (idx: number) => R2_WAVE_META[idx] ?? { title: `Wave ${idx}`, summary: "" };
  const r2WaveIndices = Array.from(r2MatchesByWave.keys()).sort((a, b) => a - b);
  const r2ActiveWaveIndex =
    r2WaveIndices.find((idx) => (r2MatchesByWave.get(idx) ?? []).some((m) => m.status !== "completed")) ??
    (r2WaveIndices[r2WaveIndices.length - 1] ?? 1);
  const r2ActiveWaveMatches = r2MatchesByWave.get(r2ActiveWaveIndex) ?? [];
  const r2HistoryWaveIndices = r2WaveIndices.filter((idx) => idx !== r2ActiveWaveIndex).sort((a, b) => b - a);
  const r2ActiveMeta = metaForR2Wave(r2ActiveWaveIndex);

  // Round 2 wave advancement logic
  const r2CurrentWaveMatches = r2CurrentWave > 0 ? r2MatchesByWave.get(r2CurrentWave) ?? [] : [];
  const r2WaveCompleted = r2CurrentWaveMatches.length > 0 && r2CurrentWaveMatches.every((m) => m.status === "completed");
  const r2HasNextWave = r2CurrentWave > 0 && r2TotalWaves > r2CurrentWave;
  const canAdvanceR2Wave = r2CurrentWave === 1 && r2HasNextWave && r2WaveCompleted && r2?.status === "active";

  useEffect(() => {
    setR2HistoryOpen(false);
  }, [r2ActiveWaveIndex]);

  const r2CompletedMatches = r2?.matches.filter((m) => m.status === "completed").length ?? 0;
  const r2TotalMatches = r2?.matches.length ?? 0;
  const r2Participants = r2 ? new Set(r2.matches.flatMap((m) => [m.a1, m.a2, m.b1, m.b2])).size : 0;
  const r2AverageGames = r2Participants > 0 ? (r2CompletedMatches * 4) / r2Participants : 0;
  const r2TargetGamesPlanned = 2;
  const canCloseRound2 = r2TotalMatches > 0 && r2CompletedMatches === r2TotalMatches && r2?.status !== "closed" && r2CurrentWave === r2TotalWaves;

  // Tab control state
  const [activeTab, setActiveTab] = useState(String(currentRound));

  // Update active tab when currentRound changes
  useEffect(() => {
    setActiveTab(String(currentRound));
  }, [currentRound]);

  // Enhanced close functions with tab switching
  const closeRound1WithTabSwitch = () => {
    closeRound1();
    setTimeout(() => setActiveTab("2"), 100); // Small delay to ensure round closes first
  };

  const closeRound2WithTabSwitch = () => {
    closeRound2();
    setTimeout(() => setActiveTab("3"), 100);
  };

  // Round access control
  const isRound1Complete = r1?.status === "closed";
  const isRound2Complete = r2?.status === "closed";
  const canAccessRound2 = isRound1Complete;
  const canAccessRound3 = isRound2Complete;

  // Prevent tab changes to inaccessible rounds
  const handleTabChange = (value: string) => {
    const tabNum = parseInt(value);
    if (tabNum === 2 && !canAccessRound2) return;
    if (tabNum === 3 && !canAccessRound3) return;
    setActiveTab(value);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <div className="lg:col-start-2 justify-self-center">
        <Card className="w-full lg:w-[720px]">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Rounds</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="1">Round 1</TabsTrigger>
                <TabsTrigger
                  value="2"
                  disabled={!canAccessRound2}
                  className={!canAccessRound2 ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Round 2 {!canAccessRound2 && "🔒"}
                </TabsTrigger>
                <TabsTrigger
                  value="3"
                  disabled={!canAccessRound3}
                  className={!canAccessRound3 ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Round 3 {!canAccessRound3 && "🔒"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="1">
                <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-600">Round 1 wave order</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {waveOrderLocked ? "Locked for this round" : "Choose before starting Wave 1"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {waveOrderLocked ? "Wave order can't change once Wave 1 begins." : "You can adjust this until Wave 1 starts."}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-1 lg:grid-cols-2">
                    {waveOrderOptions.map((option) => {
                      const isSelected = option.value === selectedOrder;
                      const isDisabled = waveOrderLocked && !isSelected;
                      const detailClass = isSelected ? "text-indigo-100" : "text-slate-600";
                      const badgeClass = isSelected ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-700";
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className="flex h-auto w-full flex-col items-start justify-start whitespace-normal break-words px-4 py-3 text-left"
                          onClick={() => handleWaveOrderChange(option.value)}
                          aria-pressed={isSelected}
                          disabled={isDisabled}
                        >
                          <div className="flex w-full flex-col items-start gap-1">
                            <div className="flex w-full flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{option.label}</span>
                              <Badge className={badgeClass}>{option.waves}</Badge>
                            </div>
                            <span className={`text-xs ${detailClass}`}>{option.detail}</span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
                {r1 && (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                      <span>{players.length} players</span>
                      <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-200">
                        <span className="text-xs uppercase tracking-wide font-semibold">Points Multiplier</span>
                        <Badge className="bg-orange-500 text-white font-bold">1.0×</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="text-xs uppercase tracking-wide text-slate-500">Game cap</span>
                        {editingCap && !isRound1Complete ? (
                          <Input
                            ref={capInputRef}
                            type="number"
                            min={5}
                            value={capDraft}
                            onChange={(e) => setCapDraft(e.target.value)}
                            onBlur={commitCapDraft}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitCapDraft();
                              if (e.key === "Escape") cancelCapEdit();
                            }}
                            className="h-9 w-20 border-slate-300 bg-white"
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            {capOptions.map((cap) => (
                              <Button
                                key={cap}
                                type="button"
                                size="sm"
                                variant={cap === r1ScoreCap ? "secondary" : "ghost"}
                                onClick={() => handleCapChipClick(cap)}
                                disabled={isRound1Complete}
                              >
                                {cap}
                              </Button>
                            ))}
                            <Button type="button" size="sm" variant="ghost" onClick={() => startCapEdit()} disabled={isRound1Complete}>
                              Custom
                            </Button>
                          </div>
                        )}
                      </div>
                      {currentWave > 0 && (
                        <span>Wave {currentWave} of {totalWaves}</span>
                      )}
                      {!currentWave && <span>Waves planned: {totalWaves}</span>}
                    </div>
                    {(canAdvanceWave || canCloseRound1) && (
                      <div className="mb-4">
                        {canAdvanceWave && (
                          <Button onClick={advanceR1Wave} className="w-full">
                            Advance to Wave {currentWave + 1}
                          </Button>
                        )}
                        {canCloseRound1 && (
                          <Button onClick={closeRound1WithTabSwitch} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                            Advance to Round 2
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Wave {activeWaveIndex}</div>
                    {activeWaveMatches.length > 0 ? (
                      <div className="space-y-3">
                        {activeWaveMatches.map((match) => (
                          <MatchCard key={match.id} matchId={match.id} readonly={isRound1Complete} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Matches will appear once Wave {activeWaveIndex} is generated.
                      </div>
                    )}
                  </div>

                  {historyWaveIndices.length > 0 && (
                    <Collapsible open={r1HistoryOpen} onOpenChange={setR1HistoryOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          <span>Previous waves ({historyWaveIndices.length})</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${r1HistoryOpen ? "rotate-180" : ""}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 space-y-4">
                          {historyWaveIndices.map((idx) => {
                            const historyMatches = matchesByWave.get(idx) ?? [];
                            return (
                              <div key={idx} className="space-y-2">
                                <div className="text-xs uppercase tracking-wide text-slate-500">Wave {idx}</div>
                                <div className="space-y-3">
                                  {historyMatches.map((match) => (
                                    <MatchCard key={match.id} matchId={match.id} readonly={isRound1Complete} />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {r1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                      <div className="text-xs text-slate-500">
                        Completed matches: {completedMatches}/{totalMatchesPlanned} - Avg games per player: {averageGames.toFixed(1)} /
                        {targetGamesPlanned}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isRound1Complete && currentWave > 0 && currentWaveMatches.some((m) => m.status !== "completed") && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const target = r1ScoreCap;
                              currentWaveMatches
                                .filter((m) => m.status !== "completed")
                                .forEach((m) => {
                                  const [a, b] = randomScoreForTarget(target);
                                  submitScore(m.id, a, b);
                                });
                            }}
                          >
                            Randomize current wave
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="2">
                <div className="space-y-4">
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-600">Round 2 wave order</div>
                        <div className="text-sm font-semibold text-slate-900">Exploratory opener into showdown finish.</div>
                      </div>
                      <div className="text-xs text-slate-500">Two waves, fixed format</div>
                    </div>
                  </div>
                  {r2 && (
                    <>
                      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                        <span>{r2Participants} players</span>
                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                          <span className="text-xs uppercase tracking-wide font-semibold">Points Multiplier</span>
                          <Badge className="bg-blue-500 text-white font-bold">1.2×</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="text-xs uppercase tracking-wide text-slate-500">Game cap</span>
                          {editingR2Cap && !isRound2Complete ? (
                            <Input
                              ref={r2CapInputRef}
                              type="number"
                              min={5}
                              value={r2CapDraft}
                              onChange={(e) => setR2CapDraft(e.target.value)}
                              onBlur={commitR2CapDraft}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitR2CapDraft();
                                if (e.key === "Escape") cancelR2CapEdit();
                              }}
                              className="h-9 w-20 border-slate-300 bg-white"
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              {capOptions.map((cap) => (
                                <Button
                                  key={cap}
                                  type="button"
                                  size="sm"
                                  variant={cap === r2ScoreCap ? "secondary" : "ghost"}
                                  onClick={() => handleR2CapChipClick(cap)}
                                  disabled={isRound2Complete}
                                >
                                  {cap}
                                </Button>
                              ))}
                              <Button type="button" size="sm" variant="ghost" onClick={() => startR2CapEdit()} disabled={isRound2Complete}>
                                Custom
                              </Button>
                            </div>
                          )}
                        </div>
                        {r2CurrentWave > 0 && (
                          <span>Wave {r2CurrentWave} of {r2TotalWaves}</span>
                        )}
                        {!r2CurrentWave && <span>Waves planned: {r2TotalWaves}</span>}
                      </div>
                      {(canAdvanceR2Wave || canCloseRound2) && (
                        <div className="mb-4">
                          {canAdvanceR2Wave && (
                            <Button onClick={advanceR2Wave} className="w-full">
                              Advance to Wave {r2CurrentWave + 1}
                            </Button>
                          )}
                          {canCloseRound2 && (
                            <Button onClick={closeRound2WithTabSwitch} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                              Advance to Finals
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">{r2ActiveMeta.title}</div>
                    {r2ActiveMeta.summary && <div className="mb-2 text-xs text-slate-500">{r2ActiveMeta.summary}</div>}
                    {r2ActiveWaveMatches.length > 0 ? (
                      <div className="space-y-3">
                        {r2ActiveWaveMatches.map((match) => (
                          <MatchCard key={match.id} matchId={match.id} readonly={isRound2Complete} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Matches will appear once Round 2 is generated.
                      </div>
                    )}
                  </div>

                  {r2HistoryWaveIndices.length > 0 && (
                    <Collapsible open={r2HistoryOpen} onOpenChange={setR2HistoryOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          <span>Previous waves ({r2HistoryWaveIndices.length})</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${r2HistoryOpen ? "rotate-180" : ""}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-3 space-y-4">
                          {r2HistoryWaveIndices.map((idx) => {
                            const meta = metaForR2Wave(idx);
                            const historyMatches = r2MatchesByWave.get(idx) ?? [];
                            return (
                              <div key={idx} className="space-y-2">
                                <div className="text-xs uppercase tracking-wide text-slate-500">{meta.title}</div>
                                {meta.summary && <div className="text-xs text-slate-500">{meta.summary}</div>}
                                <div className="space-y-3">
                                  {historyMatches.map((match) => (
                                    <MatchCard key={match.id} matchId={match.id} readonly={isRound2Complete} />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {r2 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-slate-500">
                        Completed matches: {r2CompletedMatches}/{r2TotalMatches} - Avg games per player: {r2AverageGames.toFixed(1)} / {r2TargetGamesPlanned}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isRound2Complete && r2CurrentWave > 0 && r2CurrentWaveMatches.some((m) => m.status !== "completed") && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const target = r2ScoreCap;
                              r2CurrentWaveMatches
                                .filter((m) => m.status !== "completed")
                                .forEach((m) => {
                                  const [a, b] = randomScoreForTarget(target);
                                  submitScore(m.id, a, b);
                                });
                            }}
                          >
                            Randomize current wave
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="3">
                <div className="space-y-4">
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-amber-700 font-medium">Final Four</div>
                        <div className="text-sm font-bold text-amber-900">Fight for the Turbosmash Crown!</div>
                      </div>
                      <div className="text-xs text-amber-600">Championship matches, games to 11</div>
                    </div>
                    <div className="mt-2 text-xs text-amber-700">
                      The ultimate showdown. Three matches determine the champion.
                    </div>
                  </div>
                  {r3 && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-4">
                        <span>4 players</span>
                        <div className="flex items-center gap-2 text-purple-600 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200">
                          <span className="text-xs uppercase tracking-wide font-semibold">Points Multiplier</span>
                          <Badge className="bg-purple-500 text-white font-bold">1.4×</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="text-xs uppercase tracking-wide text-slate-500">Game cap</span>
                          {editingR3Cap ? (
                            <Input
                              ref={r3CapInputRef}
                              type="number"
                              min={5}
                              value={r3CapDraft}
                              onChange={(e) => setR3CapDraft(e.target.value)}
                              onBlur={commitR3CapDraft}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitR3CapDraft();
                                if (e.key === "Escape") cancelR3CapEdit();
                              }}
                              className="h-9 w-20 border-slate-300 bg-white"
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              {capOptions.map((cap) => (
                                <Button
                                  key={cap}
                                  type="button"
                                  size="sm"
                                  variant={cap === r3ScoreCap ? "secondary" : "ghost"}
                                  onClick={() => handleR3CapChipClick(cap)}
                                >
                                  {cap}
                                </Button>
                              ))}
                              <Button type="button" size="sm" variant="ghost" onClick={() => startR3CapEdit()}>
                                Custom
                              </Button>
                            </div>
                          )}
                        </div>
                        <span>Final Four format</span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {r3?.matches.map((m) => (
                      <MatchCard key={m.id} matchId={m.id} />
                    ))}
                    {r3 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                        <div className="text-xs text-slate-500">
                          Championship round: {r3.matches.filter((m) => m.status === "completed").length}/{r3.matches.length} matches completed
                        </div>
                        <div className="flex items-center gap-2">
                          {r3.matches.some((m) => m.status !== "completed") && (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                const target = schedulePrefs.r3ScoreCap ?? 11;
                                r3.matches
                                  .filter((m) => m.status !== "completed")
                                  .forEach((m) => {
                                    const [a, b] = randomScoreForTarget(target);
                                    submitScore(m.id, a, b);
                                  });
                              }}
                            >
                              Randomize scores
                            </Button>
                          )}
                          {r3.matches.every((m) => m.status === "completed") && (
                            <Button onClick={() => closeEvent()}>Close Event</Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <div className="lg:sticky lg:top-20 self-start lg:col-start-3 lg:justify-self-end">
        <Leaderboard />
      </div>
    </div>
  );
}






