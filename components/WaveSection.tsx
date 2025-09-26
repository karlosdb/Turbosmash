import { Match } from "@/lib/types";
import MatchCard from "./MatchCard";

type WaveType = "explore" | "showdown";

interface WaveSectionProps {
  waveIndex: number;
  matches: Match[];
  waveType?: WaveType;
  readonly?: boolean;
  showTypeDescription?: boolean;
}

const getWaveTypeLabel = (waveType: WaveType): string => {
  switch (waveType) {
    case "explore":
      return "Exploratory";
    case "showdown":
      return "Showdown";
    default:
      return "";
  }
};

export default function WaveSection({
  waveIndex,
  matches,
  waveType,
  readonly = false,
  showTypeDescription = false
}: WaveSectionProps) {
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Matches will appear once Wave {waveIndex} is generated.
      </div>
    );
  }

  const waveTypeLabel = waveType ? getWaveTypeLabel(waveType) : "";
  const headerText = showTypeDescription && waveTypeLabel
    ? `Wave ${waveIndex} - ${waveTypeLabel}`
    : `Wave ${waveIndex}`;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-900">
        {headerText}
      </h3>
      <div className="grid gap-3">
        {matches.map((match) => (
          <MatchCard key={match.id} matchId={match.id} readonly={readonly} />
        ))}
      </div>
    </div>
  );
}