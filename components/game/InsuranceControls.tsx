"use client";

interface InsuranceControlsProps {
  maxInsurance: number;
  chips: number;
  onAccept: () => void;
  onDecline: () => void;
  countdownSec?: number | null;
}

export function InsuranceControls({
  maxInsurance,
  chips,
  onAccept,
  onDecline,
  countdownSec,
}: InsuranceControlsProps) {
  const affordable = Math.min(maxInsurance, chips);
  const canTake = affordable >= 1;

  return (
    <div className="flex flex-col items-center gap-3 px-4">
      <p className="text-center text-sm text-amber-200/90 font-medium max-w-sm">
        El crupier muestra un As. Puedes pagar seguro hasta la mitad de tu apuesta (paga 2:1 si hay
        blackjack del crupier).
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onAccept}
          disabled={!canTake}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-bold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
        >
          Seguro ${affordable >= 1 ? affordable : 0}
          {maxInsurance > affordable && canTake ? ` (máx. $${maxInsurance})` : ""}
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm
            border border-white/15 transition-all active:scale-95 cursor-pointer"
        >
          No gracias
        </button>
      </div>
      {countdownSec != null && countdownSec > 0 && (
        <p className="text-xs text-gray-400 tabular-nums">Seguro: {countdownSec}s</p>
      )}
    </div>
  );
}
