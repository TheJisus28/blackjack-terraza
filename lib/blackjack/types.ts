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
