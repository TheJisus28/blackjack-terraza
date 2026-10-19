"use client";

import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { handValue, totalLabel } from "@/lib/game/cards";
import { SIDE_BETS, SIDE_BET_IDS, SIDE_KIND_LABELS, type SideBetId, type SideKind } from "@/lib/game/sidebets";
import type { Hand, Seat, SideResult, TableConfig, TableState } from "@/lib/game/types";
import assets from "@/lib/generated/assets.json";
import { compact, signed } from "@/lib/format";
import { handShowAt, sideRevealAt, type DealTimeline } from "@/components/table/timeline";
import { Avatar, type Mood, type Reaction } from "./Avatar";
import { ChipStack, PlayerChips } from "./Chips";
import {
  INSURANCE_R,
  SEAT_R,
  STOOL_TOP,
  TABLE_Y,
  TRAY_POS,
  betPosition,
  facingCenter,
  playerCardPosition,
  playerRight,
  polar,
  seatAngle,
  sideSpotPosition,
  stackPosition,
  type ViewBasis,
} from "./layout";

export interface SeatEmote {
  e: string;
  ts: number;
}

const EMOTE_CLIPS: Record<string, string> = {
  "👍": "yes",
  "🎉": "cheer",
  "😂": "cheer",
  "😮": "flinch",
  "😡": "no",
  "🍀": "drink",
  "👋": "use_item",
  "😢": "no",
};

const RESULT_RANK = { blackjack: 5, win: 4, push: 3, surrender: 2, lose: 1, bust: 0 } as const;

function bestResult(hands: Hand[]) {
  let best: Hand["result"] = null;
  for (const h of hands) {
    if (!h.result) continue;
    if (!best || RESULT_RANK[h.result] > RESULT_RANK[best]) best = h.result;
  }
  return best;
}

function Stool({ position, rotation }: { position: THREE.Vector3; rotation: number }) {
  const { scene } = useGLTF(assets.props.chair_stool.file);
  const object = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  }, [scene]);
  return <primitive object={object} position={position} rotation={[0, rotation, 0]} scale={[0.6, STOOL_TOP / 0.5, 0.6]} />;
}

/** Moves a chip group along an arc between `start` and `start + dur` (ms on the t clock). Returns progress. */
function fly(g: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, t: number, start: number, dur = 480) {
  const p = Math.min(1, Math.max(0, (t - start) / dur));
  const e = 1 - (1 - p) ** 3;
  g.position.lerpVectors(from, to, e);
  g.position.y += Math.sin(p * Math.PI) * 0.16;
  return p;
}

/** One side bet on the felt: paid from the tray or collected once revealed. */
function SideStack({
  id,
  amount,
  result,
  spot,
  home,
  revealAt,
}: {
  id: SideBetId;
  amount: number;
  result: SideResult | null;
  spot: THREE.Vector3;
  home: THREE.Vector3;
  revealAt: number | null;
}) {
  const stakeRef = useRef<THREE.Group>(null);
  const winRef = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const winnings = result && result.payout > 0 ? result.payout - amount : 0;
  const multiplier = winnings > 0 ? Math.round(winnings / amount) : 0;

  useFrame(() => {
    const g = stakeRef.current;
    if (!g) return;
    if (revealAt === null || !result) {
      g.position.copy(spot);
      g.visible = true;
      if (winRef.current) winRef.current.visible = false;
      if (label.current) label.current.style.opacity = "0";
      return;
    }
    const t = performance.now() - revealAt;
    if (label.current) label.current.style.opacity = winnings > 0 && t > 0 && t < 3400 ? "1" : "0";
    if (winnings > 0) {
      const w = winRef.current;
      if (w) {
        w.visible = t > 0;
        if (t < 1500) fly(w, TRAY_POS, spot, t, 0);
        else w.visible = fly(w, spot, home, t, 1500) < 1;
      }
      if (t < 1500) g.position.copy(spot);
      else g.visible = fly(g, spot, home, t, 1500) < 1;
    } else if (t < 250) {
      g.position.copy(spot);
    } else {
      g.visible = fly(g, spot, TRAY_POS, t, 250) < 1;
    }
  });

  return (
    <>
      <group ref={stakeRef} position={spot}>
        <ChipStack amount={amount} maxChips={12} />
      </group>
      {winnings > 0 && (
        <>
          <group ref={winRef} position={TRAY_POS} visible={false}>
            <ChipStack amount={winnings} maxChips={16} />
          </group>
          <Html position={[spot.x, spot.y + 0.22, spot.z]} center zIndexRange={[35, 15]}>
            <div
              ref={label}
              style={{ opacity: 0, transition: "opacity 150ms steps(3)", background: SIDE_BETS[id].color }}
              className="pointer-events-none whitespace-nowrap px-1.5 py-0.5 font-display text-[0.45rem] text-[#120d22] shadow-[2px_2px_0_#000]"
            >
              {SIDE_BETS[id].short} · {result ? SIDE_KIND_LABELS[result.kind as SideKind] : ""} {multiplier}:1
            </div>
          </Html>
        </>
      )}
    </>
  );
}

/** Chips on a hand; animates the payout during the payout phase. */
function HandChips({
  hand,
  angle,
  h,
  n,
  payoutAt,
}: {
  hand: Hand;
  angle: number;
  h: number;
  n: number;
  payoutAt: number | null;
}) {
  const spot = useMemo(() => betPosition(angle, h, n), [angle, h, n]);
  const right = useMemo(() => playerRight(angle), [angle]);
  const home = useMemo(() => stackPosition(angle), [angle]);
  const betRef = useRef<THREE.Group>(null);
  const winRef = useRef<THREE.Group>(null);
  const stake = hand.doubled ? hand.bet / 2 : hand.bet;
  const winnings = hand.result === "win" || hand.result === "blackjack" ? hand.payout - hand.bet : 0;
  const winSpot = useMemo(() => spot.clone().addScaledVector(right, -0.13), [spot, right]);

  useFrame(() => {
    const bet = betRef.current;
    const win = winRef.current;
    if (!bet) return;
    if (payoutAt === null || !hand.result) {
      bet.position.copy(spot);
      bet.visible = true;
      if (win) win.visible = false;
      return;
    }
    const t = performance.now() - payoutAt;
    switch (hand.result) {
      case "win":
      case "blackjack": {
        if (win) {
          win.visible = t > 0;
          if (t < 1400) fly(win, TRAY_POS, winSpot, t, 0);
          else win.visible = fly(win, winSpot, home, t, 1400) < 1;
        }
        if (t < 1400) bet.position.copy(spot);
        else bet.visible = fly(bet, spot, home, t, 1400) < 1;
        break;
      }
      case "push":
        if (t < 1000) bet.position.copy(spot);
        else bet.visible = fly(bet, spot, home, t, 1000) < 1;
        break;
      case "surrender":
      case "lose":
      case "bust":
        if (t < 350) bet.position.copy(spot);
        else bet.visible = fly(bet, spot, TRAY_POS, t, 350) < 1;
        break;
    }
  });

  return (
    <>
      <group ref={betRef} position={spot}>
        <ChipStack amount={hand.result === "surrender" ? Math.ceil(stake / 2) : stake} />
        {hand.doubled && (
          <group position={right.clone().multiplyScalar(0.12)}>
            <ChipStack amount={stake} />
          </group>
        )}
      </group>
      {winnings > 0 && (
        <group ref={winRef} position={TRAY_POS} visible={false}>
          <ChipStack amount={winnings} />
        </group>
      )}
    </>
  );
}

/** Rendered inside <Html> (a separate React root): no R3F hooks in here. */
function Nameplate({
  seat,
  status,
  active,
  isMine,
  onSit,
  barRef,
}: {
  seat: Seat;
  status: string;
  active: boolean;
  isMine: boolean;
  onSit?: () => void;
  barRef: React.RefObject<HTMLDivElement | null>;
}) {
  const bar = barRef;
  return (
    // Phones fit seven seats in ~360px: smaller tags with the name cut short.
    <div className="pointer-events-auto flex select-none flex-col items-center gap-1 whitespace-nowrap opacity-90 hover:opacity-100 compact:gap-0.5">
      <div
        className={`pixel-box flex flex-col items-center px-2 py-1 leading-tight compact:px-1 compact:py-0.5 ${active ? "bg-[#3d2f0d]" : isMine ? "bg-[#1f3a2c]" : ""}`}
      >
        <span className="flex items-baseline text-xs compact:text-[0.62rem]">
          {seat.bot && <span className="mr-1 font-display text-[0.4rem] text-ink-dim compact:text-[0.32rem]">IA</span>}
          <span className={`max-w-36 truncate compact:max-w-16 ${isMine ? "text-gold" : ""}`}>{seat.name}</span>
          <span className="ml-1 font-display text-[0.4rem] text-gold compact:text-[0.32rem]">{compact(seat.stack)}</span>
        </span>
        {status && <span className="text-[0.7rem] leading-none text-ink-dim compact:text-[0.55rem]">{status}</span>}
        <div className="mt-0.5 h-1 w-full bg-black/40">
          <div ref={bar} className="h-full bg-gold" style={{ width: 0 }} />
        </div>
      </div>
      {onSit && (
        <button className="pixel-btn btn-green px-2 py-1 text-[0.45rem] compact:px-2.5 compact:text-[0.6rem]" onClick={onSit} aria-label="Tomar asiento">
          <span className="compact:hidden">Tomar asiento</span>
          <span className="hidden compact:inline">+</span>
        </button>
      )}
    </div>
  );
}

/** Total shown next to a hand once its last card has landed. */
export function HandBadge({ hand, position, showAt }: { hand: Hand; position: THREE.Vector3; showAt: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (ref.current) ref.current.style.opacity = performance.now() >= showAt ? "1" : "0";
  });
  if (hand.cards.length === 0) return null;
  const label = totalLabel(hand);
  const bust = handValue(hand).total > 21;
  const colors: Record<string, string> = {
    blackjack: "bg-gold text-[#2a1a00]",
    win: "bg-green text-black",
    push: "bg-blue text-white",
    lose: "bg-red text-white",
    bust: "bg-red text-white",
    surrender: "bg-panel-2 text-ink-dim",
  };
  const style = hand.result ? colors[hand.result] : bust ? colors.bust : "bg-[#120d22] text-ink";
  const text =
    hand.result === "blackjack"
      ? "BLACKJACK"
      : hand.result === "surrender"
        ? "RENDIDO"
        : bust
          ? `${label} SE PASÓ`
          : label;
  return (
    <Html position={position} center zIndexRange={[30, 10]}>
      <div
        ref={ref}
        style={{ opacity: 0, transition: "opacity 120ms steps(2)" }}
        className={`pointer-events-none whitespace-nowrap px-1.5 py-0.5 font-display text-[0.5rem] ${style}`}
      >
        {text}
      </div>
    </Html>
  );
}

export function SeatSpot({
  index,
  config,
  state,
  seat,
  isMine,
  canSit,
  onSit,
  timeline,
  view,
  emote,
  chatLine,
  serverNow,
}: {
  index: number;
  config: TableConfig;
  state: TableState;
  seat?: Seat;
  isMine: boolean;
  canSit: boolean;
  onSit: (seat: number) => void;
  timeline: DealTimeline;
  view: ViewBasis;
  emote?: SeatEmote;
  chatLine?: { text: string; ts: number };
  serverNow: () => number;
}) {
  const angle = seatAngle(index, config.seats);
  const stoolPos = useMemo(() => polar(angle, SEAT_R), [angle]);
  const facing = facingCenter(angle);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  // A mood belongs to the round that caused it, so a new round starts neutral.
  const [moodState, setMoodState] = useState<{ mood: Mood; round: number }>({ mood: "neutral", round: -1 });
  const mood: Mood = moodState.round === state.round ? moodState.mood : "neutral";
  const isTurn = state.phase === "playing" && state.turn?.seat === index;
  const payoutAt = state.phase === "payout" ? timeline.phaseSince + 450 : null;

  // Turn timer bar inside the nameplate (driven from the R3F tree).
  const timerBar = useRef<HTMLDivElement>(null);
  const timerTotal = useRef(1);
  useEffect(() => {
    timerTotal.current = Math.max(1, state.phaseEndsAt - serverNow());
  }, [state.phaseEndsAt, state.turn?.seat, state.turn?.hand, serverNow]);
  useFrame(() => {
    if (!timerBar.current) return;
    const left = Math.max(0, state.phaseEndsAt - serverNow());
    timerBar.current.style.width = `${isTurn ? Math.min(100, (left / timerTotal.current) * 100) : 0}%`;
  });

  // Reactions to the round result.
  const result = state.phase === "payout" && seat ? bestResult(seat.hands) : null;
  useEffect(() => {
    if (!result) return;
    const round = state.round;
    const map: Record<string, [string, Mood]> = {
      blackjack: ["cheer", "joy"],
      win: ["yes", "joy"],
      push: ["no", "fun"],
      surrender: ["no", "sorrow"],
      lose: ["no", "sorrow"],
      bust: ["hit_head", "angry"],
    };
    const [clip, m] = map[result];
    const id = setTimeout(() => {
      setReaction({ clip, key: Date.now() });
      setMoodState({ mood: m, round });
    }, 900);
    return () => clearTimeout(id);
  }, [result, state.round]);

  // Busting during play.
  const busted = seat?.hands.some((h) => handValue(h).total > 21) ?? false;
  useEffect(() => {
    if (!busted || state.phase !== "playing") return;
    const round = state.round;
    const id = setTimeout(() => {
      setReaction({ clip: "hit_head", key: Date.now() });
      setMoodState({ mood: "angry", round });
    }, 500);
    return () => clearTimeout(id);
  }, [busted, state.phase, state.round]);

  const [bubble, setBubble] = useState<{ text: string; emoji: boolean; key: number } | null>(null);
  useEffect(() => {
    if (!emote || Date.now() - emote.ts > 4000) return;
    const clip = EMOTE_CLIPS[emote.e];
    const show = setTimeout(() => {
      if (clip) setReaction({ clip, key: emote.ts });
      setBubble({ text: emote.e, emoji: true, key: emote.ts });
    }, 0);
    const hide = setTimeout(() => setBubble((b) => (b?.key === emote.ts ? null : b)), 3500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [emote]);
  useEffect(() => {
    if (!chatLine || Date.now() - chatLine.ts > 6000) return;
    const show = setTimeout(() => setBubble({ text: chatLine.text, emoji: false, key: chatLine.ts }), 0);
    const hide = setTimeout(() => setBubble((b) => (b?.key === chatLine.ts ? null : b)), 5000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [chatLine]);

  const status = (() => {
    if (!seat) return "";
    if (seat.leaving) return "Saliendo...";
    if (state.phase === "betting") return seat.ready ? "¡Listo!" : seat.bet > 0 ? "Apostando" : "";
    if (isTurn) return "Su turno";
    if (state.phase === "payout" && seat.hands.length) return signed(seat.net);
    if (seat.hands.length === 0 && state.phase !== "waiting") return "Espera ronda";
    return "";
  })();

  return (
    <group>
      <Stool position={stoolPos} rotation={facing} />
      {!seat && (
        <group position={[stoolPos.x, 0.02, stoolPos.z]}>
          <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.36, 0.44, 24]} />
            <meshBasicMaterial color={canSit ? "#f6c544" : "#5a4a93"} transparent opacity={0.7} />
          </mesh>
          {canSit && (
            <Html position={[0, 1.15, 0]} center zIndexRange={[25, 5]}>
              <button
                className="pixel-btn btn-gold animate-pop-in px-3 py-2 text-[0.5rem] compact:px-2.5 compact:py-1.5 compact:text-[0.7rem]"
                onClick={() => onSit(index)}
                aria-label={`Sentarse en el asiento ${index + 1}`}
              >
                <span className="compact:hidden">Sentarse</span>
                <span className="hidden compact:inline">+</span>
              </button>
            </Html>
          )}
        </group>
      )}

      {seat && (
        <>
          <Avatar
            id={seat.avatar.id}
            seated
            base={isTurn ? "sit_talk" : "sit_idle"}
            reaction={reaction}
            mood={mood}
            position={[stoolPos.x, STOOL_TOP, stoolPos.z]}
            rotation={[0, facing, 0]}
          />
          <Html position={[stoolPos.x, STOOL_TOP + 1.12, stoolPos.z]} center zIndexRange={[40, 20]}>
            <Nameplate
              seat={seat}
              status={status}
              active={isTurn}
              isMine={isMine}
              barRef={timerBar}
              onSit={canSit && seat.bot && seat.hands.length === 0 ? () => onSit(index) : undefined}
            />
          </Html>

          {bubble && (
            <Html position={[stoolPos.x, STOOL_TOP + 1.62, stoolPos.z]} center zIndexRange={[45, 25]}>
              <div
                key={bubble.key}
                className={`animate-pop-in pointer-events-none relative max-w-48 bg-ink px-2 py-1 text-center text-[#120d22] shadow-[3px_3px_0_#000] ${bubble.emoji ? "text-2xl leading-none" : "text-sm leading-tight"}`}
              >
                {bubble.emoji ? bubble.text : bubble.text.length > 70 ? `${bubble.text.slice(0, 68)}…` : bubble.text}
                <span className="absolute -bottom-1.5 left-1/2 h-2 w-2 -translate-x-1/2 bg-ink" />
              </div>
            </Html>
          )}

          <group position={stackPosition(angle)}>
            <PlayerChips stack={seat.stack} minBet={config.minBet} />
          </group>

          {state.phase === "betting" && seat.bet > 0 && (
            <group position={betPosition(angle, 0, 1)}>
              <ChipStack amount={seat.bet} from={stackPosition(angle).sub(betPosition(angle, 0, 1))} />
            </group>
          )}

          {seat.insurance > 0 && state.phase !== "payout" && (
            <group position={polar(angle, INSURANCE_R, TABLE_Y)}>
              <ChipStack amount={seat.insurance} />
            </group>
          )}

          {seat.hands.map((hand, h) => (
            <HandChips key={h} hand={hand} angle={angle} h={h} n={seat.hands.length} payoutAt={payoutAt} />
          ))}

          {SIDE_BET_IDS.map((id, k) =>
            seat.side[id] > 0 ? (
              <SideStack
                key={id}
                id={id}
                amount={seat.side[id]}
                result={seat.sideResults[id]}
                spot={sideSpotPosition(angle, k)}
                home={stackPosition(angle)}
                revealAt={
                  !seat.sideResults[id]
                    ? null
                    : id === "bust"
                      ? state.phase === "payout"
                        ? timeline.phaseSince + 450
                        : null
                      : sideRevealAt(seat, state, timeline)
                }
              />
            ) : null,
          )}

          {seat.hands.map((hand, h) => {
            const last = playerCardPosition(angle, h, seat.hands.length, Math.max(0, hand.cards.length - 1), view);
            return (
              <HandBadge
                key={`badge-${h}`}
                hand={hand}
                position={last.clone().add(new THREE.Vector3(0, 0.05, 0)).addScaledVector(view.up, 0.24)}
                showAt={handShowAt(hand.cards, state.round, timeline)}
              />
            );
          })}

          {isTurn && seat.hands.length > 1 && state.turn && (
            <mesh
              position={playerCardPosition(angle, state.turn.hand, seat.hands.length, 0, view).setY(TABLE_Y + 0.003)}
              rotation-x={-Math.PI / 2}
            >
              <ringGeometry args={[0.2, 0.235, 24]} />
              <meshBasicMaterial color="#f6c544" />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
