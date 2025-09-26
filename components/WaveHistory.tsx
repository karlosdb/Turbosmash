import { Match } from "@/lib/types";
import MatchCard from "./MatchCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Button from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

type WaveType = "explore" | "showdown";

interface HistoryWave {
  waveIndex: number;
  matches: Match[];
  waveType?: WaveType;
}

interface WaveHistoryProps {
  historyWaves: HistoryWave[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  readonly?: boolean;
  showTypeDescriptions?: boolean;
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

export default function WaveHistory({
  historyWaves,
  isOpen,
  onToggle,
  readonly = false,
  showTypeDescriptions = false
}: WaveHistoryProps) {
  if (historyWaves.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="flex w-full items-center justify-start gap-2 px-0 text-slate-600 hover:text-slate-900">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          <span className="text-sm font-medium">Wave History ({historyWaves.length} waves)</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <div className="space-y-4">
          {historyWaves.map(({ waveIndex, matches, waveType }) => {
            const waveTypeLabel = waveType ? getWaveTypeLabel(waveType) : "";
            const headerText = showTypeDescriptions && waveTypeLabel
              ? `Wave ${waveIndex} - ${waveTypeLabel} (Complete)`
              : `Wave ${waveIndex} (Complete)`;

            return (
              <div key={waveIndex} className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700">
                  {headerText}
                </h4>
                <div className="grid gap-2">
                  {matches.map((match) => (
                    <MatchCard key={match.id} matchId={match.id} readonly={readonly} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}