"use client";

import { useEffect, useRef } from "react";
import { codes, handTotal, handValue } from "@/lib/game/cards";
import { seatIndices } from "@/lib/game/normalize";
import type { TableState } from "@/lib/game/types";
import { sound } from "@/lib/sound";
import { fmt } from "@/lib/format";
import { SIDE_BETS, SIDE_BET_IDS, SIDE_KIND_LABELS, type SideKind } from "@/lib/game/sidebets";
import { toast } from "@/lib/toast";
import { sideRevealAt, type DealTimeline } from "./timeline";

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

const LINES = {
  betting: ["Hagan sus apuestas", "Señoras y señores, sus apuestas", "Apuesten, por favor"],
  shuffle: ["Barajando un zapato nuevo", "Nuevo zapato, barajando"],
  dealing: ["No va más", "Cerramos apuestas"],
  insurance: ["El crupier muestra un as. ¿Seguro?", "¿Alguien quiere seguro?"],
};

export function useTableAudio({
  state,
  timeline,
  mySeat,
  onTalk,
}: {
  state: TableState | null;
  timeline: DealTimeline;
  mySeat: number | null;
  onTalk: (talking: boolean) => void;
}) {
  const prev = useRef<TableState | null>(null);
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state) return;
    const say = (text: string, delayMs = 0) => {
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
      voiceTimer.current = setTimeout(() => sound.speak(text, () => onTalk(true), () => onTalk(false)), delayMs);
    };

    const now = performance.now();
    for (const ev of timeline.drain()) {
      const delay = (ev.at - now) / 1000;
      if (ev.kind === "deal") {
        sound.play("card-slide", { delay, volume: 0.75 });
        sound.play("card-place", { delay: delay + 0.36, volume: 0.45 });
      } else {
        sound.play("card-shove", { delay, volume: 0.7 });
      }
    }

    const p = prev.current;
    prev.current = state;
    if (!p) return;

    for (const idx of seatIndices(state)) {
      const before = p.seats[idx]?.bet ?? 0;
      const after = state.seats[idx]?.bet ?? 0;
      if (after > before) sound.play(after - before > 100 ? "chips-stack" : "chip-lay", { volume: idx === mySeat ? 0.9 : 0.45 });
      const insBefore = p.seats[idx]?.insurance ?? 0;
      if ((state.seats[idx]?.insurance ?? 0) > insBefore) sound.play("chip-lay", { volume: 0.6 });
    }

    if (p.phase !== state.phase) {
      switch (state.phase) {
        case "betting":
          if (state.shuffling) {
            sound.play("card-shuffle", { volume: 0.8 });
            sound.play("card-fan", { delay: 1.6, volume: 0.6 });
            say(pick(LINES.shuffle), 200);
          } else {
            say(pick(LINES.betting), 600);
          }
          break;
        case "dealing":
          say(pick(LINES.dealing));
          break;
        case "insurance":
          say(pick(LINES.insurance), 400);
          break;
        case "dealer": {
          const total = handTotal(codes(state.dealer.cards)).total;
          const delay = Math.max(0, timeline.settledAt() - performance.now()) + 250;
          if (state.dealerBlackjack) say("Blackjack del crupier", delay);
          else if (total > 21) say("El crupier se pasa", delay);
          else say(`El crupier tiene ${total}`, delay);
          break;
        }
        case "payout": {
          const me = mySeat !== null ? state.seats[mySeat] : undefined;
          let anyWin = false;
          for (const idx of seatIndices(state)) {
            for (const hand of state.seats[idx].hands) if (hand.result === "win" || hand.result === "blackjack") anyWin = true;
          }
          if (anyWin) sound.play("chips-handle", { delay: 0.5, volume: 0.6 });
          sound.play("chips-collide", { delay: 0.85, volume: 0.45 });
          if (me?.hands.length) {
            const results = me.hands.map((h) => h.result);
            const kind = results.includes("blackjack")
              ? "blackjack"
              : me.net > 0
                ? "win"
                : me.net === 0
                  ? "push"
                  : "lose";
            sound.stinger(kind, 0.55);
          }
          break;
        }
      }
    }

    // My side bets, announced when their cards are on the table.
    if (mySeat !== null) {
      const me = state.seats[mySeat];
      const was = p.seats[mySeat];
      if (me) {
        for (const id of SIDE_BET_IDS) {
          const r = me.sideResults[id];
          if (!r || was?.sideResults[id] || r.payout <= 0) continue;
          const stake = me.side[id];
          const delay = id === "bust" ? 1400 : Math.max(0, sideRevealAt(me, state, timeline) - performance.now());
          setTimeout(() => {
            toast.chips(`${SIDE_BETS[id].name}: ${SIDE_KIND_LABELS[r.kind as SideKind]} +${fmt(r.payout - stake)}`);
            sound.play("chips-handle", { volume: 0.8 });
            sound.stinger("coin");
          }, delay);
        }
      }
    }

    // My turn starts.
    const myTurnNow = state.phase === "playing" && state.turn?.seat === mySeat;
    const myTurnBefore = p.phase === "playing" && p.turn?.seat === mySeat && p.turn?.hand === state.turn?.hand;
    if (myTurnNow && !myTurnBefore) sound.stinger("turn", 0.35);

    // One of my hands just busted.
    if (mySeat !== null && state.phase === "playing") {
      const was = p.seats[mySeat]?.hands.filter((h) => handValue(h).total > 21).length ?? 0;
      const is = state.seats[mySeat]?.hands.filter((h) => handValue(h).total > 21).length ?? 0;
      if (is > was) sound.stinger("bust", 0.45);
    }
  }, [state, timeline, mySeat, onTalk]);

  useEffect(
    () => () => {
      if (voiceTimer.current) clearTimeout(voiceTimer.current);
    },
    [],
  );
}
