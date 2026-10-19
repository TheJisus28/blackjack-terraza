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
import { COMPACT_QUERY, NO_INSETS, SHORT_QUERY, TOUCH_QUERY, useMedia, useViewInsets } from "@/lib/viewport";
import type { ChatMessage } from "@/hooks/useTable";
import { ChatPanel } from "./ChatPanel";
import type { DealTimeline } from "./timeline";

type Act = (action: Record<string, unknown>) => Promise<void>;

const EMOTES = ["👍", "🎉", "😂", "😮", "😡", "🍀", "👋", "😢"];
const CAMERAS: { id: CameraMode; label: string; short: string }[] = [
  { id: "table", label: "Mesa", short: "Mesa" },
  { id: "player", label: "Mi asiento", short: "Asiento" },
  { id: "top", label: "Cenital", short: "Cenital" },
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
  canSit,
  onSit,
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
  canSit: boolean;
  onSit: (seat: number) => void;
}) {
  const seat = mySeat !== null ? state.seats[mySeat] : undefined;
  const seated = !!seat;
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const small = useMedia(COMPACT_QUERY);
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

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

  // On compact layouts, tell the camera which part of the screen the HUD covers.
  useEffect(() => {
    const setInsets = useViewInsets.getState().set;
    if (!small) {
      setInsets(NO_INSETS);
      return;
    }
    // The dock grows and shrinks with each phase; framing for its tallest state
    // keeps the camera still during a round.
    let tallest = 0;
    const measure = () => {
      const root = rootRef.current?.getBoundingClientRect();
      const dock = dockRef.current?.getBoundingClientRect();
      if (!root || !dock) return;
      const top = Math.max(0, (topRef.current?.getBoundingClientRect().bottom ?? root.top) - root.top);
      if (dock.left - root.left > root.width * 0.3) {
        // Sideways phone: the dock is a column on the right.
        setInsets({ top, right: root.right - dock.left, bottom: 0, left: 0 });
      } else {
        tallest = Math.max(tallest, root.bottom - dock.top);
        setInsets({ top, right: 0, bottom: tallest, left: 0 });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const el of [rootRef.current, topRef.current, dockRef.current]) if (el) observer.observe(el);
    const onResize = () => {
      tallest = 0;
      measure();
    };
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      setInsets(NO_INSETS);
    };
  }, [small, seated]);

  return (
    // Its own layer above the scene's name tags (drei <Html>), so panels are never covered by them.
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[60] flex flex-col">
      <HudTop
        ref={topRef}
        config={config}
        state={state}
        seated={seated}
        onToggleChat={() => setChatOpen((v) => !v)}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
      />

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} seated={seated} />}

      <FreeCamBadge />

      <div className="flex-1" />

      <ResultBanner state={state} seat={seat} timeline={timeline} />

      <div
        ref={dockRef}
        className="pointer-events-none flex flex-col items-center gap-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] desk:gap-3 desk:px-3 desk:pb-3 short:absolute short:bottom-0 short:right-0 short:top-[calc(3.5rem+env(safe-area-inset-top))] short:w-[min(24rem,48vw)] short:overflow-y-auto short:pr-[max(0.5rem,env(safe-area-inset-right))]"
      >
        {/* Sideways the dock is a column: this pushes its content to the bottom. */}
        <div aria-hidden className="hidden short:block short:flex-1" />
        <PhaseTimer state={state} serverNow={serverNow} mine={myTurn || (state.phase === "betting" && !!seat && !seat.ready)} />
        <div className="pointer-events-none relative flex w-full flex-col items-center gap-2 desk:block desk:min-h-[7rem]">
          {seat && (
            <div className="pointer-events-auto flex w-full items-stretch justify-between gap-2 desk:absolute desk:bottom-0 desk:left-0 desk:right-0 desk:items-end desk:gap-3">
              <SeatBox
                seat={seat}
                config={config}
                profile={profile}
                busy={busy}
                small={small}
                onLeave={() =>
                  act({ type: "leave" }).then(() =>
                    toast.info(seat.hands.length ? "Saldrás al terminar la mano" : "Te levantaste de la mesa"),
                  )
                }
                onRebuy={() => setRebuyOpen(true)}
              />
              <EmoteBar onEmote={onEmote} />
            </div>
          )}
          <div className="pointer-events-auto relative z-10 flex w-full justify-center desk:mx-auto desk:w-fit">
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
              small={small}
              canSit={canSit}
              onSit={onSit}
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
  const touch = useMedia(TOUCH_QUERY);
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(id);
  }, []);
  const place =
    "pointer-events-none absolute left-1/2 top-[calc(4rem+env(safe-area-inset-top))] w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 desk:top-16 short:left-[calc((100%-min(24rem,48vw))/2)] short:max-w-[calc(100vw-min(24rem,48vw)-1rem)]";
  if (active) {
    return (
      <div className={place}>
        <div className="pixel-box animate-pop-in px-3 py-1.5 text-center font-display text-[0.5rem] text-gold">VISTA LIBRE · SUELTA PARA VOLVER</div>
      </div>
    );
  }
  if (!hint) return null;
  return (
    <div className={place}>
      <div className="pixel-box px-3 py-1.5 text-center text-xs text-ink-dim desk:text-sm">
        {touch
          ? "Arrastra un dedo sobre la mesa para mirarla libremente · pellizca para acercar"
          : "Mantén el clic derecho y arrastra para mirar la mesa libremente · rueda para acercar"}
      </div>
    </div>
  );
}

function HudTop({
  ref,
  config,
  state,
  seated,
  onToggleChat,
  onToggleSettings,
}: {
  ref?: React.Ref<HTMLDivElement>;
  config: TableConfig;
  state: TableState;
  seated: boolean;
  onToggleChat: () => void;
  onToggleSettings: () => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const camera = useSettings((s) => s.camera);
  const setSettings = useSettings((s) => s.set);
  const shoePct = state.shoe.total ? Math.round((state.shoe.remaining / state.shoe.total) * 100) : 100;
  // Compact layouts cycle the views with one button ("Mi asiento" needs a seat).
  const views = CAMERAS.filter((c) => seated || c.id !== "player");
  const current = CAMERAS.find((c) => c.id === camera) ?? CAMERAS[0];
  const nextView = () => {
    const i = views.findIndex((c) => c.id === camera);
    setSettings({ camera: views[(i + 1) % views.length].id });
  };
  return (
    <div
      ref={ref}
      className="pointer-events-auto flex items-start justify-between gap-2 pb-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] desk:flex-wrap desk:gap-3 desk:p-3"
    >
      <div className="flex min-w-0 items-start gap-2 desk:gap-3">
        <Link href="/lobby" className="pixel-btn shrink-0 px-3 text-[0.55rem]" aria-label="Volver a las mesas">
          ←<span className="compact:hidden"> Mesas</span>
        </Link>
        <div className="relative min-w-0">
          <button
            className="pixel-box block min-w-0 max-w-full px-3 py-1.5 text-left"
            onClick={() => setRulesOpen((v) => !v)}
            aria-expanded={rulesOpen}
          >
            <p className="truncate font-display text-[0.5rem] text-gold desk:text-[0.6rem]">{config.name}</p>
            <p className="truncate text-xs text-ink-dim desk:text-sm">
              <span className="compact:hidden">Apuesta </span>
              {fmt(config.minBet)} – {fmt(config.maxBet)} · Ronda {state.round}
            </p>
          </button>
          {rulesOpen && (
            <ul className="pixel-box absolute left-0 top-full z-30 mt-3 flex w-64 max-w-[calc(100vw-1rem)] flex-col gap-0.5 px-3 py-2 text-sm">
              {describeRules(config).map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 desk:gap-2">
        <div className="pixel-inset hidden items-center gap-2 px-2 py-1.5 desk:flex" title="Cartas restantes en el zapato">
          <span className="text-xs text-ink-dim">Zapato</span>
          <div className="h-2 w-16 bg-black/50">
            <div className="h-full bg-blue" style={{ width: `${shoePct}%` }} />
          </div>
        </div>
        <div className="hidden desk:flex">
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
        <button className="pixel-btn px-2.5 text-[0.5rem] desk:hidden" onClick={nextView} aria-label={`Vista: ${current.label}. Cambiar vista`}>
          <span aria-hidden className="text-sm leading-none">
            🎥
          </span>{" "}
          {current.short}
        </button>
        <button className="pixel-btn px-3 text-[0.55rem]" onClick={onToggleSettings} aria-label="Ajustes">
          ♪
        </button>
        <button className="pixel-btn px-3 text-[0.55rem]" onClick={onToggleChat} aria-label="Chat">
          <span aria-hidden className="text-base leading-none desk:hidden">
            💬
          </span>
          <span className="compact:hidden">Chat</span>
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
    <div className="pixel-box flex w-full max-w-md items-center gap-2 px-3 py-1 desk:gap-3 desk:py-1.5">
      <span className="truncate font-display text-[0.5rem] text-gold desk:text-[0.55rem]">{PHASES[state.phase]}</span>
      <div className="h-2 min-w-12 flex-1 bg-black/50">
        <div ref={bar} className={`h-full ${mine ? "bg-red" : "bg-gold"}`} />
      </div>
      <span ref={label} className="w-8 shrink-0 text-right font-display text-[0.5rem] desk:text-[0.55rem]" />
    </div>
  );
}

function SeatBox({
  seat,
  config,
  profile,
  busy,
  small,
  onLeave,
  onRebuy,
}: {
  seat: Seat;
  config: TableConfig;
  profile: UserRecord | null;
  busy: boolean;
  small: boolean;
  onLeave: () => void;
  onRebuy: () => void;
}) {
  const low = seat.stack + seat.bet < config.minBet && seat.hands.length === 0;
  const short = useMedia(SHORT_QUERY);
  return (
    <div className="pixel-box flex min-w-0 items-center gap-2 px-2 py-1.5 compact:flex-1 desk:gap-3 desk:px-3 desk:py-2">
      <Portrait id={seat.avatar.id} size={short ? 28 : small ? 34 : 44} ring="#f6c544" />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm desk:text-base">{seat.name}</span>
        <span className="flex items-center gap-1 text-sm text-gold">
          <ChipIcon value={100} size={small ? 14 : 16} /> {fmt(seat.stack)}
        </span>
        {profile && <span className="truncate text-xs text-ink-dim short:hidden">Saldo: {compact(profile.chips)}</span>}
      </div>
      <div className="flex shrink-0 gap-1.5 desk:flex-col">
        <button
          className={`pixel-btn px-2 py-1 text-[0.45rem] pointer-coarse:min-h-9 ${low ? "btn-gold animate-pulse" : ""}`}
          onClick={onRebuy}
          disabled={busy || seat.hands.length > 0}
        >
          Recargar
        </button>
        <button
          className="pixel-btn btn-red px-2 py-1 text-[0.45rem] pointer-coarse:min-h-9"
          onClick={onLeave}
          disabled={busy || seat.leaving}
        >
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
  small,
  canSit,
  onSit,
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
  small: boolean;
  canSit: boolean;
  onSit: (seat: number) => void;
}) {
  if (!seat) {
    const free = Array.from({ length: config.seats }, (_, i) => i).filter(
      (i) => !state.seats[i] || (state.seats[i].bot && state.seats[i].hands.length === 0),
    );
    // One tap to play: the free seat closest to the middle of the table.
    const middle = (config.seats - 1) / 2;
    const best = [...free].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0];
    return (
      <div className="pixel-box flex w-full flex-col items-center gap-3 px-4 py-3 text-center desk:w-auto desk:px-5">
        {seatedElsewhere ? (
          <p>
            Ya estás sentado en otra mesa.{" "}
            <Link href="/lobby" className="text-gold underline">
              Ve al lobby
            </Link>
          </p>
        ) : free.length ? (
          <>
            <p className="text-base desk:text-lg">
              Toca{" "}
              <span className="text-gold">
                <span className="compact:hidden">Sentarse</span>
                <span className="hidden compact:inline">+</span>
              </span>{" "}
              en un asiento libre para jugar
            </p>
            {canSit && best !== undefined && (
              <button className="pixel-btn btn-gold w-full pointer-coarse:min-h-11 desk:w-auto" onClick={() => onSit(best)}>
                Sentarme
              </button>
            )}
          </>
        ) : (
          <p className="text-base desk:text-lg">Mesa llena: estás mirando la partida</p>
        )}
      </div>
    );
  }

  if (state.phase === "betting") return <BetPanel config={config} seat={seat} act={act} busy={busy} small={small} />;
  if (needsInsurance) return <InsurancePanel seat={seat} act={act} busy={busy} blackjack={isNatural(seat.hands[0])} />;
  if (myTurn && state.turn) return <ActionPanel config={config} state={state} seat={seat} act={act} busy={busy} small={small} />;
  if (state.phase === "payout" && seat.hands.length) return <ResultPanel seat={seat} small={small} />;

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
    <div className="pixel-box flex w-full items-center justify-center gap-4 px-4 py-3 desk:w-auto">
      <MyHands seat={seat} activeHand={-1} small={small} />
      <p className="text-base text-ink-dim desk:text-lg">{text}</p>
    </div>
  );
}

function MyHands({ seat, activeHand, small }: { seat: Seat; activeHand: number; small: boolean }) {
  if (!seat.hands.length) return null;
  return (
    <div className="flex gap-3 desk:gap-4">
      {seat.hands.map((hand, i) => (
        <div key={i} className={`flex flex-col items-center gap-1 ${activeHand >= 0 && i !== activeHand ? "opacity-50" : ""}`}>
          <div className="flex">
            {hand.cards.map((c, k) => (
              <CardSprite key={c.n} code={c.c} scale={small ? 1.15 : 1.5} style={{ marginLeft: k ? (small ? -24 : -30) : 0 }} />
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

function BetPanel({ config, seat, act, busy, small }: { config: TableConfig; seat: Seat; act: Act; busy: boolean; small: boolean }) {
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

  // Sideways phones have ~330px of height for the whole dock: smaller chips, no summary line.
  const short = useMedia(SHORT_QUERY);
  const addChip = (value: number) =>
    act(target === "main" ? { type: "bet", amount: value, mode: "add" } : { type: "side", bet: target, amount: value, mode: "add" });

  return (
    <div className="pixel-box flex w-full flex-col items-center gap-2.5 px-3 py-2.5 desk:w-auto desk:gap-3 desk:px-4 desk:py-3 short:gap-2 short:py-2">
      {config.sideBets && (
        <div className="flex flex-wrap justify-center gap-1.5">
          <button
            onClick={() => setTarget("main")}
            className={`pixel-btn px-2 py-1.5 text-[0.5rem] pointer-coarse:min-h-9 short:px-1.5 short:text-[0.45rem] ${target === "main" ? "btn-gold" : ""}`}
            title="Apuesta principal"
          >
            Principal {seat.bet > 0 && <span className="opacity-80">· {compact(seat.bet)}</span>}
          </button>
          {SIDE_BET_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setTarget(id)}
              title={`${SIDE_BETS[id].name}: ${SIDE_BETS[id].help} (hasta ${SIDE_BETS[id].top})`}
              className={`pixel-btn px-2 py-1.5 text-[0.5rem] pointer-coarse:min-h-9 short:px-1.5 short:text-[0.45rem] ${target === id ? "text-[#120d22]" : ""}`}
              style={target === id ? { background: SIDE_BETS[id].color } : { boxShadow: `inset 0 -3px 0 0 ${SIDE_BETS[id].color}` }}
            >
              {SIDE_BETS[id].short} {seat.side[id] > 0 && <span>· {compact(seat.side[id])}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 short:hidden">
        <span className="text-center text-ink-dim">
          {target === "main" ? "Tu apuesta" : `${SIDE_BETS[target].name} (paga hasta ${SIDE_BETS[target].top})`}
        </span>
        <ChipAmount amount={current} size={small ? 20 : 22} className="text-lg text-gold" />
        {sideSum > 0 && target === "main" && <span className="text-sm text-ink-dim">+ {fmt(sideSum)} laterales</span>}
        {seat.ready && <span className="font-display text-[0.5rem] text-green">¡LISTO!</span>}
      </div>
      {target !== "main" && (
        <p className="-mt-1 text-center text-xs text-ink-dim short:hidden">
          {SIDE_BETS[target].help}. Máximo {fmt(sideMax)}.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <button
            key={c.value}
            disabled={busy || seat.ready || current + c.value > limit || c.value > seat.stack}
            onClick={() => addChip(c.value)}
            className="group flex flex-col items-center gap-0.5 transition-transform hover:-translate-y-1 disabled:opacity-30"
            title={`Apostar ${fmt(c.value)}`}
          >
            <ChipIcon value={c.value} size={short ? 34 : small ? 42 : 46} className="drop-shadow-[3px_3px_0_rgba(0,0,0,0.6)]" />
            <span className="font-display text-[0.45rem]">{compact(c.value)}</span>
          </button>
        ))}
      </div>
      <div className="flex w-full gap-2 desk:w-auto desk:flex-wrap desk:justify-center">
        <button
          className="pixel-btn flex-1 px-2 text-[0.5rem] pointer-coarse:min-h-10 desk:flex-none"
          disabled={busy || (!seat.bet && !sideSum) || seat.ready}
          onClick={() => act({ type: "clearBet" })}
        >
          Limpiar
        </button>
        <button
          className="pixel-btn flex-1 px-2 text-[0.5rem] pointer-coarse:min-h-10 desk:flex-none"
          disabled={busy || !repeat || seat.ready}
          onClick={() => act({ type: "repeat" })}
        >
          Repetir
        </button>
        <button
          className="pixel-btn flex-1 px-2 text-[0.5rem] pointer-coarse:min-h-10 desk:flex-none"
          disabled={busy || !double || seat.ready}
          onClick={() => act({ type: "bet", amount: seat.bet * 2, mode: "set" })}
        >
          ×2
        </button>
        <button
          className="pixel-btn btn-gold flex-[1.5] px-4 text-[0.55rem] pointer-coarse:min-h-10 desk:flex-none"
          disabled={busy || !canDeal}
          onClick={() => act({ type: "ready" })}
        >
          Repartir
        </button>
      </div>
    </div>
  );
}

function InsurancePanel({ seat, act, busy, blackjack }: { seat: Seat; act: Act; busy: boolean; blackjack: boolean }) {
  const cost = Math.floor(seat.hands[0].bet / 2);
  return (
    <div className="pixel-box flex w-full flex-col items-center gap-3 px-4 py-3 text-center desk:w-auto desk:px-5">
      <p className="text-base desk:text-lg">
        El crupier muestra un <span className="text-gold">As</span>.{" "}
        {blackjack ? "¿Cobras pago a la par (1:1)?" : `¿Tomas seguro por ${fmt(cost)}?`}
      </p>
      <p className="text-sm text-ink-dim">El seguro paga 2 a 1 si el crupier tiene blackjack.</p>
      <div className="flex w-full gap-3 desk:w-auto">
        <button
          className="pixel-btn btn-green flex-1 pointer-coarse:min-h-11 desk:flex-none"
          disabled={busy || seat.stack < cost}
          onClick={() => act({ type: "insurance", take: true })}
        >
          Sí<span className="pointer-coarse:hidden"> (Y)</span>
        </button>
        <button
          className="pixel-btn btn-red flex-1 pointer-coarse:min-h-11 desk:flex-none"
          disabled={busy}
          onClick={() => act({ type: "insurance", take: false })}
        >
          No<span className="pointer-coarse:hidden"> (N)</span>
        </button>
      </div>
    </div>
  );
}

function ActionPanel({
  config,
  state,
  seat,
  act,
  busy,
  small,
}: {
  config: TableConfig;
  state: TableState;
  seat: Seat;
  act: Act;
  busy: boolean;
  small: boolean;
}) {
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
    <div className="pixel-box flex w-full flex-col items-center gap-2.5 px-3 py-2.5 desk:w-auto desk:flex-row desk:flex-wrap desk:justify-center desk:gap-4 desk:px-4 desk:py-3">
      <div className="flex items-center gap-3 desk:contents">
        <MyHands seat={seat} activeHand={handIdx} small={small} />
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
      </div>
      {/* Phones: Pedir and Plantarse get the big first row. */}
      <div className="grid w-full grid-cols-6 gap-2 desk:w-auto desk:grid-cols-3">
        {buttons.map((b) => (
          <button
            key={b.move}
            className={`pixel-btn px-2.5 text-[0.55rem] pointer-coarse:min-h-11 desk:col-span-1 ${b.move === "hit" || b.move === "stand" ? "col-span-3" : "col-span-2"} ${b.cls} ${hint === b.move ? "outline-3 outline-offset-4 outline-gold" : ""}`}
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

function ResultPanel({ seat, small }: { seat: Seat; small: boolean }) {
  return (
    <div className="pixel-box flex w-full items-center justify-center gap-5 px-4 py-3 desk:w-auto">
      <MyHands seat={seat} activeHand={-1} small={small} />
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
    <div className="pointer-events-none absolute inset-x-0 top-[24%] flex flex-col items-center gap-3 desk:top-[30%] short:right-[min(24rem,48vw)] short:top-[32%]">
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
  // Compact layouts keep the emotes behind a button; desktop shows them all.
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex shrink-0">
      <button
        className="pixel-btn px-3 text-lg desk:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label="Emotes"
        aria-expanded={open}
      >
        😀
      </button>
      <div
        className={`pixel-box grid grid-cols-4 gap-1 p-2 compact:absolute compact:bottom-full compact:right-0 compact:z-20 compact:mb-3 ${open ? "" : "compact:hidden"}`}
      >
        {EMOTES.map((e) => (
          <button
            key={e}
            disabled={cooldown}
            className="h-8 w-8 text-lg transition-transform hover:scale-125 disabled:opacity-40 pointer-coarse:h-10 pointer-coarse:w-10 pointer-coarse:text-xl"
            onClick={() => {
              onEmote(e);
              setOpen(false);
              setCooldown(true);
              setTimeout(() => setCooldown(false), 2500);
            }}
          >
            {e}
          </button>
        ))}
      </div>
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
    <div className="pointer-events-auto absolute right-[max(0.5rem,env(safe-area-inset-right))] top-[calc(3.5rem+env(safe-area-inset-top))] z-30 w-[min(18rem,calc(100vw-1rem))] desk:right-3 desk:top-16 desk:w-72">
      <div className="pixel-box flex max-h-[calc(100dvh-5rem)] flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <span className="font-display text-[0.6rem] text-gold">AJUSTES</span>
          <button className="pixel-btn btn-ghost px-2 py-1 text-[0.5rem]" onClick={onClose} aria-label="Cerrar ajustes">
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
          <button key={t.key} className="flex items-center justify-between pointer-coarse:min-h-9" onClick={() => s.set({ [t.key]: !s[t.key] })}>
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
        {seated && (
          <p className="text-xs text-ink-dim pointer-coarse:hidden">
            Atajos: H pedir · S plantarse · D doblar · P dividir · R rendirse · Enter repartir
          </p>
        )}
        <p className="text-xs text-ink-dim">
          <span className="pointer-coarse:hidden">Clic derecho sostenido + arrastrar: vista libre de la mesa.</span>
          <span className="hidden pointer-coarse:inline">Arrastra un dedo sobre la mesa para la vista libre; pellizca para acercar.</span>
        </p>
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
