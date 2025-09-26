import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Button from "@/components/ui/button";

interface ColorScheme {
  text: string;
  bg: string;
  border: string;
  badge: string;
}

interface RoundControlsProps {
  playerCount: number;
  colorScheme: ColorScheme;
  multiplier: number;
  scoreCap: number;
  capOptions: number[];
  isCapLocked: boolean;
  isEditing: boolean;
  capDraft: string;
  currentWave: number;
  totalWaves: number;
  onCapChipClick: (cap: number) => void;
  onStartCapEdit: () => void;
  onCapDraftChange: (value: string) => void;
  onCommitCapDraft: () => void;
  onCancelCapEdit: () => void;
}

export default function RoundControls({
  playerCount,
  colorScheme,
  multiplier,
  scoreCap,
  capOptions,
  isCapLocked,
  isEditing,
  capDraft,
  currentWave,
  totalWaves,
  onCapChipClick,
  onStartCapEdit,
  onCapDraftChange,
  onCommitCapDraft,
  onCancelCapEdit
}: RoundControlsProps) {
  const capInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-slate-700">
      <span>{playerCount} players</span>
      <div className={`flex items-center gap-2 ${colorScheme.text} ${colorScheme.bg} px-2 py-1 rounded-lg ${colorScheme.border}`}>
        <span className="text-xs uppercase tracking-wide font-semibold">Points Multiplier</span>
        <Badge className={`${colorScheme.badge} text-white font-bold`}>{multiplier.toFixed(1)}×</Badge>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="text-xs uppercase tracking-wide text-slate-500">Game cap</span>
        {isEditing ? (
          <Input
            ref={capInputRef}
            type="number"
            min={5}
            value={capDraft}
            onChange={(e) => onCapDraftChange(e.target.value)}
            onBlur={onCommitCapDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitCapDraft();
              if (e.key === "Escape") onCancelCapEdit();
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
                variant={cap === scoreCap ? "secondary" : "ghost"}
                onClick={() => onCapChipClick(cap)}
                disabled={isCapLocked}
              >
                {cap}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onStartCapEdit}
              disabled={isCapLocked}
            >
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
  );
}