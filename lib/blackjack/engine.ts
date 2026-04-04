import type {
  Card,
  ClientGameState,
  GameResult,
  GameState,
  Player,
  PlayerAction,
} from "./types";
import { createShoe, drawCard, shouldReshuffle } from "./deck";
import {
  canDoubleDown,
  canSplit,
  canSurrender,
  createHand,
  getHandValue,
  isBlackjack,
  isBusted,
} from "./hand";

const DEFAULT_DECK_COUNT = 6;
const DEFAULT_MIN_BET = 10;
const DEFAULT_MAX_BET = 500;
export const STARTING_CHIPS = 1000;

export function createGame(playerName: string): GameState {
  return {
    id: crypto.randomUUID(),
    phase: "betting",
    deck: createShoe(DEFAULT_DECK_COUNT),
    dealer: { cards: [], status: "playing" },
    players: [
      {
        id: crypto.randomUUID(),
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
    message: "Coloca tu apuesta",
  };
}

export function placeBet(
  state: GameState,
  playerId: string,
  amount: number,
): GameState {
  if (state.phase !== "betting") {
    return { ...state, message: "No es momento de apostar" };
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  if (amount < state.minBet || amount > state.maxBet) {
    return {
      ...state,
      message: `Apuesta debe ser entre $${state.minBet} y $${state.maxBet}`,
    };
  }
  if (amount > player.chips) {
    return { ...state, message: "No tienes suficientes fichas" };
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
  if (state.phase !== "betting") return state;

  const activePlayers = state.players.filter(
    (p) => p.hands.length > 0 && p.hands[0].bet > 0,
  );
  if (activePlayers.length === 0) {
    return { ...state, message: "Necesitas apostar primero" };
  }

  let deck = [...state.deck];
  const players = deepClonePlayers(state.players);
  const dealerCards = [];

  for (let round = 0; round < 2; round++) {
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

  const allSettled = players.every(
    (p) =>
      p.hands.length === 0 ||
      p.hands[0].bet === 0 ||
      p.hands[0].status !== "playing",
  );

  const firstActive = findNextActiveHand(players, 0, 0);

  return {
    ...state,
    deck,
    dealer: { cards: dealerCards, status: "playing" },
    players,
    phase: allSettled ? "dealer_turn" : "playing",
    activePlayerIndex: firstActive?.playerIndex ?? 0,
    message: allSettled
      ? "Turno del dealer"
      : `Turno de ${players[firstActive?.playerIndex ?? 0]?.name ?? ""}`,
  };
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
        ? ` - Mano ${next.handIndex + 1}`
        : "";
    return {
      ...state,
      players,
      activePlayerIndex: next.playerIndex,
      message: `Turno de ${nextPlayer.name}${handLabel}`,
    };
  }

  return { ...state, players, phase: "dealer_turn", message: "Turno del dealer" };
}

export function playerAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
): GameState {
  if (state.phase !== "playing") return state;

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1 || playerIndex !== state.activePlayerIndex) {
    return { ...state, message: "No es tu turno" };
  }

  const player = state.players[playerIndex];
  const hand = player.hands[player.activeHandIndex];
  if (!hand || hand.status !== "playing") return state;

  switch (action) {
    case "hit":
      return handleHit(state, playerIndex);
    case "stand":
      return handleStand(state, playerIndex);
    case "double":
      return handleDouble(state, playerIndex);
    case "split":
      return handleSplit(state, playerIndex);
    case "surrender":
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
  if (value > 21) {
    hand.status = "busted";
  } else if (value === 21) {
    hand.status = "standing";
  }

  let newState: GameState = { ...state, deck, players };

  if (hand.status !== "playing") {
    if (hand.status === "busted") {
      newState.message = `${player.name} se pasó!`;
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
    return { ...state, message: "No puedes doblar" };
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
    return { ...state, message: "No puedes dividir" };
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

  // 21 on a split hand is NOT blackjack — just auto-stand
  const v1 = getHandValue(hand.cards);
  if (v1 > 21) hand.status = "busted";
  else if (v1 === 21) hand.status = "standing";

  const v2 = getHandValue(newHand.cards);
  if (v2 > 21) newHand.status = "busted";
  else if (v2 === 21) newHand.status = "standing";

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
    return { ...state, message: "No puedes rendirte" };
  }

  hand.status = "surrendered";
  player.chips += Math.floor(hand.bet / 2);

  return advanceToNextPlayer({ ...state, players });
}

export function playDealerTurn(state: GameState): GameState {
  if (state.phase !== "dealer_turn") return state;

  let deck = [...state.deck];
  const dealerCards = state.dealer.cards.map((c) => ({ ...c, faceUp: true }));

  // If all players busted/surrendered, dealer just reveals — no need to draw
  const allPlayersBustedOrSurrendered = state.players.every((p) =>
    p.hands.every(
      (h) => h.bet === 0 || h.status === "busted" || h.status === "surrendered",
    ),
  );

  if (!allPlayersBustedOrSurrendered) {
    while (getHandValue(dealerCards) < 17) {
      const result = drawCard(deck);
      dealerCards.push(result.card);
      deck = result.deck;
    }
  }

  const dealerValue = getHandValue(dealerCards);
  const dealerBusted = dealerValue > 21;

  return {
    ...state,
    deck,
    dealer: {
      cards: dealerCards,
      status: dealerBusted ? "busted" : "standing",
    },
    phase: "resolving",
    message: dealerBusted
      ? `Dealer se pasó con ${dealerValue}!`
      : `Dealer se planta con ${dealerValue}`,
  };
}

export function resolveRound(state: GameState): {
  state: GameState;
  results: GameResult[];
} {
  if (state.phase !== "resolving") return { state, results: [] };

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
        const payout = Math.floor(hand.bet * 2.5);
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
        const payout = hand.bet * 2;
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
    win: "Ganaste!",
    lose: "Perdiste",
    push: "Empate",
    surrender: "Rendido",
  };

  const message = results.map((r) => outcomeLabels[r.outcome]).join(" | ");

  return {
    state: { ...state, deck, players, phase: "finished", message },
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
  if (state.phase === "dealer_turn") {
    state = playDealerTurn(state);
  }
  if (state.phase === "resolving") {
    return resolveRound(state);
  }
  return { state, results: [] };
}

export function startNewRound(state: GameState): GameState {
  const players = state.players.map((p) => ({
    ...p,
    hands: [],
    activeHandIndex: 0,
  }));

  let deck = state.deck;
  if (shouldReshuffle(deck, state.deckCount)) {
    deck = createShoe(state.deckCount);
  }

  return {
    ...state,
    deck,
    phase: "betting",
    dealer: { cards: [], status: "playing" },
    players,
    activePlayerIndex: 0,
    message: "Coloca tu apuesta",
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
    id: crypto.randomUUID(),
    phase: "waiting",
    deck: createShoe(deckCount),
    dealer: { cards: [], status: "playing" },
    players: [],
    activePlayerIndex: 0,
    minBet: options.minBet ?? DEFAULT_MIN_BET,
    maxBet: options.maxBet ?? DEFAULT_MAX_BET,
    deckCount,
    message: "Esperando jugadores...",
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
    state.phase === "playing" ||
    state.phase === "dealer_turn" ||
    state.phase === "resolving";

  return {
    ...state,
    players: [...state.players, newPlayer],
    message: midRound
      ? `${playerName} se unió — espera a la siguiente ronda`
      : state.players.length === 0
        ? `${playerName} se unió. Esperando más jugadores...`
        : `${playerName} se unió!`,
  };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  const removedIndex = state.players.findIndex((p) => p.id === playerId);
  if (removedIndex === -1) return state;

  const players = state.players.filter((p) => p.id !== playerId);

  if (players.length === 0) {
    return { ...state, players, phase: "finished", message: "" };
  }

  let { activePlayerIndex, phase } = state;
  let message = state.message;

  if (phase === "playing") {
    if (removedIndex === activePlayerIndex) {
      // The active player left — find the next active hand
      if (activePlayerIndex >= players.length) {
        activePlayerIndex = 0;
      }
      const next = findNextActiveHand(players, activePlayerIndex, 0);
      if (next) {
        activePlayerIndex = next.playerIndex;
        players[next.playerIndex].activeHandIndex = next.handIndex;
        message = `Turno de ${players[next.playerIndex].name}`;
      } else {
        phase = "dealer_turn";
        message = "Turno del dealer";
      }
    } else if (removedIndex < activePlayerIndex) {
      activePlayerIndex--;
    }
  }

  if (phase === "betting") {
    // If all remaining players already bet, proceed to deal
    const allBet = players.length > 0 &&
      players.every((p) => p.hands.length > 0 && p.hands[0].bet > 0);
    if (allBet) {
      let dealt = dealInitialCards({
        ...state, players, activePlayerIndex, phase, message,
      });
      const { state: completed } = runToCompletion(dealt);
      return completed;
    }
  }

  return { ...state, players, activePlayerIndex, phase, message };
}

export function startBetting(state: GameState): GameState {
  if (state.players.length === 0) {
    return { ...state, message: "No hay jugadores" };
  }
  const players = state.players.map((p) => ({
    ...p,
    hands: [],
    activeHandIndex: 0,
  }));

  let deck = state.deck;
  if (shouldReshuffle(deck, state.deckCount)) {
    deck = createShoe(state.deckCount);
  }

  return {
    ...state,
    deck,
    phase: "betting",
    dealer: { cards: [], status: "playing" },
    players,
    activePlayerIndex: 0,
    message: "Todos apuesten!",
  };
}

export function allBetsPlaced(state: GameState): boolean {
  return (
    state.phase === "betting" &&
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
