"use client";

import Image from "next/image";
import { useRef } from "react";
import type { Card as CardType } from "@/lib/blackjack/types";
import { getCardImagePath } from "@/lib/blackjack/deck";
import {
  CARD_ANIM_DELAY_PER_CARD_MS,
  CARD_DEAL_DURATION_MS,
} from "@/lib/blackjack/constants";

interface CardProps {
  card: CardType;
  index?: number;
  /** Si se define, sustituye el retardo por índice local (cola global de la mesa) */
  dealDelayMs?: number;
  className?: string;
  flip?: boolean;
}

export function Card({
  card,
  index = 0,
  dealDelayMs,
  className = "",
  flip = false,
}: CardProps) {
  const src = getCardImagePath(card);
  const isPng = src.endsWith(".png");
  const delayRef = useRef<number | null>(null);
  if (delayRef.current === null) {
    delayRef.current = dealDelayMs ?? index * CARD_ANIM_DELAY_PER_CARD_MS;
  }
  const delay = delayRef.current;

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animation: flip
          ? `cardFlip ${CARD_DEAL_DURATION_MS}ms ease-in-out ${delay}ms both`
          : `cardDeal ${CARD_DEAL_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`,
      }}
    >
      <div className="relative w-[80px] h-[112px] sm:w-[100px] sm:h-[140px] lg:w-[115px] lg:h-[161px] rounded-lg shadow-xl overflow-hidden bg-white border border-gray-200 hover:shadow-2xl transition-shadow duration-300">
        {isPng ? (
          <Image
            src={src}
            alt={card.faceUp ? `${card.rank} of ${card.suit}` : "Card back"}
            fill
            className="object-contain p-0.5"
            sizes="(min-width:1024px) 115px, (min-width:640px) 100px, 80px"
          />
        ) : (
          <Image
            src={src}
            alt={`${card.rank} of ${card.suit}`}
            fill
            className="object-contain"
            sizes="(min-width:1024px) 115px, (min-width:640px) 100px, 80px"
          />
        )}
      </div>
    </div>
  );
}
