export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "jack"
  | "queen"
  | "king"
  | "ace";

export interface Card {
  rank: Rank;
  suit: Suit;
  faceUp: boolean;
}

export type HandStatus =
  | "playing"
  | "standing"
  | "busted"
  | "blackjack"
  | "surrendered";

export interface Hand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  isDoubledDown: boolean;
  isSplit: boolean;
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  hands: Hand[];
  activeHandIndex: number;
  isActive: boolean;
  /** Watching only: no bets this round; chips kept for when they sit back in */
  spectator?: boolean;
  /** Client heartbeat (ms); used to detect offline spectators across betting rounds */
  lastSeenAt?: number;
  /** Finished→betting cycles spent offline while spectator; cleared when online or seated */
  spectatorOfflineRounds?: number;
  inactiveRounds?: number;
  /** Insurance: null = pending, 0 = declined, >0 = wager (pays 2:1 on dealer natural) */
  insuranceWager?: number | null;
}

import type { GamePhase } from "../meta/game-phase";
import type { PlayerAction } from "../meta/player-action-kind";

export type { GamePhase } from "../meta/game-phase";
export { PHASE } from "../meta/game-phase";
export type { PlayerAction } from "../meta/player-action-kind";
export { PLAYER_ACTION } from "../meta/player-action-kind";

export interface GameState {
  id: string;
  phase: GamePhase;
  deck: Card[];
  dealer: {
    cards: Card[];
    status: HandStatus;
  };
  players: Player[];
  activePlayerIndex: number;
  minBet: number;
  maxBet: number;
  deckCount: number;
  message: string;
  roundEndedAt?: number;
  bettingStartedAt?: number;
  insuranceStartedAt?: number;
  /** RESOLVING: wait before settle when dealer has natural and no player blackjack (see DEALER_BLACKJACK_REVEAL_*). */
  resolvingRevealStartedAt?: number;
}

export interface GameResult {
  playerId: string;
  handIndex: number;
  outcome: "win" | "lose" | "push" | "blackjack" | "surrender";
  payout: number;
}

export type TableStatus = "waiting" | "playing" | "finished";

/** State sent to clients — never includes the deck */
export type ClientGameState = Omit<GameState, "deck">;

export interface TableRow {
  id: string;
  name: string;
  invite_code: string;
  is_private: boolean;
  status: TableStatus;
  max_players: number;
  min_bet: number;
  max_bet: number;
  deck_count: number;
  game_state: ClientGameState;
  deck_data: string;
  created_by: string;
  creator_id: string;
  player_count: number;
  created_at: string;
}

/** JSON from `GET /api/tables/[id]` (Supabase row, snake_case; deck not exposed on this route). */
export type TableApiPayload = Omit<TableRow, "deck_data">;
