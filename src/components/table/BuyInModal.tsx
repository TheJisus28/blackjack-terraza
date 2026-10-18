"use client";

import Link from "next/link";
import { useState } from "react";
import { ChipAmount } from "@/components/ui/Chip";
import { Modal } from "@/components/ui/Modal";
import { tableAction } from "@/lib/api";
import { fmt } from "@/lib/format";
import type { TableConfig } from "@/lib/game/types";
import { sound } from "@/lib/sound";
import { errorText, toast } from "@/lib/toast";

export function BuyInModal({
  tableId,
  config,
  seat,
  chips,
  onClose,
}: {
  tableId: string;
  config: TableConfig;
  seat: number | null;
  chips: number;
  onClose: () => void;
}) {
  return (
    <Modal open={seat !== null} onClose={onClose} title={`ASIENTO ${seat !== null ? seat + 1 : ""}`} width="max-w-md">
      {seat !== null && <BuyInForm key={seat} tableId={tableId} config={config} seat={seat} chips={chips} onDone={onClose} />}
    </Modal>
  );
}

function BuyInForm({
  tableId,
  config,
  seat,
  chips,
  onDone,
}: {
  tableId: string;
  config: TableConfig;
  seat: number;
  chips: number;
  onDone: () => void;
}) {
  const max = chips;
  const [amount, setAmount] = useState(() => Math.min(max, Math.max(config.minBet, config.minBet * 40)));
  const [busy, setBusy] = useState(false);
  const presets = [10, 25, 50, 100].map((k) => config.minBet * k).filter((v) => v <= max);

  if (max < config.minBet) {
    return (
      <div className="flex flex-col gap-4">
        <p>
          Necesitas al menos <b className="text-gold">{fmt(config.minBet)}</b> fichas para esta mesa y tienes {fmt(max)}.
        </p>
        <Link href="/lobby" className="pixel-btn btn-gold">
          Buscar una mesa más baja
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-dim">¿Con cuántas fichas te sientas? Puedes recargar después entre manos.</p>
      <ChipAmount amount={amount} size={28} className="text-2xl text-gold" />
      <input
        type="range"
        min={config.minBet}
        max={max}
        step={config.minBet}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-full accent-[#f6c544]"
      />
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p} className={`pixel-btn px-2 text-[0.5rem] ${amount === p ? "btn-gold" : ""}`} onClick={() => setAmount(p)}>
            {fmt(p)}
          </button>
        ))}
        <button className={`pixel-btn px-2 text-[0.5rem] ${amount === max ? "btn-gold" : ""}`} onClick={() => setAmount(max)}>
          Todo
        </button>
      </div>
      <button
        className="pixel-btn btn-green py-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          sound.unlock();
          try {
            await tableAction(tableId, { type: "sit", seat, buyIn: amount });
            sound.play("chips-stack");
            onDone();
          } catch (err) {
            toast.error(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        Sentarme con {fmt(amount)}
      </button>
    </div>
  );
}
