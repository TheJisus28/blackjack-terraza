"use client";

import Image from "next/image";
import type { Card as CardType } from "@/lib/blackjack/types";
import { getCardImagePath } from "@/lib/blackjack/deck";

interface CardProps {
  card: CardType;
  index?: number;
  className?: string;
}

export function Card({ card, index = 0, className = "" }: CardProps) {
  const src = getCardImagePath(card);
  const isPng = src.endsWith(".png");

  return (
    <div
      className={`relative inline-block transition-all duration-300 ease-out ${className}`}
      style={{
        animationDelay: `${index * 100}ms`,
        animation: "cardDeal 0.4s ease-out both",
      }}
    >
      <div className="relative w-[80px] h-[112px] sm:w-[100px] sm:h-[140px] rounded-lg shadow-lg overflow-hidden bg-white border border-gray-200">
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
