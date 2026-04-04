"use client";

import { useCallback, useState } from "react";
import type { GameState, PlayerAction } from "@/lib/blackjack/types";
import {
  createGame,
  dealInitialCards,
  placeBet,
  playerAction,
  playDealerTurn,
  resolveRound,
  startNewRound,
} from "@/lib/blackjack/engine";

export function useGame(playerName = "Jugador") {
  const [gameState, setGameState] = useState<GameState>(() =>
    createGame(playerName),
  );
  const [lastResults, setLastResults] = useState<
    ReturnType<typeof resolveRound>["results"]
  >([]);

  const player = gameState.players[0];
  const playerId = player?.id ?? "";

  const bet = useCallback(
    (amount: number) => {
      setGameState((prev) => {
        const next = placeBet(prev, playerId, amount);
        return dealInitialCards(next);
      });
    },
    [playerId],
  );

  const action = useCallback(
    (act: PlayerAction) => {
      setGameState((prev) => {
        let next = playerAction(prev, playerId, act);

        if (next.phase === "dealer_turn") {
          next = playDealerTurn(next);
        }
        if (next.phase === "resolving") {
          const resolved = resolveRound(next);
          setLastResults(resolved.results);
          return resolved.state;
        }

        return next;
      });
    },
    [playerId],
  );

  const newRound = useCallback(() => {
    setGameState((prev) => startNewRound(prev));
    setLastResults([]);
  }, []);

  const resetGame = useCallback(() => {
    setGameState(createGame(playerName));
    setLastResults([]);
  }, [playerName]);

  return {
    gameState,
    player,
    lastResults,
    bet,
    action,
    newRound,
    resetGame,
  };
}
