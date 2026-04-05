"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult, GameState, PlayerAction } from "@/game/simulation/blackjack/types";
import { PHASE } from "@/game/simulation/blackjack/game-phase";
import {
  createGame,
  dealInitialCards,
  placeBet,
  playerAction,
  runToCompletion,
  startNewRound,
  takeInsurance,
  declineInsurance,
  autoRebuyBrokePlayersInResults,
} from "@/game/simulation/blackjack/engine";
import {
  INSURANCE_TIMER_S,
  RESULTS_TIMER_S,
  RESULTS_REBUY_LEAD_S,
} from "@/game/simulation/blackjack/constants";

export function useGame(playerName = "Player") {
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

  const insuranceAccept = useCallback((amount: number) => {
    resultsRef.current = [];
    setGameState((prev) => {
      const { state: next, results } = takeInsurance(prev, playerId, amount);
      if (results.length > 0) resultsRef.current = results;
      const { state: final, results: r2 } = runToCompletion(next);
      if (r2.length > 0) resultsRef.current = r2;
      return final;
    });
    setTimeout(() => setLastResults(resultsRef.current), 0);
  }, [playerId]);

  const insuranceDecline = useCallback(() => {
    resultsRef.current = [];
    setGameState((prev) => {
      const { state: next, results } = declineInsurance(prev, playerId);
      if (results.length > 0) resultsRef.current = results;
      const { state: final, results: r2 } = runToCompletion(next);
      if (r2.length > 0) resultsRef.current = r2;
      return final;
    });
    setTimeout(() => setLastResults(resultsRef.current), 0);
  }, [playerId]);

  useEffect(() => {
    if (gameState.phase !== PHASE.INSURANCE || !gameState.insuranceStartedAt)
      return;
    const deadline =
      gameState.insuranceStartedAt + INSURANCE_TIMER_S * 1000;
    const ms = Math.max(0, deadline - Date.now());
    const t = window.setTimeout(() => {
      insuranceDecline();
    }, ms);
    return () => window.clearTimeout(t);
  }, [gameState.phase, gameState.insuranceStartedAt, insuranceDecline]);

  useEffect(() => {
    if (gameState.phase !== PHASE.FINISHED || !gameState.roundEndedAt) return;
    if (player.chips >= gameState.minBet) return;

    const minElapsedMs = (RESULTS_TIMER_S - RESULTS_REBUY_LEAD_S) * 1000;
    const deadline = gameState.roundEndedAt + minElapsedMs;
    const ms = Math.max(0, deadline - Date.now());
    const t = window.setTimeout(() => {
      setGameState((prev) => {
        if (prev.phase !== PHASE.FINISHED) return prev;
        return autoRebuyBrokePlayersInResults(prev);
      });
    }, ms);
    return () => window.clearTimeout(t);
  }, [gameState.phase, gameState.roundEndedAt, player.chips, gameState.minBet]);

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
    insuranceAccept,
    insuranceDecline,
    resetGame,
  };
}
