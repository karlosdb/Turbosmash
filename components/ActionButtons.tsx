import Button from "@/components/ui/button";

interface ColorScheme {
  badge: string;
}

interface ActionButtonsProps {
  canAdvanceWave: boolean;
  canCloseRound: boolean;
  currentWave: number;
  colorScheme: ColorScheme;
  roundType: "prelim" | "eight" | "final";
  onAdvanceWave: () => void;
  onCloseRound: () => void;
}

const getAdvanceButtonText = (currentWave: number): string => {
  return `Advance to Wave ${currentWave + 1}`;
};

const getCloseButtonText = (roundType: string): string => {
  switch (roundType) {
    case "eight":
      return "Advance to Finals";
    case "prelim":
      return "Advance to Next Round";
    case "final":
      return "Complete Tournament";
    default:
      return "Advance to Next Round";
  }
};

export default function ActionButtons({
  canAdvanceWave,
  canCloseRound,
  currentWave,
  colorScheme,
  roundType,
  onAdvanceWave,
  onCloseRound
}: ActionButtonsProps) {
  if (!canAdvanceWave && !canCloseRound) {
    return null;
  }

  return (
    <div className="mb-4">
      {canAdvanceWave && (
        <Button onClick={onAdvanceWave} className="w-full">
          {getAdvanceButtonText(currentWave)}
        </Button>
      )}
      {canCloseRound && (
        <Button
          onClick={onCloseRound}
          className={`w-full ${colorScheme.badge} hover:bg-orange-600 text-white font-semibold`}
        >
          {getCloseButtonText(roundType)}
        </Button>
      )}
    </div>
  );
}