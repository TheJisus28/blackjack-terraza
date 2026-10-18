import Link from "next/link";
import { Portrait } from "@/components/ui/Portrait";
import type { LobbySummary } from "@/lib/game/engine";
import { themeOf } from "@/lib/game/tables";
import { compact } from "@/lib/format";

const PHASE_LABEL: Record<LobbySummary["phase"], string> = {
  waiting: "Esperando jugadores",
  betting: "Apuestas abiertas",
  dealing: "Repartiendo",
  insurance: "Seguro",
  playing: "En juego",
  dealer: "Juega el crupier",
  payout: "Pagando",
};

export function TableCard({ table, mine }: { table: LobbySummary; mine: boolean }) {
  const theme = themeOf(table.theme);
  const seats = Array.from({ length: table.seats }, (_, i) => table.players[i]);
  const occupied = table.humans + table.bots;
  const full = table.humans >= table.seats;
  return (
    <article className="pixel-box flex flex-col">
      <div
        className="relative overflow-hidden px-4 pb-4 pt-3"
        style={{ background: `linear-gradient(180deg, ${theme.felt}, color-mix(in srgb, ${theme.felt} 60%, black))` }}
      >
        <div
          className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full border-4 opacity-25"
          style={{ borderColor: theme.accent }}
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-[0.7rem] leading-snug text-ink text-shadow-pixel">{table.name}</h3>
            <p className="mt-2 font-display text-[0.6rem]" style={{ color: theme.accent }}>
              {compact(table.minBet)} – {compact(table.maxBet)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {table.official ? (
              <span className="bg-black/40 px-2 py-0.5 text-xs text-gold">Oficial</span>
            ) : (
              <span className="bg-black/40 px-2 py-0.5 text-xs text-blue">De jugador</span>
            )}
            {table.isPrivate && <span className="bg-black/40 px-2 py-0.5 text-xs">Privada</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap gap-1.5 text-sm text-ink-dim">
          <span className="pixel-inset px-2 py-0.5">{table.decks} {table.decks === 1 ? "mazo" : "mazos"}</span>
          <span className="pixel-inset px-2 py-0.5">{table.hitSoft17 ? "H17" : "S17"}</span>
          <span className="pixel-inset px-2 py-0.5">BJ {table.blackjackPays >= 1.5 ? "3:2" : "6:5"}</span>
          {table.surrender && <span className="pixel-inset px-2 py-0.5">Rendición</span>}
          {table.sideBets !== false && <span className="pixel-inset px-2 py-0.5 text-gold">Laterales</span>}
        </div>

        <div className="flex gap-1.5">
          {seats.map((p, i) =>
            p ? (
              <div key={i} className="relative" title={p.bot ? `${p.name} (IA)` : p.name}>
                <Portrait id={p.avatar?.id ?? "robert"} size={30} />
                {p.bot && (
                  <span className="absolute -bottom-1 -right-1 bg-[#120d22] px-0.5 font-display text-[0.4rem] text-ink-dim">
                    IA
                  </span>
                )}
              </div>
            ) : (
              <div key={i} className="h-[30px] w-[30px] border-2 border-dashed border-line" />
            ),
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="text-sm leading-tight">
            <p className={table.phase === "waiting" ? "text-ink-dim" : "text-green"}>{PHASE_LABEL[table.phase]}</p>
            <p className="text-ink-dim">
              {occupied}/{table.seats} sentados{table.phase !== "waiting" ? ` · ronda ${table.round}` : ""}
            </p>
          </div>
          <Link
            href={`/mesa/${table.id}`}
            className={`pixel-btn ${mine ? "btn-gold" : full ? "" : "btn-green"} px-3 text-[0.6rem]`}
          >
            {mine ? "Volver" : full ? "Mirar" : "Jugar"}
          </Link>
        </div>
      </div>
    </article>
  );
}
