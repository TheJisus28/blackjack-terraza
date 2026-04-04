"use client";

import { useCallback, useRef, useState } from "react";
import type { GameResult, GameState, PlayerAction } from "@/lib/blackjack/types";
import {
  createGame,
  dealInitialCards,
  placeBet,
  playerAction,
  runToCompletion,
  startNewRound,
} from "@/lib/blackjack/engine";

export function useGame(playerName = "Jugador") {
  const [gameState, setGameState] = useState<GameState>(() =>
    createGame(playerName),
  );
  const [lastResults, setLastResults] = useState<GameResult[]>([]);
  const resultsRef = useRef<GameResult[]>([]);

  const player = gameState.players[0];
  const playerId = player?.id ?? "";

  const applyCompletion = useCallback((state: GameState): GameState => {
    const { state: final, results } = runToCompletion(state);
    if (results.length > 0) {
      resultsRef.current = results;
    }
    return final;
  }, []);

  const bet = useCallback(
    (amount: number) => {
      resultsRef.current = [];
      setGameState((prev) => {
        const afterBet = placeBet(prev, playerId, amount);
        const afterDeal = dealInitialCards(afterBet);
        return applyCompletion(afterDeal);
      });
      // Sync results after state update
      setTimeout(() => setLastResults(resultsRef.current), 0);
    },
    [playerId, applyCompletion],
  );

  const action = useCallback(
    (act: PlayerAction) => {
      resultsRef.current = [];
      setGameState((prev) => {
        const next = playerAction(prev, playerId, act);
        return applyCompletion(next);
      });
      setTimeout(() => setLastResults(resultsRef.current), 0);
    },
    [playerId, applyCompletion],
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
