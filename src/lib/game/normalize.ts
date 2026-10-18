import { normalizeAvatar } from "@/lib/avatar";
import { MAX_SEATS } from "./constants";
import type {
  SideBets,
  SideResult,
  DealtCard,
  Hand,
  PendingCashout,
  Seat,
  TableConfig,
  TableDoc,
  TableSecret,
  TableState,
  TableTheme,
} from "./types";

// Realtime Database drops empty arrays/objects and may return dense numeric-keyed
// objects as arrays (or sparse arrays as objects). Everything read from it goes
// through these helpers so the engine always sees complete, well-typed data.

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const bool = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);

export function list<T>(v: unknown, map: (item: unknown) => T): T[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => x != null).map(map);
  if (typeof v === "object") {
    return Object.keys(v as Raw)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (v as Raw)[k])
      .filter((x) => x != null)
      .map(map);
  }
  return [];
}

function card(v: unknown): DealtCard {
  const o = obj(v);
  return { c: str(o.c, "XX"), n: num(o.n) };
}

function hand(v: unknown): Hand {
  const o = obj(v);
  return {
    cards: list(o.cards, card),
    bet: num(o.bet),
    doubled: bool(o.doubled),
    split: bool(o.split),
    splitAces: bool(o.splitAces),
    done: bool(o.done),
    surrendered: bool(o.surrendered),
    result: (str(o.result) || null) as Hand["result"],
    payout: num(o.payout),
  };
}

function sideBets(v: unknown): SideBets {
  const o = obj(v);
  return { pp: num(o.pp), t21: num(o.t21), hot3: num(o.hot3), bust: num(o.bust) };
}

function sideResult(v: unknown): SideResult | null {
  if (!v || typeof v !== "object") return null;
  const o = obj(v);
  return { kind: str(o.kind, "none"), payout: num(o.payout) };
}

export function normalizeSeat(v: unknown): Seat {
  const o = obj(v);
  const results = obj(o.sideResults);
  return {
    uid: str(o.uid),
    name: str(o.name, "Jugador"),
    avatar: normalizeAvatar(o.avatar),
    level: num(o.level, 1),
    bot: bool(o.bot),
    op: str(o.op),
    stack: num(o.stack),
    bet: num(o.bet),
    lastBet: num(o.lastBet),
    side: sideBets(o.side),
    lastSide: sideBets(o.lastSide),
    sideResults: {
      pp: sideResult(results.pp),
      t21: sideResult(results.t21),
      hot3: sideResult(results.hot3),
      bust: sideResult(results.bust),
    },
    ready: bool(o.ready),
    hands: list(o.hands, hand),
    insurance: num(o.insurance),
    insuranceDecided: bool(o.insuranceDecided),
    net: num(o.net),
    missed: num(o.missed),
    timeouts: num(o.timeouts),
    afk: bool(o.afk),
    leaving: bool(o.leaving),
    joinedAt: num(o.joinedAt),
  };
}

export function normalizeSeats(v: unknown): Record<string, Seat> {
  const out: Record<string, Seat> = {};
  if (!v) return out;
  // Arrays from the database can be sparse (holes for empty seats).
  const entries: [string, unknown][] = [];
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) if (v[i] != null) entries.push([String(i), v[i]]);
  } else {
    entries.push(...Object.entries(obj(v)));
  }
  for (const [k, s] of entries) {
    if (s == null || !/^\d+$/.test(k) || Number(k) >= MAX_SEATS) continue;
    const seat = normalizeSeat(s);
    if (seat.uid) out[k] = seat;
  }
  return out;
}

const THEMES: TableTheme[] = ["emerald", "royal", "ruby", "onyx", "violet", "teal", "gold"];

export function normalizeConfig(v: unknown, id = ""): TableConfig {
  const o = obj(v);
  const theme = str(o.theme) as TableTheme;
  const doubleOn = str(o.doubleOn, "any");
  return {
    id: str(o.id, id),
    name: str(o.name, "Mesa"),
    minBet: Math.max(1, num(o.minBet, 10)),
    maxBet: Math.max(1, num(o.maxBet, 500)),
    decks: Math.min(8, Math.max(1, num(o.decks, 6))),
    hitSoft17: bool(o.hitSoft17),
    blackjackPays: num(o.blackjackPays, 1.5),
    surrender: bool(o.surrender, true),
    doubleAfterSplit: bool(o.doubleAfterSplit, true),
    doubleOn: doubleOn === "9-11" || doubleOn === "10-11" ? doubleOn : "any",
    maxHands: Math.min(4, Math.max(1, num(o.maxHands, 4))),
    resplitAces: bool(o.resplitAces),
    hitSplitAces: bool(o.hitSplitAces),
    insurance: bool(o.insurance, true),
    sideBets: bool(o.sideBets, true),
    penetration: Math.min(0.85, Math.max(0.5, num(o.penetration, 0.75))),
    seats: Math.min(MAX_SEATS, Math.max(1, num(o.seats, MAX_SEATS))),
    bots: Math.min(MAX_SEATS - 1, Math.max(0, num(o.bots, 0))),
    theme: THEMES.includes(theme) ? theme : "emerald",
    official: bool(o.official),
    isPrivate: bool(o.isPrivate),
    createdBy: str(o.createdBy) || null,
    createdAt: num(o.createdAt),
  };
}

export function normalizeState(v: unknown): TableState {
  const o = obj(v);
  const dealer = obj(o.dealer);
  const turn = o.turn ? obj(o.turn) : null;
  const shoe = obj(o.shoe);
  const phase = str(o.phase, "waiting") as TableState["phase"];
  return {
    phase,
    round: num(o.round, 1),
    phaseEndsAt: num(o.phaseEndsAt),
    turn: turn ? { seat: num(turn.seat), hand: num(turn.hand) } : null,
    seats: normalizeSeats(o.seats),
    dealer: { cards: list(dealer.cards, card), revealed: bool(dealer.revealed) },
    dealerBlackjack: bool(o.dealerBlackjack),
    peeked: bool(o.peeked),
    seq: num(o.seq),
    shoe: {
      remaining: num(shoe.remaining),
      total: num(shoe.total),
      cut: num(shoe.cut),
      shuffleId: num(shoe.shuffleId),
    },
    shuffling: bool(o.shuffling),
    updatedAt: num(o.updatedAt),
  };
}

function pending(v: unknown): Record<string, PendingCashout> {
  const out: Record<string, PendingCashout> = {};
  for (const [k, p] of Object.entries(obj(v))) {
    const o = obj(p);
    if (!o.uid) continue;
    out[k] = { uid: str(o.uid), amount: num(o.amount), seatOp: str(o.seatOp), ts: num(o.ts) };
  }
  return out;
}

export function normalizeSecret(v: unknown): TableSecret {
  const o = obj(v);
  return { shoe: str(o.shoe), hole: str(o.hole), pending: pending(o.pending) };
}

export function normalizeDoc(v: unknown, id = ""): TableDoc {
  const o = obj(v);
  return {
    config: normalizeConfig(o.config, id),
    state: normalizeState(o.state),
    secret: normalizeSecret(o.secret),
  };
}

/** Sorted numeric seat indices currently occupied. */
export function seatIndices(state: Pick<TableState, "seats">): number[] {
  return Object.keys(state.seats)
    .map(Number)
    .sort((a, b) => a - b);
}

export function findSeatOf(state: Pick<TableState, "seats">, uid: string): [number, Seat] | null {
  for (const idx of seatIndices(state)) {
    const seat = state.seats[idx];
    if (seat.uid === uid) return [idx, seat];
  }
  return null;
}
