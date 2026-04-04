"use client";

import Image from "next/image";
import type { Card as CardType } from "@/lib/blackjack/types";
import { getCardImagePath } from "@/lib/blackjack/deck";

interface CardProps {
  card: CardType;
  index?: number;
  className?: string;
  flip?: boolean;
}

export function Card({ card, index = 0, className = "", flip = false }: CardProps) {
  const src = getCardImagePath(card);
  const isPng = src.endsWith(".png");
  const delay = index * 250;

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animation: flip
          ? `cardFlip 0.7s ease-in-out ${delay}ms both`
          : `cardDeal 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`,
      }}
    >
      <div className="relative w-[80px] h-[112px] sm:w-[100px] sm:h-[140px] rounded-lg shadow-xl overflow-hidden bg-white border border-gray-200 hover:shadow-2xl transition-shadow duration-300">
        {isPng ? (
          <Image
            src={src}
            alt={card.faceUp ? `${card.rank} of ${card.suit}` : "Card back"}
            fill
            className="object-contain p-0.5"
            sizes="100px"
          />
        ) : (
          <Image
            src={src}
            alt={`${card.rank} of ${card.suit}`}
            fill
            className="object-contain"
            sizes="100px"
          />
        )}
      </div>
    </div>
  );
}
