"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { DEALER_AVATAR } from "@/lib/avatar";
import type { TableConfig, TableState } from "@/lib/game/types";
import { handShowAt, type DealTimeline } from "@/components/table/timeline";
import { Avatar, type Mood, type Reaction } from "./Avatar";
import { DEALER_POS, dealerCardPosition, polar, seatAngle, SEAT_R, TABLE_Y, type ViewBasis } from "./layout";
import { HandBadge } from "./Seat";

export function Dealer({
  state,
  config,
  timeline,
  view,
  talking,
}: {
  state: TableState;
  config: TableConfig;
  timeline: DealTimeline;
  view: ViewBasis;
  talking: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);

  useFrame(() => {
    const next = performance.now() < timeline.busyUntil;
    if (next !== busy) setBusy(next);
  });

  useEffect(() => {
    if (state.phase === "payout") {
      const id = setTimeout(() => setReaction({ clip: "pickup", key: Date.now() }), 2600);
      return () => clearTimeout(id);
    }
    if (state.phase === "betting" && state.shuffling) {
      const id = setTimeout(() => setReaction({ clip: "use_item", key: Date.now() }), 250);
      return () => clearTimeout(id);
    }
  }, [state.phase, state.round, state.shuffling]);

  const base = (() => {
    if (busy) return "interact";
    switch (state.phase) {
      case "waiting":
        return "fold_arms";
      case "insurance":
        return "talk";
      case "betting":
        return talking ? "talk" : "lean";
      default:
        return talking ? "talk" : "idle";
    }
  })();

  // Turn the torso towards whoever is playing.
  const lookYaw = useMemo(() => {
    if (state.phase !== "playing" || !state.turn) return 0;
    const target = polar(seatAngle(state.turn.seat, config.seats), SEAT_R);
    const dir = target.sub(DEALER_POS);
    // The avatar is rotated 180° inside Avatar, which flips the bone's yaw sign.
    return -THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.7, 0.7) * 0.6;
  }, [state.phase, state.turn, config.seats]);

  const mood: Mood = state.dealerBlackjack ? "joy" : "neutral";
  const lastCard = dealerCardPosition(Math.max(0, state.dealer.cards.length - 1), view);
  const visibleCards = state.dealer.cards.filter((c) => c.c !== "XX");

  return (
    <>
      <Avatar
        id={DEALER_AVATAR.id}
        base={base}
        reaction={reaction}
        mood={mood}
        talking={talking}
        lookYaw={lookYaw}
        position={DEALER_POS}
      />
      {visibleCards.length > 0 && (
        <HandBadge
          hand={{
            cards: visibleCards,
            bet: 0,
            doubled: false,
            split: false,
            splitAces: false,
            done: true,
            surrendered: false,
            result: null,
            payout: 0,
          }}
          position={lastCard.clone().setY(TABLE_Y + 0.05).addScaledVector(view.up, -0.26)}
          showAt={handShowAt(visibleCards, state.round, timeline)}
        />
      )}
    </>
  );
}
