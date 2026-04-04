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
}

export type GamePhase =
  | "waiting"
  | "betting"
  | "dealing"
  | "playing"
  | "dealer_turn"
  | "resolving"
  | "finished";

export type PlayerAction =
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "surrender"
  | "bet";

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
}

export interface GameResult {
  playerId: string;
  handIndex: number;
  outcome: "win" | "lose" | "push" | "blackjack" | "surrender";
  payout: number;
}

export type TableStatus = "waiting" | "playing" | "finished";

export interface TableInfo {
  id: string;
  name: string;
  inviteCode: string;
  isPrivate: boolean;
  status: TableStatus;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  deckCount: number;
  createdBy: string;
  creatorId: string;
  playerCount: number;
  createdAt: string;
}

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
