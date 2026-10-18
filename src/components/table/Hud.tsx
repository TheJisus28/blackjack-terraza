"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardSprite } from "@/components/ui/CardSprite";
import { ChipAmount, ChipIcon } from "@/components/ui/Chip";
import { Portrait } from "@/components/ui/Portrait";
import { tableAction } from "@/lib/api";
import { bettingChips, compact, fmt, signed } from "@/lib/format";
import { codes, isNatural, totalLabel } from "@/lib/game/cards";
import { allowedActions, describeRules } from "@/lib/game/rules";
import { maxSideBet, SIDE_BETS, SIDE_BET_IDS, SIDE_KIND_LABELS, type SideBetId, type SideKind } from "@/lib/game/sidebets";
import { basicStrategy, MOVE_LABELS, safeMove, type Move } from "@/lib/game/strategy";
import type { Hand, Seat, TableConfig, TableState } from "@/lib/game/types";
import type { UserRecord } from "@/lib/profile";
import { useFreeCam } from "@/lib/freecam";
import { useSettings, type CameraMode } from "@/lib/settings";
import { sound } from "@/lib/sound";
import { errorText, toast } from "@/lib/toast";
import type { ChatMessage } from "@/hooks/useTable";
import { ChatPanel } from "./ChatPanel";
import type { DealTimeline } from "./timeline";

type Act = (action: Record<string, unknown>) => Promise<void>;

const EMOTES = ["👍", "🎉", "😂", "😮", "😡", "🍀", "👋", "😢"];
const CAMERAS: { id: CameraMode; label: string }[] = [
  { id: "table", label: "Mesa" },
  { id: "player", label: "Mi asiento" },
  { id: "top", label: "Cenital" },
];

const RESULT_TEXT: Record<NonNullable<Hand["result"]>, string> = {
  blackjack: "BLACKJACK",
  win: "GANA",
  push: "EMPATE",
  lose: "PIERDE",
  bust: "SE PASÓ",
  surrender: "RENDIDA",
};

export function Hud({
  tableId,
  config,
  state,
  uid,
  profile,
  mySeat,
  seatedElsewhere,
  serverNow,
  chat,
  onEmote,
  timeline,
}: {
  tableId: string;
  config: TableConfig;
  state: TableState;
  uid: string;
  profile: UserRecord | null;
  mySeat: number | null;
  seatedElsewhere: boolean;
  serverNow: () => number;
  chat: { messages: ChatMessage[]; send: (uid: string, name: string, text: string) => Promise<void> };
  onEmote: (e: string) => void;
  timeline: DealTimeline;
}) {
  const seat = mySeat !== null ? state.seats[mySeat] : undefined;
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);

  const act = useCallback<Act>(
    async (action) => {
      setBusy(true);
      sound.stinger("click");
      try {
        await tableAction(tableId, action);
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        setBusy(false);
      }
    },
    [tableId],
  );

  const myTurn = state.phase === "playing" && state.turn?.seat === mySeat && !!seat;
  const needsInsurance = state.phase === "insurance" && !!seat && seat.hands.length > 0 && !seat.insuranceDecided;

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || busy) return;
      const k = e.key.toLowerCase();
      if (myTurn && seat && state.turn) {
        const allowed = allowedActions(config, seat, state.turn.hand);
        const map: Record<string, Move> = { h: "hit", s: "stand", d: "double", p: "split", r: "surrender" };
        const move = map[k];
        if (move && allowed[move]) act({ type: move });
      } else if (needsInsurance && (k === "y" || k === "n")) {
        act({ type: "insurance", take: k === "y" });
      } else if (state.phase === "betting" && seat && (k === "enter" || k === " ") && seat.bet >= config.minBet && !seat.ready) {
        e.preventDefault();
        act({ type: "ready" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [myTurn, needsInsurance, seat, state.phase, state.turn, config, act, busy]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <HudTop
        config={config}
        state={state}
        onToggleChat={() => setChatOpen((v) => !v)}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        chatCount={chat.messages.length}
      />

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} seated={mySeat !== null} />}

      <FreeCamBadge />

      <div className="flex-1" />

      <ResultBanner state={state} seat={seat} timeline={timeline} />

      <div className="pointer-events-none flex flex-col items-center gap-3 px-3 pb-3">
        <PhaseTimer state={state} serverNow={serverNow} mine={myTurn || (state.phase === "betting" && !!seat && !seat.ready)} />
        <div className="pointer-events-none relative flex w-full flex-col items-center gap-3 lg:block lg:min-h-[7rem]">
          <div className="pointer-events-auto flex w-full items-end justify-between gap-3 lg:absolute lg:bottom-0 lg:left-0 lg:right-0">
            {seat ? (
              <SeatBox
                seat={seat}
                config={config}
                profile={profile}
                busy={busy}
                onLeave={() =>
                  act({ type: "leave" }).then(() =>
                    toast.info(seat.hands.length ? "Saldrás al terminar la mano" : "Te levantaste de la mesa"),
                  )
                }
                onRebuy={() => setRebuyOpen(true)}
              />
            ) : (
              <span />
            )}
            {seat && <EmoteBar onEmote={onEmote} />}
          </div>
          <div className="pointer-events-auto relative z-10 flex justify-center lg:mx-auto lg:w-fit">
            <MainPanel
              config={config}
              state={state}
              seat={seat}
              seatedElsewhere={seatedElsewhere}
              myTurn={myTurn}
              needsInsurance={needsInsurance}
              act={act}
              busy={busy}
              mySeat={mySeat}
            />
          </div>
        </div>
      </div>

      {chatOpen && profile && (
        <ChatPanel messages={chat.messages} onSend={(text) => chat.send(uid, profile.name, text)} onClose={() => setChatOpen(false)} />
      )}
      {rebuyOpen && profile && seat && (
        <RebuyModal tableId={tableId} config={config} chips={profile.chips} onClose={() => setRebuyOpen(false)} />
      )}
    </div>
  );
}

function FreeCamBadge() {
  const active = useFreeCam((s) => s.active);
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(id);
  }, []);
  if (active) {
    return (
      <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2">
        <div className="pixel-box animate-pop-in px-3 py-1.5 font-display text-[0.5rem] text-gold">VISTA LIBRE · SUELTA PARA VOLVER</div>
      </div>
    );
  }
  if (!hint) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 hidden -translate-x-1/2 md:block">
      <div className="pixel-box px-3 py-1.5 text-sm text-ink-dim">Mantén el clic derecho y arrastra para mirar la mesa libremente · rueda para acercar</div>
    </div>
  );
}

function HudTop({
  config,
  state,
  onToggleChat,
  onToggleSettings,
  chatCount,
}: {
  config: TableConfig;
  state: TableState;
  onToggleChat: () => void;
  onToggleSettings: () => void;
  chatCount: number;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const camera = useSettings((s) => s.camera);
  const setSettings = useSettings((s) => s.set);
  const shoePct = state.shoe.total ? Math.round((state.shoe.remaining / state.shoe.total) * 100) : 100;
  const unseen = useRef(0);
  return (
    <div className="pointer-events-auto flex flex-wrap items-start justify-between gap-3 p-3">
      <div className="flex items-start gap-3">
        <Link href="/lobby" className="pixel-btn px-3 text-[0.55rem]">
          ← Mesas
        </Link>
        <button className="pixel-box px-3 py-1.5 text-left" onClick={() => setRulesOpen((v) => !v)}>
          <p className="font-display text-[0.6rem] text-gold">{config.name}</p>
          <p className="text-sm text-ink-dim">
            Apuesta {fmt(config.minBet)} – {fmt(config.maxBet)} · Ronda {state.round}
          </p>
          {rulesOpen && (
            <ul className="mt-2 flex flex-col gap-0.5 text-sm">
              {describeRules(config).map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          )}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="pixel-inset hidden items-center gap-2 px-2 py-1.5 sm:flex" title="Cartas restantes en el zapato">
          <span className="text-xs text-ink-dim">Zapato</span>
          <div className="h-2 w-16 bg-black/50">
            <div className="h-full bg-blue" style={{ width: `${shoePct}%` }} />
          </div>
        </div>
        <div className="flex">
          {CAMERAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSettings({ camera: c.id })}
              className={`pixel-btn px-2 text-[0.5rem] ${camera === c.id ? "btn-gold" : ""}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button className="pixel-btn px-3 text-[0.55rem]" onClick={onToggleSettings} aria-label="Ajustes">
          ♪
        </button>
        <button
          className="pixel-btn px-3 text-[0.55rem]"
          onClick={() => {
            unseen.current = chatCount;
            onToggleChat();
          }}
        >
          Chat
        </button>
      </div>
    </div>
  );
}

function PhaseTimer({ state, serverNow, mine }: { state: TableState; serverNow: () => number; mine: boolean }) {
  const bar = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const total = useRef(1);
  const lastTick = useRef(-1);
  useEffect(() => {
    total.current = Math.max(1, state.phaseEndsAt - serverNow());
  }, [state.phaseEndsAt, state.phase, state.turn?.seat, state.turn?.hand, serverNow]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const left = Math.max(0, state.phaseEndsAt - serverNow());
      if (bar.current) bar.current.style.width = `${Math.min(100, (left / total.current) * 100)}%`;
      const secs = Math.ceil(left / 1000);
      if (label.current) label.current.textContent = state.phaseEndsAt ? `${secs}s` : "";
      if (mine && secs <= 5 && secs > 0 && secs !== lastTick.current) {
        lastTick.current = secs;
        sound.stinger("tick");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // rAF can be throttled; keep the label fresh anyway.
    const id = setInterval(loop, 250);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [state.phaseEndsAt, serverNow, mine]);

  const PHASES: Record<TableState["phase"], string> = {
    waiting: "Esperando jugadores",
    betting: "Hagan sus apuestas",
    dealing: "Repartiendo",
    insurance: "Seguro",
    playing: state.turn ? `Turno de ${state.seats[state.turn.seat]?.name ?? "..."}` : "En juego",
    dealer: "Juega el crupier",
    payout: "Pagos",
  };
  if (state.phase === "waiting") return null;
  return (
    <div className="pixel-box flex w-full max-w-md items-center gap-3 px-3 py-1.5">
      <span className="font-display text-[0.55rem] text-gold">{PHASES[state.phase]}</span>
      <div className="h-2 flex-1 bg-black/50">
        <div ref={bar} className={`h-full ${mine ? "bg-red" : "bg-gold"}`} />
      </div>
      <span ref={label} className="w-8 text-right font-display text-[0.55rem]" />
    </div>
  );
}

function SeatBox({
  seat,
  config,
  profile,
  busy,
  onLeave,
  onRebuy,
}: {
  seat: Seat;
  config: TableConfig;
  profile: UserRecord | null;
  busy: boolean;
  onLeave: () => void;
  onRebuy: () => void;
}) {
  const low = seat.stack + seat.bet < config.minBet && seat.hands.length === 0;
  return (
    <div className="pixel-box flex items-center gap-3 px-3 py-2">
      <Portrait id={seat.avatar.id} size={44} ring="#f6c544" />
      <div className="flex flex-col leading-tight">
        <span className="text-base">{seat.name}</span>
        <span className="flex items-center gap-1 text-sm text-gold">
          <ChipIcon value={100} size={16} /> {fmt(seat.stack)}
        </span>
        {profile && <span className="text-xs text-ink-dim">Saldo: {compact(profile.chips)}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          className={`pixel-btn px-2 py-1 text-[0.45rem] ${low ? "btn-gold animate-pulse" : ""}`}
          onClick={onRebuy}
          disabled={busy || seat.hands.length > 0}
        >
          Recargar
        </button>
        <button className="pixel-btn btn-red px-2 py-1 text-[0.45rem]" onClick={onLeave} disabled={busy || seat.leaving}>
          {seat.leaving ? "Saliendo" : "Levantarse"}
        </button>
      </div>
    </div>
  );
}

function MainPanel({
  config,
  state,
  seat,
  seatedElsewhere,
  myTurn,
  needsInsurance,
  act,
  busy,
  mySeat,
}: {
  config: TableConfig;
  state: TableState;
  seat?: Seat;
  seatedElsewhere: boolean;
  myTurn: boolean;
  needsInsurance: boolean;
  act: Act;
  busy: boolean;
  mySeat: number | null;
}) {
  if (!seat) {
    const free = Array.from({ length: config.seats }, (_, i) => i).filter((i) => !state.seats[i] || state.seats[i].bot);
    return (
      <div className="pixel-box px-5 py-3 text-center">
        {seatedElsewhere ? (
          <p>
            Ya estás sentado en otra mesa.{" "}
            <Link href="/lobby" className="text-gold underline">
              Ve al lobby
            </Link>
          </p>
        ) : free.length ? (
          <p className="text-lg">
            Toca <span className="text-gold">Sentarse</span> en un asiento libre para jugar
          </p>
        ) : (
          <p className="text-lg">Mesa llena: estás mirando la partida</p>
        )}
      </div>
    );
  }

  if (state.phase === "betting") return <BetPanel config={config} seat={seat} act={act} busy={busy} />;
  if (needsInsurance) return <InsurancePanel seat={seat} act={act} busy={busy} blackjack={isNatural(seat.hands[0])} />;
  if (myTurn && state.turn) return <ActionPanel config={config} state={state} seat={seat} act={act} busy={busy} />;
  if (state.phase === "payout" && seat.hands.length) return <ResultPanel seat={seat} />;

  const turnName = state.turn ? state.seats[state.turn.seat]?.name : null;
  const text =
    seat.hands.length === 0
      ? state.phase === "waiting"
        ? "Esperando jugadores..."
        : "Entrarás en la próxima ronda"
      : state.phase === "dealer"
        ? "Juega el crupier..."
        : state.phase === "insurance"
          ? "Esperando decisiones de seguro..."
          : state.phase === "dealing"
            ? "Repartiendo cartas..."
            : turnName && state.turn?.seat !== mySeat
              ? `Turno de ${turnName}`
              : "Esperando...";
  return (
    <div className="pixel-box flex items-center gap-4 px-4 py-3">
      <MyHands seat={seat} activeHand={-1} />
      <p className="text-lg text-ink-dim">{text}</p>
    </div>
  );
}

function MyHands({ seat, activeHand }: { seat: Seat; activeHand: number }) {
  if (!seat.hands.length) return null;
  return (
    <div className="flex gap-4">
      {seat.hands.map((hand, i) => (
        <div key={i} className={`flex flex-col items-center gap-1 ${activeHand >= 0 && i !== activeHand ? "opacity-50" : ""}`}>
          <div className="flex">
            {hand.cards.map((c, k) => (
              <CardSprite key={c.n} code={c.c} scale={1.5} style={{ marginLeft: k ? -30 : 0 }} />
            ))}
          </div>
          <span className="font-display text-[0.5rem]">
            {totalLabel(hand)}
            {hand.doubled ? " ×2" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

type BetTarget = "main" | SideBetId;

function BetPanel({ config, seat, act, busy }: { config: TableConfig; seat: Seat; act: Act; busy: boolean }) {
  const chips = bettingChips(config.minBet, config.maxBet);
  const [target, setTarget] = useState<BetTarget>("main");
  const sideMax = maxSideBet(config.maxBet);
  const sideSum = SIDE_BET_IDS.reduce((sum, id) => sum + seat.side[id], 0);
  const lastSideSum = SIDE_BET_IDS.reduce((sum, id) => sum + seat.lastSide[id], 0);
  const pool = seat.stack + seat.bet + sideSum;
  const canDeal = seat.bet >= config.minBet && !seat.ready;
  const repeat = seat.lastBet > 0 && seat.lastBet + lastSideSum <= pool && (seat.lastBet !== seat.bet || lastSideSum !== sideSum);
  const double = seat.bet > 0 && seat.bet * 2 <= Math.min(config.maxBet, seat.stack + seat.bet);
  const current = target === "main" ? seat.bet : seat.side[target];
  const limit = target === "main" ? config.maxBet : sideMax;

  const addChip = (value: number) =>
    act(target === "main" ? { type: "bet", amount: value, mode: "add" } : { type: "side", bet: target, amount: value, mode: "add" });

  return (
    <div className="pixel-box flex flex-col items-center gap-3 px-4 py-3">
      {config.sideBets && (
        <div className="flex flex-wrap justify-center gap-1.5">
          <button
            onClick={() => setTarget("main")}
            className={`pixel-btn px-2 py-1.5 text-[0.5rem] ${target === "main" ? "btn-gold" : ""}`}
            title="Apuesta principal"
          >
            Principal {seat.bet > 0 && <span className="opacity-80">· {compact(seat.bet)}</span>}
          </button>
          {SIDE_BET_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setTarget(id)}
              title={`${SIDE_BETS[id].name}: ${SIDE_BETS[id].help} (hasta ${SIDE_BETS[id].top})`}
              className={`pixel-btn px-2 py-1.5 text-[0.5rem] ${target === id ? "text-[#120d22]" : ""}`}
              style={target === id ? { background: SIDE_BETS[id].color } : { boxShadow: `inset 0 -3px 0 0 ${SIDE_BETS[id].color}` }}
            >
              {SIDE_BETS[id].short} {seat.side[id] > 0 && <span>· {compact(seat.side[id])}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="text-ink-dim">
          {target === "main" ? "Tu apuesta" : `${SIDE_BETS[target].name} (paga hasta ${SIDE_BETS[target].top})`}
        </span>
        <ChipAmount amount={current} size={22} className="text-lg text-gold" />
        {sideSum > 0 && target === "main" && <span className="text-sm text-ink-dim">+ {fmt(sideSum)} laterales</span>}
        {seat.ready && <span className="font-display text-[0.5rem] text-green">¡LISTO!</span>}
      </div>
      {target !== "main" && <p className="-mt-1 text-xs text-ink-dim">{SIDE_BETS[target].help}. Máximo {fmt(sideMax)}.</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <button
            key={c.value}
            disabled={busy || seat.ready || current + c.value > limit || c.value > seat.stack}
            onClick={() => addChip(c.value)}
            className="group flex flex-col items-center gap-0.5 transition-transform hover:-translate-y-1 disabled:opacity-30"
            title={`Apostar ${fmt(c.value)}`}
          >
            <ChipIcon value={c.value} size={46} className="drop-shadow-[3px_3px_0_rgba(0,0,0,0.6)]" />
            <span className="font-display text-[0.45rem]">{compact(c.value)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="pixel-btn px-2 text-[0.5rem]"
          disabled={busy || (!seat.bet && !sideSum) || seat.ready}
          onClick={() => act({ type: "clearBet" })}
        >
          Limpiar
        </button>
        <button className="pixel-btn px-2 text-[0.5rem]" disabled={busy || !repeat || seat.ready} onClick={() => act({ type: "repeat" })}>
          Repetir
        </button>
        <button
          className="pixel-btn px-2 text-[0.5rem]"
          disabled={busy || !double || seat.ready}
          onClick={() => act({ type: "bet", amount: seat.bet * 2, mode: "set" })}
        >
          ×2
        </button>
        <button className="pixel-btn btn-gold px-4 text-[0.55rem]" disabled={busy || !canDeal} onClick={() => act({ type: "ready" })}>
          Repartir
        </button>
      </div>
    </div>
  );
}

function InsurancePanel({ seat, act, busy, blackjack }: { seat: Seat; act: Act; busy: boolean; blackjack: boolean }) {
  const cost = Math.floor(seat.hands[0].bet / 2);
  return (
    <div className="pixel-box flex flex-col items-center gap-3 px-5 py-3 text-center">
      <p className="text-lg">
        El crupier muestra un <span className="text-gold">As</span>.{" "}
        {blackjack ? "¿Cobras pago a la par (1:1)?" : `¿Tomas seguro por ${fmt(cost)}?`}
      </p>
      <p className="text-sm text-ink-dim">El seguro paga 2 a 1 si el crupier tiene blackjack.</p>
      <div className="flex gap-3">
        <button className="pixel-btn btn-green" disabled={busy || seat.stack < cost} onClick={() => act({ type: "insurance", take: true })}>
          Sí (Y)
        </button>
        <button className="pixel-btn btn-red" disabled={busy} onClick={() => act({ type: "insurance", take: false })}>
          No (N)
        </button>
      </div>
    </div>
  );
}

function ActionPanel({ config, state, seat, act, busy }: { config: TableConfig; state: TableState; seat: Seat; act: Act; busy: boolean }) {
  const handIdx = state.turn?.hand ?? 0;
  const hand = seat.hands[handIdx];
  const hints = useSettings((s) => s.hints);
  const allowed = allowedActions(config, seat, handIdx);
  const up = state.dealer.cards[0]?.c;
  const hint = hints && up && hand ? safeMove(basicStrategy(codes(hand.cards), up, allowed, config), allowed) : null;
  const buttons: { move: Move; key: string; cls: string }[] = [
    { move: "hit", key: "H", cls: "btn-green" },
    { move: "stand", key: "S", cls: "btn-red" },
    { move: "double", key: "D", cls: "btn-gold" },
    { move: "split", key: "P", cls: "btn-blue" },
    { move: "surrender", key: "R", cls: "" },
  ];
  return (
    <div className="pixel-box flex flex-wrap items-center justify-center gap-4 px-4 py-3">
      <MyHands seat={seat} activeHand={handIdx} />
      <div className="flex min-w-24 flex-col gap-1 text-sm">
        {seat.hands.length > 1 && (
          <span className="text-ink-dim">
            Mano {handIdx + 1} de {seat.hands.length}
          </span>
        )}
        {hand && <span>Total: {totalLabel(hand)}</span>}
        {hint && (
          <span className="text-gold">
            Consejo: <b>{MOVE_LABELS[hint]}</b>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {buttons.map((b) => (
          <button
            key={b.move}
            className={`pixel-btn px-2.5 text-[0.55rem] ${b.cls} ${hint === b.move ? "outline-3 outline-offset-4 outline-gold" : ""}`}
            disabled={busy || !allowed[b.move]}
            onClick={() => act({ type: b.move })}
            title={`Atajo: ${b.key}`}
          >
            {MOVE_LABELS[b.move]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultPanel({ seat }: { seat: Seat }) {
  return (
    <div className="pixel-box flex items-center gap-5 px-4 py-3">
      <MyHands seat={seat} activeHand={-1} />
      <div className="flex flex-col gap-1">
        {seat.hands.map((h, i) => (
          <span key={i} className="font-display text-[0.5rem]">
            {seat.hands.length > 1 ? `Mano ${i + 1}: ` : ""}
            {h.result ? RESULT_TEXT[h.result] : ""}
          </span>
        ))}
        {SIDE_BET_IDS.filter((id) => seat.sideResults[id]).map((id) => {
          const r = seat.sideResults[id]!;
          return (
            <span key={id} className="text-sm" style={{ color: SIDE_BETS[id].color }}>
              {SIDE_BETS[id].name}: {r.payout > 0 ? `${SIDE_KIND_LABELS[r.kind as SideKind]} +${fmt(r.payout - seat.side[id])}` : "perdida"}
            </span>
          );
        })}
        <span className={`font-display text-xs ${seat.net > 0 ? "text-green" : seat.net < 0 ? "text-red" : "text-ink"}`}>
          {signed(seat.net)}
        </span>
      </div>
    </div>
  );
}

function ResultBanner({ state, seat, timeline }: { state: TableState; seat?: Seat; timeline: DealTimeline }) {
  // The banner belongs to one round; it is shown only while that round pays out.
  const [shownRound, setShownRound] = useState<number | null>(null);
  const payout = state.phase === "payout" && !!seat?.hands.length;
  useEffect(() => {
    if (!payout) return;
    const round = state.round;
    const wait = Math.max(0, timeline.settledAt() - performance.now()) + 400;
    const on = setTimeout(() => setShownRound(round), wait);
    const off = setTimeout(() => setShownRound((r) => (r === round ? null : r)), wait + 3000);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [payout, state.round, timeline]);
  if (!payout || shownRound !== state.round || !seat) return null;
  const bj = seat.hands.some((h) => h.result === "blackjack");
  const text = bj ? "¡BLACKJACK!" : seat.net > 0 ? "¡GANASTE!" : seat.net === 0 ? "EMPATE" : seat.hands.every((h) => h.result === "bust") ? "TE PASASTE" : "PIERDES";
  const color = bj ? "gold-shimmer" : seat.net > 0 ? "text-green" : seat.net === 0 ? "text-blue" : "text-red";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] flex flex-col items-center gap-3">
      <p className={`animate-pop-in font-display text-3xl sm:text-5xl text-shadow-pixel ${color}`}>{text}</p>
      {seat.net !== 0 && (
        <p className={`animate-float-up font-display text-lg text-shadow-pixel ${seat.net > 0 ? "text-gold" : "text-red"}`}>
          {signed(seat.net)}
        </p>
      )}
    </div>
  );
}

function EmoteBar({ onEmote }: { onEmote: (e: string) => void }) {
  const [cooldown, setCooldown] = useState(false);
  return (
    <div className="pixel-box grid grid-cols-4 gap-1 p-2">
      {EMOTES.map((e) => (
        <button
          key={e}
          disabled={cooldown}
          className="h-8 w-8 text-lg transition-transform hover:scale-125 disabled:opacity-40"
          onClick={() => {
            onEmote(e);
            setCooldown(true);
            setTimeout(() => setCooldown(false), 2500);
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function SettingsPanel({ onClose, seated }: { onClose: () => void; seated: boolean }) {
  const s = useSettings();
  const toggles: { key: "sfx" | "music" | "ambience" | "voice" | "hints"; label: string }[] = [
    { key: "sfx", label: "Efectos" },
    { key: "music", label: "Música" },
    { key: "ambience", label: "Ambiente" },
    { key: "voice", label: "Voz del crupier" },
    { key: "hints", label: "Consejos de estrategia" },
  ];
  return (
    <div className="pointer-events-auto absolute right-3 top-16 z-30 w-72">
      <div className="pixel-box flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="font-display text-[0.6rem] text-gold">AJUSTES</span>
          <button className="pixel-btn btn-ghost px-2 py-1 text-[0.5rem]" onClick={onClose}>
            X
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-dim">Volumen</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            onChange={(e) => s.set({ volume: Number(e.target.value) })}
            className="accent-[#f6c544]"
          />
        </label>
        {toggles.map((t) => (
          <button key={t.key} className="flex items-center justify-between" onClick={() => s.set({ [t.key]: !s[t.key] })}>
            <span>{t.label}</span>
            <span className={`pixel-inset px-2 py-0.5 font-display text-[0.5rem] ${s[t.key] ? "text-green" : "text-ink-dim"}`}>
              {s[t.key] ? "SÍ" : "NO"}
            </span>
          </button>
        ))}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-ink-dim">Tamaño de píxel</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((p) => (
              <button key={p} className={`pixel-btn flex-1 px-1 text-[0.5rem] ${s.pixelSize === p ? "btn-gold" : ""}`} onClick={() => s.set({ pixelSize: p })}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {seated && <p className="text-xs text-ink-dim">Atajos: H pedir · S plantarse · D doblar · P dividir · R rendirse · Enter repartir</p>}
        <p className="text-xs text-ink-dim">Clic derecho sostenido + arrastrar: vista libre de la mesa.</p>
      </div>
    </div>
  );
}

function RebuyModal({ tableId, config, chips, onClose }: { tableId: string; config: TableConfig; chips: number; onClose: () => void }) {
  const max = Math.max(0, chips);
  const [amount, setAmount] = useState(Math.min(max, config.minBet * 20));
  const [busy, setBusy] = useState(false);
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div className="pixel-box w-full max-w-sm p-5" onMouseDown={(e) => e.stopPropagation()}>
        <p className="mb-3 font-display text-[0.6rem] text-gold">RECARGAR FICHAS</p>
        {max < config.minBet ? (
          <p className="text-ink-dim">No tienes saldo suficiente. Reclama tu bono diario en el lobby.</p>
        ) : (
          <>
            <ChipAmount amount={amount} size={24} className="text-xl text-gold" />
            <input
              type="range"
              min={config.minBet}
              max={max}
              step={config.minBet}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="my-4 w-full accent-[#f6c544]"
            />
            <button
              className="pixel-btn btn-gold w-full"
              disabled={busy || amount < 1}
              onClick={async () => {
                setBusy(true);
                try {
                  await tableAction(tableId, { type: "rebuy", amount });
                  sound.play("chips-stack");
                  onClose();
                } catch (err) {
                  toast.error(errorText(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Recargar {fmt(amount)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

