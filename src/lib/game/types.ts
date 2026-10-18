import type { AvatarConfig } from "@/lib/avatar";
import type { SideBetId } from "./sidebets";

export type Suit = "S" | "H" | "D" | "C";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K";
/** Two characters, rank then suit: "AS", "TD", "7H". */
export type CardCode = string;
/** Placeholder for the dealer's face-down hole card in public state. */
export const HIDDEN_CARD = "XX";

export interface DealtCard {
  /** Card code, or HIDDEN_CARD while face down. */
  c: CardCode;
  /** Deal order inside the round; stable identity for animations. */
  n: number;
}

export type Phase = "waiting" | "betting" | "dealing" | "insurance" | "playing" | "dealer" | "payout";

export type HandResult = "blackjack" | "win" | "push" | "lose" | "bust" | "surrender";

export interface Hand {
  cards: DealtCard[];
  bet: number;
  doubled: boolean;
  /** Created by splitting a pair; a two-card 21 is then not a blackjack. */
  split: boolean;
  splitAces: boolean;
  done: boolean;
  surrendered: boolean;
  result: HandResult | null;
  /** Chips returned to the player at settlement, stake included. */
  payout: number;
}

/** Side bet stakes: Perfect Pairs, 21+3, Hot 3 and Bust It. */
export type SideBets = Record<SideBetId, number>;

export interface SideResult {
  /** Winning combination (see sidebets.ts) or "none". */
  kind: string;
  /** Chips returned, stake included (0 when lost). */
  payout: number;
}

export interface Seat {
  uid: string;
  name: string;
  avatar: AvatarConfig;
  level: number;
  bot: boolean;
  /** Sit operation id; ties the seat to the buy-in recorded on the user. */
  op: string;
  stack: number;
  /** Main bet being placed during the betting phase. */
  bet: number;
  lastBet: number;
  side: SideBets;
  lastSide: SideBets;
  sideResults: Record<SideBetId, SideResult | null>;
  ready: boolean;
  hands: Hand[];
  insurance: number;
  insuranceDecided: boolean;
  /** Net result of the last settled round (payouts minus wagers). */
  net: number;
  missed: number;
  timeouts: number;
  afk: boolean;
  leaving: boolean;
  joinedAt: number;
}

export interface TableConfig {
  id: string;
  name: string;
  minBet: number;
  maxBet: number;
  decks: number;
  hitSoft17: boolean;
  /** Blackjack payout ratio: 1.5 for 3:2, 1.2 for 6:5. */
  blackjackPays: number;
  surrender: boolean;
  doubleAfterSplit: boolean;
  doubleOn: "any" | "9-11" | "10-11";
  maxHands: number;
  resplitAces: boolean;
  hitSplitAces: boolean;
  insurance: boolean;
  /** Perfect Pairs, 21+3, Hot 3 and Bust It side bets. */
  sideBets: boolean;
  /** Fraction of the shoe dealt before reshuffling (0.5 - 0.85). */
  penetration: number;
  seats: number;
  bots: number;
  theme: TableTheme;
  official: boolean;
  isPrivate: boolean;
  createdBy: string | null;
  createdAt: number;
}

export type TableTheme = "emerald" | "royal" | "ruby" | "onyx" | "violet" | "teal" | "gold";

export interface DealerState {
  cards: DealtCard[];
  revealed: boolean;
}

export interface Turn {
  seat: number;
  hand: number;
}

export interface ShoeInfo {
  remaining: number;
  total: number;
  cut: number;
  shuffleId: number;
}

export interface TableState {
  phase: Phase;
  round: number;
  /** Server timestamp when the current phase (or turn) times out; 0 when idle. */
  phaseEndsAt: number;
  turn: Turn | null;
  seats: Record<string, Seat>;
  dealer: DealerState;
  dealerBlackjack: boolean;
  /** Dealer checked the hole card for blackjack this round. */
  peeked: boolean;
  /** Deal counter for the round; mirrors the highest DealtCard.n. */
  seq: number;
  shoe: ShoeInfo;
  /** True during the betting phase that follows a reshuffle (for the animation). */
  shuffling: boolean;
  updatedAt: number;
}

export interface PendingCashout {
  uid: string;
  amount: number;
  seatOp: string;
  ts: number;
}

export interface TableSecret {
  /** Remaining shoe as concatenated two-character card codes. */
  shoe: string;
  hole: string;
  pending: Record<string, PendingCashout>;
}

export interface TableDoc {
  config: TableConfig;
  state: TableState;
  secret: TableSecret;
}

export type PresenceStatus = "online" | "away" | "gone";

export interface StatsDelta {
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  busts: number;
  wagered: number;
  net: number;
  biggestWin: number;
  xp: number;
}

export type Effect =
  | { type: "cashout"; opId: string }
  | { type: "stats"; uid: string; delta: StatsDelta; stack: number }
  | { type: "seated"; uid: string; stack: number };

export interface EngineContext {
  now: number;
  /** Uniform random number in [0, 1). */
  rng: () => number;
  presence: (uid: string, seat: Seat) => PresenceStatus;
  effects: Effect[];
}

export type PlayerAction =
  | { type: "bet"; amount: number; mode?: "add" | "set" }
  | { type: "side"; bet: SideBetId; amount: number; mode?: "add" | "set" }
  | { type: "repeat" }
  | { type: "clearBet" }
  | { type: "ready" }
  | { type: "hit" }
  | { type: "stand" }
  | { type: "double" }
  | { type: "split" }
  | { type: "surrender" }
  | { type: "insurance"; take: boolean }
  | { type: "leave" }
  | { type: "tick" };

export type ServerAction =
  | {
      type: "sit";
      seat: number;
      buyIn: number;
      op: string;
      name: string;
      avatar: AvatarConfig;
      level: number;
    }
  | { type: "rebuy"; amount: number }
  | { type: "profile"; name: string; avatar: AvatarConfig; level: number };

export type TableAction = PlayerAction | ServerAction;

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}
