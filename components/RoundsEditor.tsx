"use client";

import { useEffect, useRef, useState } from "react";

import { useEvent } from "@/lib/context";
import { computeRoundPlan, prelimWaveSequenceFromPrefs } from "@/lib/matchmaking";
import type { Match, R1WaveOrder, Round, RoundPlanEntry } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import MatchCard from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Leaderboard from "@/components/Leaderboard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import WaveSection from "@/components/WaveSection";
import WaveHistory from "@/components/WaveHistory";
import RoundControls from "@/components/RoundControls";
import ActionButtons from "@/components/ActionButtons";

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
    roundPlan,
    updateSchedulePrefs,
    closeRound1,
    closeRound2,
    closeEvent,
    currentRound,
    submitScore,
    advanceCurrentWave,
    closeCurrentRound,
  } = useEvent();

  const capOptions = R1_CAP_OPTIONS;

  // Constants
  const ARROW = "\u2192";

  // Dynamic round preference helpers
  const getRoundScoreCap = (roundIndex: number): number => {
    // Check new dynamic system first
    if (schedulePrefs.roundScoreCaps?.[roundIndex]) {
      return schedulePrefs.roundScoreCaps[roundIndex];
    }
    // Fall back to legacy system
    if (roundIndex === 1) return schedulePrefs.r1ScoreCap ?? 21;
    if (roundIndex === 2) return schedulePrefs.r2ScoreCap ?? 11;
    if (roundIndex === 3) return schedulePrefs.r3ScoreCap ?? 11;
    // Default for additional preliminary rounds
    return 11;
  };

  const setRoundScoreCap = (roundIndex: number, cap: number) => {
    const nextCaps = { ...(schedulePrefs.roundScoreCaps || {}) };
    nextCaps[roundIndex] = cap;
    updateSchedulePrefs({ roundScoreCaps: nextCaps });
  };

  const getRoundWaveOrder = (roundIndex: number): R1WaveOrder => {
    if (schedulePrefs.roundWaveOrders?.[roundIndex]) {
      return schedulePrefs.roundWaveOrders[roundIndex];
    }
    if (roundIndex === 1) {
      return schedulePrefs.r1WaveOrder;
    }
    const previousRoundOrder = schedulePrefs.roundWaveOrders?.[roundIndex - 1] || schedulePrefs.r1WaveOrder;
    return previousRoundOrder;
  };

  const setRoundWaveOrder = (roundIndex: number, order: R1WaveOrder) => {
    const next = { ...(schedulePrefs.roundWaveOrders || {}) };
    next[roundIndex] = order;
    updateSchedulePrefs({ roundWaveOrders: next });
  };

  const getRoundMultiplier = (roundIndex: number): number => {
    if (roundIndex === 1) return 1.0;
    if (roundIndex === 2) return 1.2;
    if (roundIndex === 3) return 1.4;
    // For additional rounds, continue increasing
    return 1.0 + (roundIndex - 1) * 0.2;
  };

  const getRoundColorScheme = (roundIndex: number) => {
    const schemes = [
      { text: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-500" },
      { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-500" },
      { text: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-500" },
      { text: "text-green-600", bg: "bg-green-50", border: "border-green-200", badge: "bg-green-500" },
      { text: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", badge: "bg-indigo-500" },
    ];
    return schemes[(roundIndex - 1) % schemes.length];
  };

  const isRoundWaveOrderLocked = (roundIndex: number): boolean => {
    const round = rounds.find((r) => r.index === roundIndex);
    return Boolean(round && ((round.currentWave ?? 0) > 0 || (round.matches?.length ?? 0) > 0 || round.status === "closed"));
  };

  const isRoundCapLocked = (roundIndex: number): boolean => {
    const round = rounds.find((r) => r.index === roundIndex);
    if (!round) return false;
    if (round.status === "closed") return true;
    const hasGeneratedWave = round.matches?.some((match) => (match.miniRoundIndex ?? 0) > 0) ?? false;
    return (round.currentWave ?? 0) > 0 || hasGeneratedWave;
  };

  // Consolidated round editing state
  const [editingCapForRound, setEditingCapForRound] = useState<number | null>(null);
  const [capDraft, setCapDraft] = useState("");
  const capInputRef = useRef<HTMLInputElement>(null);
  const [historyOpenForRound, setHistoryOpenForRound] = useState<Record<number, boolean>>({});

  // Consolidated cap editing effects
  useEffect(() => {
    if (editingCapForRound === null) return;
    const currentCap = getRoundScoreCap(editingCapForRound);
    setCapDraft(String(currentCap));
    const raf = window.requestAnimationFrame(() => {
      capInputRef.current?.focus();
      capInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [editingCapForRound, schedulePrefs]);

  // Consolidated cap editing functions
  const startCapEdit = (roundIndex: number) => {
    if (isRoundCapLocked(roundIndex)) return;
    const currentCap = getRoundScoreCap(roundIndex);
    setCapDraft(String(currentCap));
    setEditingCapForRound(roundIndex);
  };

  const cancelCapEdit = () => {
    setEditingCapForRound(null);
    setCapDraft("");
  };

  const commitCapDraft = () => {
    if (editingCapForRound === null || isRoundCapLocked(editingCapForRound)) {
      cancelCapEdit();
      return;
    }
    const parsed = parseInt(capDraft, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      cancelCapEdit();
      return;
    }
    const currentCap = getRoundScoreCap(editingCapForRound);
    if (parsed !== currentCap) {
      setRoundScoreCap(editingCapForRound, parsed);
    }
    setEditingCapForRound(null);
  };

  const handleCapChipClick = (roundIndex: number, cap: number) => {
    if (isRoundCapLocked(roundIndex)) return;
    const currentCap = getRoundScoreCap(roundIndex);
    if (cap === currentCap) {
      startCapEdit(roundIndex);
      return;
    }
    setRoundScoreCap(roundIndex, cap);
  };

  const prelimRounds = rounds.filter((r) => r.kind === "prelim");
  const globalPlanLocked = prelimRounds.some((round) => (round.currentWave ?? 0) > 0 || (round.matches?.length ?? 0) > 0 || round.status === "closed");
  const basePlan = computeRoundPlan(players.length, schedulePrefs);
  const effectivePlan = globalPlanLocked && roundPlan.length > 0 ? roundPlan : basePlan;
  const planSizes = effectivePlan.reduce<number[]>((acc, entry, idx) => {
    const startingPlayers = idx === 0 ? players.length : effectivePlan[idx - 1].targetSize;
    if (!acc.length) acc.push(startingPlayers);
    if (acc[acc.length - 1] !== entry.targetSize) acc.push(entry.targetSize);
    return acc;
  }, []);
  const planDisplay = planSizes.length ? planSizes.join(` ${ARROW} `) : "-";
  const threeRoundCapEnabled = Boolean(schedulePrefs.threeRoundCap);


  const toggleThreeRoundCap = () => {
    if (globalPlanLocked) return;
    updateSchedulePrefs({ threeRoundCap: !threeRoundCapEnabled });
  };

  const randomScoreForTarget = (target: number): [number, number] => {
    const winnerA = Math.random() < 0.5;
    const losing = Math.floor(Math.random() * target);
    return winnerA ? [target, losing] : [losing, target];
  };

  // Tab control state
  const [activeTab, setActiveTab] = useState(String(currentRound));

  // Update active tab when currentRound changes
  useEffect(() => {
    setActiveTab(String(currentRound));
  }, [currentRound]);

  // Dynamic round access control based on plan
  const getRoundAccessibility = () => {
    const accessibility: Record<number, boolean> = { 1: true }; // Round 1 always accessible

    for (let i = 2; i <= effectivePlan.length; i++) {
      const previousRound = rounds.find(r => r.index === i - 1);
      accessibility[i] = previousRound?.status === "closed";
    }

    return accessibility;
  };

  const roundAccessibility = getRoundAccessibility();

  // Round completion status
  const isRound1Complete = rounds.find(r => r.index === 1)?.status === "closed";
  const isRound2Complete = rounds.find(r => r.index === 2)?.status === "closed";

  // Prevent tab changes to inaccessible rounds
  const handleTabChange = (value: string) => {
    const tabNum = parseInt(value);
    if (!roundAccessibility[tabNum]) return;
    setActiveTab(value);
  };

  // Helper function to render round content based on round type
  const renderRoundContent = (roundPlan: RoundPlanEntry) => {
    const roundIndex = roundPlan.index;
    const round = rounds.find(r => r.index === roundIndex);

    if (roundPlan.kind === "prelim") {
      // For preliminary rounds, use the generalized component
      return renderPreliminaryRoundContent(roundIndex, round);
    } else if (roundPlan.kind === "eight") {
      // For semifinals (8-player round), render similar to Round 2
      return renderSemifinalsContent(roundIndex, round);
    } else if (roundPlan.kind === "final") {
      // For finals, render similar to Round 3
      return renderFinalsContent(roundIndex, round);
    }
    return null;
  };

  const renderPreliminaryRoundContent = (roundIndex: number, round: Round | undefined) => {
    const roundPlan = effectivePlan.find(p => p.index === roundIndex);
    if (!roundPlan || roundPlan.kind !== "prelim") return null;

    const scoreCap = getRoundScoreCap(roundIndex);
    const colorScheme = getRoundColorScheme(roundIndex);
    const multiplier = getRoundMultiplier(roundIndex);
    const waveOrderLocked = isRoundWaveOrderLocked(roundIndex);
    const selectedOrder = getRoundWaveOrder(roundIndex);
    const isCapLocked = isRoundCapLocked(roundIndex);
    const isEditing = editingCapForRound === roundIndex;

    // Wave and match logic for this round
    const plannedWavesForOrder = selectedOrder === "explore-showdown-explore-showdown" ? 4 : 3;
    const targetGamesPlanned = selectedOrder === "explore-showdown-explore-showdown" ? 4 : 3;
    const totalWaves = round?.totalWaves ?? round?.waveSizes?.length ?? plannedWavesForOrder;
    const currentWave = round?.currentWave ?? 0;

    const matchesByWave = new Map<number, Match[]>();
    if (round) {
      round.matches.forEach((match) => {
        const waveIndex = match.miniRoundIndex ?? 0;
        if (waveIndex <= 0) return;
        if (!matchesByWave.has(waveIndex)) matchesByWave.set(waveIndex, []);
        matchesByWave.get(waveIndex)!.push(match);
      });
    }

    const sortedWaveIndices = Array.from(matchesByWave.keys()).sort((a, b) => a - b);
    const activeWaveIndex = currentWave > 0 ? currentWave : (sortedWaveIndices.length > 0 ? sortedWaveIndices[sortedWaveIndices.length - 1] : 1);
    const currentWaveMatches = currentWave > 0 ? matchesByWave.get(currentWave) ?? [] : [];
    const activeWaveMatches = matchesByWave.get(activeWaveIndex) ?? [];
    const historyWaveIndices = sortedWaveIndices.filter((idx) => idx !== activeWaveIndex).sort((a, b) => b - a);

    const waveCompleted = currentWaveMatches.length > 0 && currentWaveMatches.every((m) => m.status === "completed");
    const hasNextWave = currentWave > 0 && totalWaves > currentWave;
    const canAdvanceWave = currentWave === 0 || (hasNextWave && waveCompleted && round?.status === "active");

    const totalMatchesPlanned = round?.waveSizes?.reduce((acc, value) => acc + value, 0) ?? round?.matches.length ?? 0;
    const completedMatches = round?.matches.filter((m) => m.status === "completed").length ?? 0;
    const averageGames = players.length > 0 ? completedMatches / (players.length / 4) : 0;
    const canCloseRound = totalMatchesPlanned > 0 && completedMatches === totalMatchesPlanned && round?.status !== "closed";
    const isRoundComplete = round?.status === "closed";

    const handleWaveOrderChange = (order: R1WaveOrder) => {
      if (waveOrderLocked) return;
      setRoundWaveOrder(roundIndex, order);
    };

    const historyOpen = historyOpenForRound[roundIndex] ?? false;
    const setHistoryOpen = (open: boolean) => {
      setHistoryOpenForRound(prev => ({ ...prev, [roundIndex]: open }));
    };

    return (
      <div className="space-y-4">
        {/* Wave Order Selection Card */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-600">Round {roundIndex} wave order</div>
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

        {/* Round 1 specific cards */}
        {roundIndex === 1 && players.length > 14 && !globalPlanLocked && (
          <>
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-600">Tournament Structure</div>
                  <div className="text-sm font-semibold text-slate-900">{planDisplay}</div>
                </div>
                <div className="text-xs text-slate-500">
                  Player progression through preliminary rounds
                </div>
              </div>
            </div>
            <div className="mb-4">
              <Button
                onClick={toggleThreeRoundCap}
                variant={threeRoundCapEnabled ? "default" : "outline"}
                className="w-full"
              >
                {threeRoundCapEnabled ? "✓ " : ""}3 Round Fast Mode
                {threeRoundCapEnabled ? " (Enabled)" : " (Click to Enable)"}
              </Button>
            </div>
          </>
        )}

        {/* Round Info and Controls */}
        {round && (
          <>
            <RoundControls
              playerCount={players.length}
              colorScheme={colorScheme}
              multiplier={multiplier}
              scoreCap={scoreCap}
              capOptions={capOptions}
              isCapLocked={isCapLocked}
              isEditing={isEditing}
              capDraft={capDraft}
              currentWave={currentWave}
              totalWaves={totalWaves}
              onCapChipClick={(cap) => handleCapChipClick(roundIndex, cap)}
              onStartCapEdit={() => startCapEdit(roundIndex)}
              onCapDraftChange={setCapDraft}
              onCommitCapDraft={commitCapDraft}
              onCancelCapEdit={cancelCapEdit}
            />
            <ActionButtons
              canAdvanceWave={canAdvanceWave}
              canCloseRound={canCloseRound}
              currentWave={currentWave}
              colorScheme={colorScheme}
              roundType="prelim"
              onAdvanceWave={advanceCurrentWave}
              onCloseRound={closeCurrentRound}
            />
          </>
        )}

        {/* Matches Section */}
        <WaveSection
          waveIndex={activeWaveIndex}
          matches={activeWaveMatches}
          readonly={isRoundComplete}
          showTypeDescription={false}
        />

        {/* History Section */}
        <WaveHistory
          historyWaves={historyWaveIndices.map((idx) => ({
            waveIndex: idx,
            matches: matchesByWave.get(idx) ?? []
          }))}
          isOpen={historyOpen}
          onToggle={setHistoryOpen}
          readonly={isRoundComplete}
          showTypeDescriptions={false}
        />

        {/* Round Stats and Actions */}
        {round && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <div className="text-xs text-slate-500">
              Completed matches: {completedMatches}/{totalMatchesPlanned} - Avg games per player: {averageGames.toFixed(1)} / {targetGamesPlanned}
            </div>
            <div className="flex items-center gap-2">
              {!isRoundComplete && currentWave > 0 && currentWaveMatches.some((m) => m.status !== "completed") && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const target = scoreCap;
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
    );
  };

  const renderSemifinalsContent = (roundIndex: number, round: Round | undefined) => {
    const roundPlan = effectivePlan.find(p => p.index === roundIndex);
    if (!roundPlan || roundPlan.kind !== "eight") return null;

    const scoreCap = getRoundScoreCap(roundIndex);
    const colorScheme = getRoundColorScheme(roundIndex);
    const multiplier = getRoundMultiplier(roundIndex);
    const isCapLocked = isRoundCapLocked(roundIndex);
    const isEditing = editingCapForRound === roundIndex;

    // Semifinals have fixed 2-wave sequence: explore, showdown
    const totalWaves = 2;
    const currentWave = round?.currentWave ?? 0;

    const matchesByWave = new Map<number, Match[]>();
    if (round) {
      round.matches.forEach((match) => {
        const waveIndex = match.miniRoundIndex ?? 0;
        if (waveIndex <= 0) return;
        if (!matchesByWave.has(waveIndex)) matchesByWave.set(waveIndex, []);
        matchesByWave.get(waveIndex)!.push(match);
      });
    }

    const sortedWaveIndices = Array.from(matchesByWave.keys()).sort((a, b) => a - b);
    const activeWaveIndex = currentWave > 0 ? currentWave : (sortedWaveIndices.length > 0 ? sortedWaveIndices[sortedWaveIndices.length - 1] : 1);
    const currentWaveMatches = currentWave > 0 ? matchesByWave.get(currentWave) ?? [] : [];
    const activeWaveMatches = matchesByWave.get(activeWaveIndex) ?? [];
    const historyWaveIndices = sortedWaveIndices.filter((idx) => idx !== activeWaveIndex).sort((a, b) => b - a);

    const waveCompleted = currentWaveMatches.length > 0 && currentWaveMatches.every((m) => m.status === "completed");
    const hasNextWave = currentWave > 0 && totalWaves > currentWave;
    const canAdvanceWave = currentWave === 0 || (hasNextWave && waveCompleted && round?.status === "active");

    const totalMatchesPlanned = round?.waveSizes?.reduce((acc, value) => acc + value, 0) ?? round?.matches.length ?? 0;
    const completedMatches = round?.matches.filter((m) => m.status === "completed").length ?? 0;
    const averageGames = players.length > 0 ? completedMatches / (players.length / 4) : 0;
    const canCloseRound = totalMatchesPlanned > 0 && completedMatches === totalMatchesPlanned && round?.status !== "closed" && currentWave === totalWaves;
    const isRoundComplete = round?.status === "closed";

    const historyOpen = historyOpenForRound[roundIndex] ?? false;
    const setHistoryOpen = (open: boolean) => {
      setHistoryOpenForRound(prev => ({ ...prev, [roundIndex]: open }));
    };

    return (
      <div className="space-y-4">
        {/* Semifinals Info */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-600">Semifinals</div>
              <div className="text-sm font-semibold text-slate-900">2 waves: Explore → Showdown</div>
            </div>
            <div className="text-xs text-slate-500">
              Wave 1 explores new pairings, Wave 2 showdown for finals spots
            </div>
          </div>
        </div>

        {/* Round Info and Controls */}
        {round && (
          <>
            <RoundControls
              playerCount={players.length}
              colorScheme={colorScheme}
              multiplier={multiplier}
              scoreCap={scoreCap}
              capOptions={capOptions}
              isCapLocked={isCapLocked}
              isEditing={isEditing}
              capDraft={capDraft}
              currentWave={currentWave}
              totalWaves={totalWaves}
              onCapChipClick={(cap) => handleCapChipClick(roundIndex, cap)}
              onStartCapEdit={() => startCapEdit(roundIndex)}
              onCapDraftChange={setCapDraft}
              onCommitCapDraft={commitCapDraft}
              onCancelCapEdit={cancelCapEdit}
            />
            <ActionButtons
              canAdvanceWave={canAdvanceWave}
              canCloseRound={canCloseRound}
              currentWave={currentWave}
              colorScheme={colorScheme}
              roundType="eight"
              onAdvanceWave={advanceCurrentWave}
              onCloseRound={closeCurrentRound}
            />
          </>
        )}

        {/* Matches Section */}
        <WaveSection
          waveIndex={activeWaveIndex}
          matches={activeWaveMatches}
          waveType={activeWaveIndex === 1 ? "explore" : "showdown"}
          readonly={isRoundComplete}
          showTypeDescription={true}
        />

        {/* Match History */}
        <WaveHistory
          historyWaves={historyWaveIndices.map((idx) => ({
            waveIndex: idx,
            matches: matchesByWave.get(idx) ?? [],
            waveType: idx === 1 ? "explore" : "showdown"
          }))}
          isOpen={historyOpen}
          onToggle={setHistoryOpen}
          readonly={true}
          showTypeDescriptions={true}
        />

        {/* Round Stats and Actions */}
        {round && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <div className="text-xs text-slate-500">
              Completed matches: {completedMatches}/{totalMatchesPlanned} - Avg games per player: {averageGames.toFixed(1)}
            </div>
            <div className="flex items-center gap-2">
              {!isRoundComplete && currentWave > 0 && currentWaveMatches.some((m) => m.status !== "completed") && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const target = scoreCap;
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
    );
  };

  const renderFinalsContent = (roundIndex: number, round: Round | undefined) => {
    const roundPlan = effectivePlan.find(p => p.index === roundIndex);
    if (!roundPlan || roundPlan.kind !== "final") return null;

    const scoreCap = getRoundScoreCap(roundIndex);
    const colorScheme = getRoundColorScheme(roundIndex);
    const multiplier = getRoundMultiplier(roundIndex);
    const isCapLocked = isRoundCapLocked(roundIndex);
    const isEditing = editingCapForRound === roundIndex;

    // Finals have only 1 wave with all matches
    const totalWaves = 1;
    const currentWave = round?.currentWave ?? 0;
    const allMatches = round?.matches ?? [];

    const totalMatchesPlanned = allMatches.length;
    const completedMatches = allMatches.filter((m) => m.status === "completed").length;
    const canCloseRound = totalMatchesPlanned > 0 && completedMatches === totalMatchesPlanned && round?.status !== "closed";
    const isRoundComplete = round?.status === "closed";

    return (
      <div className="space-y-4">
        {/* Finals Info */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-600">Finals</div>
              <div className="text-sm font-semibold text-slate-900">3 matches: All team combinations</div>
            </div>
            <div className="text-xs text-slate-500">
              Best 4 players compete in all possible team pairings
            </div>
          </div>
        </div>

        {/* Round Info and Controls */}
        {round && (
          <>
            <RoundControls
              playerCount={players.length}
              colorScheme={colorScheme}
              multiplier={multiplier}
              scoreCap={scoreCap}
              capOptions={capOptions}
              isCapLocked={isCapLocked}
              isEditing={isEditing}
              capDraft={capDraft}
              currentWave={0} // Finals don't use waves
              totalWaves={totalWaves}
              onCapChipClick={(cap) => handleCapChipClick(roundIndex, cap)}
              onStartCapEdit={() => startCapEdit(roundIndex)}
              onCapDraftChange={setCapDraft}
              onCommitCapDraft={commitCapDraft}
              onCancelCapEdit={cancelCapEdit}
            />
            <ActionButtons
              canAdvanceWave={false} // No wave advancement in finals
              canCloseRound={canCloseRound}
              currentWave={0}
              colorScheme={colorScheme}
              roundType="final"
              onAdvanceWave={advanceCurrentWave}
              onCloseRound={closeCurrentRound}
            />
          </>
        )}

        {/* Finals Matches */}
        <WaveSection
          waveIndex={1}
          matches={allMatches}
          readonly={isRoundComplete}
          showTypeDescription={false}
        />

        {/* Round Stats */}
        {round && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <div className="text-xs text-slate-500">
              Completed matches: {completedMatches}/{totalMatchesPlanned}
            </div>
            <div className="flex items-center gap-2">
              {!isRoundComplete && allMatches.some((m) => m.status !== "completed") && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const target = scoreCap;
                    allMatches
                      .filter((m) => m.status !== "completed")
                      .forEach((m) => {
                        const [a, b] = randomScoreForTarget(target);
                        submitScore(m.id, a, b);
                      });
                  }}
                >
                  Randomize all matches
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
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
                {effectivePlan.map((roundPlan, index) => {
                  const roundIndex = roundPlan.index;
                  const canAccess = roundAccessibility[roundIndex];
                  const roundName = roundPlan.kind === "prelim" ? `Round ${roundIndex}` :
                                  roundPlan.kind === "eight" ? "Semifinals" :
                                  "Finals";

                  return (
                    <TabsTrigger
                      key={roundIndex}
                      value={String(roundIndex)}
                      disabled={!canAccess}
                      className={!canAccess ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {roundName} {!canAccess && "🔒"}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {effectivePlan.map((roundPlan) => {
                const roundIndex = roundPlan.index;
                const round = rounds.find(r => r.index === roundIndex);
                const content = renderRoundContent(roundPlan);

                return (
                  <TabsContent key={roundIndex} value={String(roundIndex)}>
                    {content}
                  </TabsContent>
                );
              })}
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






