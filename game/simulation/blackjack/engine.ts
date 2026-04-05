import type {
  Card,
  ClientGameState,
  GameResult,
  GameState,
  Player,
  PlayerAction,
} from "./model/types";
import { createShoe, drawCard, shouldReshuffle } from "./rules/deck";
import {
  canDoubleDown,
  canSplit,
  canSurrender,
  createHand,
  getHandValue,
  isBlackjack,
  isBusted,
  isNaturalBlackjackCards,
  isTenValueRank,
} from "./rules/hand";
import {
  DEFAULT_DECK_COUNT,
  DEFAULT_MIN_BET,
  DEFAULT_MAX_BET,
  STARTING_CHIPS,
  REBUY_CHIPS,
  BLACKJACK_VALUE,
  DEALER_STAND_VALUE,
  BLACKJACK_PAYOUT_MULTIPLIER,
  WIN_PAYOUT_MULTIPLIER,
  SURRENDER_RETURN_RATIO,
  INITIAL_DEAL_ROUNDS,
} from "./rules/constants";
import { PHASE } from "./meta/game-phase";
import { PLAYER_ACTION } from "./meta/player-action-kind";
import { generateId } from "@/shared/lib/uuid";

export function createGame(playerName: string): GameState {
  return {
    id: generateId(),
    phase: PHASE.BETTING,
    deck: createShoe(DEFAULT_DECK_COUNT),
    dealer: { cards: [], status: "playing" },
    players: [
      {
        id: generateId(),
        name: playerName,
        chips: STARTING_CHIPS,
        hands: [],
        activeHandIndex: 0,
        isActive: true,
      },
    ],
    activePlayerIndex: 0,
    minBet: DEFAULT_MIN_BET,
    maxBet: DEFAULT_MAX_BET,
    deckCount: DEFAULT_DECK_COUNT,
    message: "Place your bet",
  };
}

export function placeBet(
  state: GameState,
  playerId: string,
  amount: number,
): GameState {
  if (state.phase !== PHASE.BETTING) {
    return { ...state, message: "Not time to bet" };
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  if (amount < state.minBet || amount > state.maxBet) {
    const maxLabel = state.maxBet >= 999_999 ? "your chips" : `$${state.maxBet}`;
    return {
      ...state,
      message: `Bet must be between $${state.minBet} y ${maxLabel}`,
    };
  }
  if (amount > player.chips) {
    return { ...state, message: "Not enough chips" };
  }

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    chips: player.chips - amount,
    hands: [createHand(amount)],
    activeHandIndex: 0,
  };

  return { ...state, players: updatedPlayers, message: "" };
}

export function dealInitialCards(state: GameState): GameState {
  if (state.phase !== PHASE.BETTING) return state;

  const activePlayers = state.players.filter(
    (p) => p.hands.length > 0 && p.hands[0].bet > 0,
  );
  if (activePlayers.length === 0) {
    return { ...state, message: "You must place a bet first" };
  }

  let deck = [...state.deck];
  const players = deepClonePlayers(state.players);
  const dealerCards = [];

  for (let round = 0; round < INITIAL_DEAL_ROUNDS; round++) {
    for (const player of players) {
      if (player.hands.length > 0 && player.hands[0].bet > 0) {
        const result = drawCard(deck);
        player.hands[0].cards.push(result.card);
        deck = result.deck;
      }
    }
    const dealerDraw = drawCard(deck, round === 0);
    dealerCards.push(dealerDraw.card);
    deck = dealerDraw.deck;
  }

  for (const player of players) {
    if (player.hands.length > 0 && isBlackjack(player.hands[0].cards)) {
      player.hands[0].status = "blackjack";
    }
  }

  const dealerUp = dealerCards[0];
  const allSettled = players.every(
    (p) =>
      p.hands.length === 0 ||
      p.hands[0].bet === 0 ||
      p.hands[0].status !== "playing",
  );
  const firstActive = findNextActiveHand(players, 0, 0);

  // Ten-value upcard (not ace): peek — dealer natural ends the round
  if (dealerUp && isTenValueRank(dealerUp.rank)) {
    if (isNaturalBlackjackCards(dealerCards)) {
      const revealed = dealerCards.map((c) => ({ ...c, faceUp: true }));
      return {
        ...state,
        deck,
        dealer: { cards: revealed, status: "standing" },
        players,
        phase: PHASE.RESOLVING,
        message: "Dealer blackjack",
      };
    }
    return {
      ...state,
      deck,
      dealer: { cards: dealerCards, status: "playing" },
      players,
      phase: allSettled ? PHASE.DEALER_TURN : PHASE.PLAYING,
      activePlayerIndex: firstActive?.playerIndex ?? 0,
      message: allSettled
        ? "Dealer's turn"
        : `${players[firstActive?.playerIndex ?? 0]?.name ?? ""}'s turn`,
    };
  }

  // Visible ace: offer insurance before continuing
  if (dealerUp?.rank === "ace") {
    const playersWithInsurance = players.map((p) => {
      if (p.hands.length > 0 && p.hands[0].bet > 0) {
        return { ...p, insuranceWager: null as number | null };
      }
      return { ...p };
    });
    return {
      ...state,
      deck,
      dealer: { cards: dealerCards, status: "playing" },
      players: playersWithInsurance,
      phase: PHASE.INSURANCE,
      insuranceStartedAt: Date.now(),
      message: "Insurance offered (dealer shows Ace)",
    };
  }

  return {
    ...state,
    deck,
    dealer: { cards: dealerCards, status: "playing" },
    players,
    phase: allSettled ? PHASE.DEALER_TURN : PHASE.PLAYING,
    activePlayerIndex: firstActive?.playerIndex ?? 0,
    message: allSettled
      ? "Dealer's turn"
      : `${players[firstActive?.playerIndex ?? 0]?.name ?? ""}'s turn`,
  };
}

function stripPlayerInsurance(p: Player): Player {
  const { insuranceWager: _, ...rest } = p;
  return rest;
}

export function allInsuranceAnswered(state: GameState): boolean {
  if (state.phase !== PHASE.INSURANCE) return false;
  return state.players.every((p) => {
    if (!p.hands[0] || p.hands[0].bet <= 0) return true;
    return p.insuranceWager != null;
  });
}

function tryResolveInsuranceIfComplete(
  state: GameState,
): { state: GameState; results: GameResult[] } {
  if (!allInsuranceAnswered(state)) return { state, results: [] };
  return resolveInsurancePhase(state);
}

export function resolveInsurancePhase(state: GameState): {
  state: GameState;
  results: GameResult[];
} {
  let players = deepClonePlayers(state.players);

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.hands[0]?.bet > 0 && p.insuranceWager == null) {
      players[i] = { ...p, insuranceWager: 0 };
    }
  }

  const dealerBJ = isNaturalBlackjackCards(state.dealer.cards);
  const revealed = state.dealer.cards.map((c) => ({ ...c, faceUp: true }));

  if (dealerBJ) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const w = p.insuranceWager ?? 0;
      if (w > 0) {
        players[i] = { ...p, chips: p.chips + w * 3 };
      }
    }
    players = players.map((p) => stripPlayerInsurance(p));
    const nextState: GameState = {
      ...state,
      dealer: { cards: revealed, status: "standing" },
      players,
      phase: PHASE.RESOLVING,
      message: "Dealer blackjack",
      insuranceStartedAt: undefined,
    };
    return resolveRound(nextState);
  }

  players = players.map((p) => stripPlayerInsurance(p));
  const allSettled = players.every(
    (p) =>
      p.hands.length === 0 ||
      p.hands[0].bet === 0 ||
      p.hands[0].status !== "playing",
  );
  const firstActive = findNextActiveHand(players, 0, 0);

  return {
    state: {
      ...state,
      dealer: { ...state.dealer, cards: state.dealer.cards },
      players,
      phase: allSettled ? PHASE.DEALER_TURN : PHASE.PLAYING,
      activePlayerIndex: firstActive?.playerIndex ?? 0,
      message: allSettled
        ? "Dealer's turn"
        : `${players[firstActive?.playerIndex ?? 0]?.name ?? ""}'s turn`,
      insuranceStartedAt: undefined,
    },
    results: [],
  };
}

export function takeInsurance(
  state: GameState,
  playerId: string,
  amount?: number,
): { state: GameState; results: GameResult[] } {
  if (state.phase !== PHASE.INSURANCE) return { state, results: [] };

  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return { state, results: [] };

  const players = deepClonePlayers(state.players);
  const p = players[idx];
  if (!p.hands[0] || p.hands[0].bet <= 0) return { state, results: [] };
  if (p.insuranceWager != null) return { state, results: [] };

  const maxIns = Math.floor(p.hands[0].bet / 2);
  if (maxIns < 1) {
    players[idx] = { ...p, insuranceWager: 0 };
    return tryResolveInsuranceIfComplete({ ...state, players });
  }

  if (p.chips < 1) {
    players[idx] = { ...p, insuranceWager: 0 };
    return tryResolveInsuranceIfComplete({ ...state, players });
  }

  const target =
    amount !== undefined
      ? Math.min(Math.max(0, amount), maxIns, p.chips)
      : Math.min(maxIns, p.chips);
  if (target < 1) return { state, results: [] };

  players[idx] = {
    ...p,
    chips: p.chips - target,
    insuranceWager: target,
  };
  return tryResolveInsuranceIfComplete({ ...state, players });
}

export function declineInsurance(
  state: GameState,
  playerId: string,
): { state: GameState; results: GameResult[] } {
  if (state.phase !== PHASE.INSURANCE) return { state, results: [] };

  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return { state, results: [] };

  const players = deepClonePlayers(state.players);
  const p = players[idx];
  if (!p.hands[0] || p.hands[0].bet <= 0) return { state, results: [] };
  if (p.insuranceWager != null) return { state, results: [] };

  players[idx] = { ...p, insuranceWager: 0 };
  return tryResolveInsuranceIfComplete({ ...state, players });
}

/**
 * Finds the next hand with status "playing", starting from a given
 * player/hand index. Returns null if none found.
 */
function findNextActiveHand(
  players: Player[],
  fromPlayerIndex: number,
  fromHandIndex: number,
): { playerIndex: number; handIndex: number } | null {
  for (let pi = fromPlayerIndex; pi < players.length; pi++) {
    const startHand = pi === fromPlayerIndex ? fromHandIndex : 0;
    for (let hi = startHand; hi < players[pi].hands.length; hi++) {
      if (players[pi].hands[hi].status === "playing") {
        return { playerIndex: pi, handIndex: hi };
      }
    }
  }
  return null;
}

function advanceToNextPlayer(state: GameState): GameState {
  const player = state.players[state.activePlayerIndex];
  const players = deepClonePlayers(state.players);

  // Look for the next playable hand (current player's remaining hands first, then next players)
  const next = findNextActiveHand(
    players,
    state.activePlayerIndex,
    player.activeHandIndex + 1,
  );

  if (next) {
    players[next.playerIndex] = {
      ...players[next.playerIndex],
      activeHandIndex: next.handIndex,
    };
    const nextPlayer = players[next.playerIndex];
    const handLabel =
      nextPlayer.hands.length > 1
        ? ` — Hand ${next.handIndex + 1}`
        : "";
    return {
      ...state,
      players,
      activePlayerIndex: next.playerIndex,
      message: `${nextPlayer.name}${handLabel}`,
    };
  }

  return { ...state, players, phase: PHASE.DEALER_TURN, message: "Dealer's turn" };
}

export function playerAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
): GameState {
  if (state.phase !== PHASE.PLAYING) return state;

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1 || playerIndex !== state.activePlayerIndex) {
    return { ...state, message: "Not your turn" };
  }

  const player = state.players[playerIndex];
  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.status !== "playing") return state;

  switch (action) {
    case PLAYER_ACTION.HIT:
      return handleHit(state, playerIndex);
    case PLAYER_ACTION.STAND:
      return handleStand(state, playerIndex);
    case PLAYER_ACTION.DOUBLE:
      return handleDouble(state, playerIndex);
    case PLAYER_ACTION.SPLIT:
      return handleSplit(state, playerIndex);
    case PLAYER_ACTION.SURRENDER:
      return handleSurrender(state, playerIndex);
    default:
      return state;
  }
}

function handleHit(state: GameState, playerIndex: number): GameState {
  let deck = [...state.deck];
  const players = deepClonePlayers(state.players);
  const player = players[playerIndex];
  const hand = player.hands[player.activeHandIndex];

  const result = drawCard(deck);
  hand.cards.push(result.card);
  deck = result.deck;

  const value = getHandValue(hand.cards);
  if (value > BLACKJACK_VALUE) {
    hand.status = "busted";
  } else if (value === BLACKJACK_VALUE) {
    hand.status = "standing";
  }

  let newState: GameState = { ...state, deck, players };

  if (hand.status !== "playing") {
    if (hand.status === "busted") {
      newState.message = `${player.name} busts!`;
    }
    newState = advanceToNextPlayer(newState);
  }

  return newState;
}

function handleStand(state: GameState, playerIndex: number): GameState {
  const players = deepClonePlayers(state.players);
  players[playerIndex].hands[
    players[playerIndex].activeHandIndex
  ].status = "standing";

  return advanceToNextPlayer({ ...state, players });
}

function handleDouble(state: GameState, playerIndex: number): GameState {
  const players = deepClonePlayers(state.players);
  const player = players[playerIndex];
  const hand = player.hands[player.activeHandIndex];

  if (!canDoubleDown(hand) || player.chips < hand.bet) {
    return { ...state, message: "Cannot double down" };
  }

  player.chips -= hand.bet;
  hand.bet *= 2;
  hand.isDoubledDown = true;

  let deck = [...state.deck];
  const result = drawCard(deck);
  hand.cards.push(result.card);
  deck = result.deck;

  hand.status = isBusted(hand.cards) ? "busted" : "standing";

  const newState: GameState = { ...state, deck, players };
  return advanceToNextPlayer(newState);
}

function handleSplit(state: GameState, playerIndex: number): GameState {
  const players = deepClonePlayers(state.players);
  const player = players[playerIndex];
  const hand = player.hands[player.activeHandIndex];

  if (!canSplit(hand) || player.chips < hand.bet) {
    return { ...state, message: "Cannot split" };
  }

  player.chips -= hand.bet;
  const secondCard = hand.cards.pop()!;
  const newHand = createHand(hand.bet);
  newHand.cards.push(secondCard);
  newHand.isSplit = true;
  hand.isSplit = true;

  let deck = [...state.deck];
  const draw1 = drawCard(deck);
  hand.cards.push(draw1.card);
  deck = draw1.deck;

  const draw2 = drawCard(deck);
  newHand.cards.push(draw2.card);
  deck = draw2.deck;

  player.hands.splice(player.activeHandIndex + 1, 0, newHand);

  const v1 = getHandValue(hand.cards);
  if (v1 > BLACKJACK_VALUE) hand.status = "busted";
  else if (v1 === BLACKJACK_VALUE) hand.status = "standing";

  const v2 = getHandValue(newHand.cards);
  if (v2 > BLACKJACK_VALUE) newHand.status = "busted";
  else if (v2 === BLACKJACK_VALUE) newHand.status = "standing";

  let newState: GameState = { ...state, deck, players };

  if (hand.status !== "playing") {
    newState = advanceToNextPlayer(newState);
  }

  return newState;
}

function handleSurrender(state: GameState, playerIndex: number): GameState {
  const players = deepClonePlayers(state.players);
  const player = players[playerIndex];
  const hand = player.hands[player.activeHandIndex];

  if (!canSurrender(hand)) {
    return { ...state, message: "Cannot surrender" };
  }

  hand.status = "surrendered";
  player.chips += Math.floor(hand.bet * SURRENDER_RETURN_RATIO);

  return advanceToNextPlayer({ ...state, players });
}

/**
 * At least one staked hand is still in play (not busted/surrendered).
 * Do not use `hands.every` on empty arrays: [].every(...) is true and used to
 * skip dealer hits when spectators had `hands: []`.
 */
function hasLivingStakedHand(state: GameState): boolean {
  return state.players.some((p) =>
    p.hands.some(
      (h) =>
        h.bet > 0 &&
        h.status !== "busted" &&
        h.status !== "surrendered",
    ),
  );
}

export function playDealerTurn(state: GameState): GameState {
  if (state.phase !== PHASE.DEALER_TURN) return state;

  let deck = [...state.deck];
  const dealerCards = state.dealer.cards.map((c) => ({ ...c, faceUp: true }));

  // If every staked hand is bust or surrender, only reveal hole — no draw
  if (hasLivingStakedHand(state)) {
    while (getHandValue(dealerCards) < DEALER_STAND_VALUE) {
      const result = drawCard(deck);
      dealerCards.push(result.card);
      deck = result.deck;
    }
  }

  const dealerValue = getHandValue(dealerCards);
  const dealerBusted = dealerValue > BLACKJACK_VALUE;

  return {
    ...state,
    deck,
    dealer: {
      cards: dealerCards,
      status: dealerBusted ? "busted" : "standing",
    },
    phase: PHASE.RESOLVING,
    message: dealerBusted
      ? `Dealer busts with ${dealerValue}!`
      : `Dealer stands on ${dealerValue}`,
  };
}

export function resolveRound(state: GameState): {
  state: GameState;
  results: GameResult[];
} {
  if (state.phase !== PHASE.RESOLVING) return { state, results: [] };

  const dealerValue = getHandValue(state.dealer.cards);
  const dealerBJ = isBlackjack(state.dealer.cards);
  const dealerBusted = state.dealer.status === "busted";
  const results: GameResult[] = [];
  const players = deepClonePlayers(state.players);

  for (const player of players) {
    for (let hi = 0; hi < player.hands.length; hi++) {
      const hand = player.hands[hi];
      if (hand.bet === 0) continue;

      if (hand.status === "surrendered") {
        results.push({
          playerId: player.id,
          handIndex: hi,
          outcome: "surrender",
          payout: 0,
        });
        continue;
      }

      if (hand.status === "busted") {
        results.push({
          playerId: player.id,
          handIndex: hi,
          outcome: "lose",
          payout: 0,
        });
        continue;
      }

      const handValue = getHandValue(hand.cards);
      const playerBJ = hand.status === "blackjack";

      if (playerBJ && !dealerBJ) {
        const payout = Math.floor(hand.bet * BLACKJACK_PAYOUT_MULTIPLIER);
        player.chips += payout;
        results.push({
          playerId: player.id,
          handIndex: hi,
          outcome: "blackjack",
          payout,
        });
      } else if (playerBJ && dealerBJ) {
        player.chips += hand.bet;
        results.push({
          playerId: player.id,
          handIndex: hi,
          outcome: "push",
          payout: hand.bet,
        });
      } else if (dealerBusted || handValue > dealerValue) {
        const payout = hand.bet * WIN_PAYOUT_MULTIPLIER;
        player.chips += payout;
        results.push({
          playerId: player.id,
          handIndex: hi,
          outcome: "win",
          payout,
        });
      } else if (handValue === dealerValue) {
        player.chips += hand.bet;
        results.push({
          playerId: player.id,
          handIndex: hi,
          outcome: "push",
          payout: hand.bet,
        });
      } else {
        results.push({
          playerId: player.id,
          handIndex: hi,
          outcome: "lose",
          payout: 0,
        });
      }
    }
  }

  let deck = state.deck;
  if (shouldReshuffle(deck, state.deckCount)) {
    deck = createShoe(state.deckCount);
  }

  const outcomeLabels: Record<string, string> = {
    blackjack: "Blackjack!",
    win: "You win!",
    lose: "You lose",
    push: "Push",
    surrender: "Surrendered",
  };

  const message = results.map((r) => outcomeLabels[r.outcome]).join(" | ");

  return {
    state: {
      ...state,
      deck,
      players,
      phase: PHASE.FINISHED,
      message,
      roundEndedAt: Date.now(),
    },
    results,
  };
}

/**
 * Chains dealer_turn → resolving → finished automatically.
 * Used by the hook to avoid dead states.
 */
export function runToCompletion(state: GameState): {
  state: GameState;
  results: GameResult[];
} {
  if (state.phase === PHASE.INSURANCE) {
    return { state, results: [] };
  }
  if (state.phase === PHASE.DEALER_TURN) {
    state = playDealerTurn(state);
  }
  if (state.phase === PHASE.RESOLVING) {
    return resolveRound(state);
  }
  return { state, results: [] };
}

export function startNewRound(state: GameState): GameState {
  const players = state.players.map((p) => {
    const { insuranceWager: _, ...rest } = p;
    return {
      ...rest,
      hands: [],
      activeHandIndex: 0,
    };
  });

  let deck = state.deck;
  if (shouldReshuffle(deck, state.deckCount)) {
    deck = createShoe(state.deckCount);
  }

  return {
    ...state,
    deck,
    phase: PHASE.BETTING,
    dealer: { cards: [], status: "playing" },
    players,
    activePlayerIndex: 0,
    message: "Place your bet",
  };
}

function deepClonePlayers(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    hands: p.hands.map((h) => ({ ...h, cards: [...h.cards] })),
  }));
}

// ── Multiplayer helpers ──

export function createMultiplayerGame(options: {
  minBet?: number;
  maxBet?: number;
  deckCount?: number;
}): GameState {
  const deckCount = options.deckCount ?? DEFAULT_DECK_COUNT;
  return {
    id: generateId(),
    phase: PHASE.WAITING,
    deck: createShoe(deckCount),
    dealer: { cards: [], status: "playing" },
    players: [],
    activePlayerIndex: 0,
    minBet: options.minBet ?? DEFAULT_MIN_BET,
    maxBet: options.maxBet ?? DEFAULT_MAX_BET,
    deckCount,
    message: "Waiting for players...",
  };
}

export function addPlayer(
  state: GameState,
  playerId: string,
  playerName: string,
): GameState {
  if (state.players.some((p) => p.id === playerId)) return state;

  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    chips: STARTING_CHIPS,
    hands: [],
    activeHandIndex: 0,
    isActive: true,
  };

  const midRound =
    state.phase === PHASE.PLAYING ||
    state.phase === PHASE.INSURANCE ||
    state.phase === PHASE.DEALER_TURN ||
    state.phase === PHASE.RESOLVING;

  return {
    ...state,
    players: [...state.players, newPlayer],
    message: midRound
      ? `${playerName} joined — wait for the next round`
      : state.players.length === 0
        ? `${playerName} joined. Waiting for more players...`
        : `${playerName} joined!`,
  };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const removedIndex = state.players.findIndex((p) => p.id === playerId);
  if (removedIndex === -1) return state;

  const players = state.players.filter((p) => p.id !== playerId);

  if (players.length === 0) {
    return { ...state, players, phase: PHASE.FINISHED, message: "" };
  }

  let { activePlayerIndex, phase } = state;
  let message = state.message;

  if (phase === PHASE.PLAYING) {
    if (removedIndex === activePlayerIndex) {
      // The active player left — find the next active hand
      if (activePlayerIndex >= players.length) {
        activePlayerIndex = 0;
      }
      const next = findNextActiveHand(players, activePlayerIndex, 0);
      if (next) {
        activePlayerIndex = next.playerIndex;
        players[next.playerIndex].activeHandIndex = next.handIndex;
        message = `${players[next.playerIndex].name}'s turn`;
      } else {
        phase = PHASE.DEALER_TURN;
        message = "Dealer's turn";
      }
    } else if (removedIndex < activePlayerIndex) {
      activePlayerIndex--;
    }
  }

  if (phase === PHASE.BETTING) {
    // If all remaining players already bet, proceed to deal
    const allBet = players.length > 0 &&
      players.every((p) => p.hands.length > 0 && p.hands[0].bet > 0);
    if (allBet) {
      const dealt = dealInitialCards({
        ...state, players, activePlayerIndex, phase, message,
      });
      const { state: completed } = runToCompletion(dealt);
      return completed;
    }
  }

  if (phase === PHASE.INSURANCE) {
    const st: GameState = { ...state, players, activePlayerIndex, phase, message };
    if (allInsuranceAnswered(st)) {
      return resolveInsurancePhase(st).state;
    }
  }

  return { ...state, players, activePlayerIndex, phase, message };
}

/** After {@link removePlayer}, finish the round if the table moved to dealer_turn mid player phase. */
export function completeRoundIfDealerTurnAfterLeave(
  stateBeforeRemove: GameState,
  stateAfterRemove: GameState,
): GameState {
  if (
    stateAfterRemove.phase === PHASE.DEALER_TURN &&
    (stateBeforeRemove.phase === PHASE.PLAYING ||
      stateBeforeRemove.phase === PHASE.INSURANCE)
  ) {
    return runToCompletion(stateAfterRemove).state;
  }
  return stateAfterRemove;
}

export function startBetting(state: GameState): GameState {
  if (state.players.length === 0) {
    return { ...state, message: "No players" };
  }
  const players = state.players.map((p) => {
    const { insuranceWager: _, ...rest } = p;
    return {
      ...rest,
      hands: [],
      activeHandIndex: 0,
      chips: p.chips < state.minBet ? p.chips + REBUY_CHIPS : p.chips,
    };
  });

  let deck = state.deck;
  if (shouldReshuffle(deck, state.deckCount)) {
    deck = createShoe(state.deckCount);
  }

  return {
    ...state,
    deck,
    phase: PHASE.BETTING,
    dealer: { cards: [], status: "playing" },
    players,
    activePlayerIndex: 0,
    message: "Place your bets!",
    roundEndedAt: undefined,
    bettingStartedAt: Date.now(),
    insuranceStartedAt: undefined,
  };
}

/** Transition from finished → betting after the results timer */
export function autoClearTable(state: GameState): GameState {
  if (state.phase !== PHASE.FINISHED) return state;
  return startBetting(state);
}

function formatPlayersRechargedMessage(names: string[]): string {
  if (names.length === 1) return `${names[0]} received a chip rebuy!`;
  if (names.length === 2) return `${names[0]} and ${names[1]} received chip rebuys!`;
  const head = names.slice(0, -1).join(", ");
  const tail = names[names.length - 1];
  return `${head} and ${tail} received chip rebuys!`;
}

/** Results phase: add REBUY_CHIPS to anyone below min bet (idempotent). */
export function autoRebuyBrokePlayersInResults(state: GameState): GameState {
  if (state.phase !== PHASE.FINISHED) return state;
  const min = state.minBet;
  const players = deepClonePlayers(state.players);
  const reboughtNames: string[] = [];
  for (let i = 0; i < players.length; i++) {
    if (players[i].chips < min) {
      players[i].chips += REBUY_CHIPS;
      reboughtNames.push(players[i].name);
    }
  }
  if (reboughtNames.length === 0) return state;
  return {
    ...state,
    players,
    message: formatPlayersRechargedMessage(reboughtNames),
  };
}

export function rebuyPlayer(state: GameState, playerId: string): GameState {
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return state;
  const p = state.players[idx];
  if (p.chips >= state.minBet) return state;
  if (p.hands.some((h) => h.bet > 0)) return state;

  const players = deepClonePlayers(state.players);
  players[idx].chips += REBUY_CHIPS;

  return {
    ...state,
    players,
    message: formatPlayersRechargedMessage([players[idx].name]),
  };
}

export function allBetsPlaced(state: GameState): boolean {
  return (
    state.phase === PHASE.BETTING &&
    state.players.length > 0 &&
    state.players.every((p) => p.hands.length > 0 && p.hands[0].bet > 0)
  );
}

/** Strip the deck from the state so it's safe to send to clients */
export function toClientState(state: GameState): ClientGameState {
  const { deck: _, ...clientState } = state;
  return clientState;
}

/** Serialize deck for storage */
export function serializeDeck(deck: Card[]): string {
  return JSON.stringify(deck);
}

/** Deserialize deck from storage */
export function deserializeDeck(data: string): Card[] {
  if (!data) return [];
  return JSON.parse(data) as Card[];
}
