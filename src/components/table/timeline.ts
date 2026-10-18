import { TIMING } from "@/lib/game/constants";
import { seatIndices } from "@/lib/game/normalize";
import { HIDDEN_CARD, type Seat, type TableState } from "@/lib/game/types";

export interface CardTiming {
  /** performance.now() when the card leaves the shoe. */
  at: number;
  /** performance.now() when it turns face up (Infinity while hidden). */
  flipAt: number;
}

export type TimelineEvent = { at: number; kind: "deal" | "flip"; dealer: boolean };

export const cardKey = (round: number, n: number) => `${round}:${n}`;

/**
 * The server deals every card of a step at once; the client spreads their
 * arrival with the same pacing the server used for its deadlines. The first
 * snapshot is treated as history so late joiners do not replay old deals.
 */
export class DealTimeline {
  private cards = new Map<string, CardTiming>();
  private round = -1;
  private cursor = 0;
  private initialized = false;
  private pending: TimelineEvent[] = [];
  /** Until when the dealer is busy dealing (drives the dealer animation). */
  busyUntil = 0;
  /** Client time at which each phase was first observed. */
  phaseSince = 0;
  private phase = "";

  sync(state: TableState) {
    const now = performance.now();
    if (state.phase !== this.phase) {
      this.phase = state.phase;
      this.phaseSince = now;
    }
    if (state.round !== this.round) {
      this.cards.clear();
      this.round = state.round;
      this.cursor = now;
    }
    const entries: { key: string; n: number; code: string; dealer: boolean }[] = [];
    for (const idx of seatIndices(state)) {
      for (const hand of state.seats[idx].hands) {
        for (const c of hand.cards) entries.push({ key: cardKey(state.round, c.n), n: c.n, code: c.c, dealer: false });
      }
    }
    for (const c of state.dealer.cards) entries.push({ key: cardKey(state.round, c.n), n: c.n, code: c.c, dealer: true });
    entries.sort((a, b) => a.n - b.n);

    for (const e of entries) {
      const known = this.cards.get(e.key);
      if (!known) {
        if (!this.initialized) {
          this.cards.set(e.key, { at: now - 10_000, flipAt: e.code === HIDDEN_CARD ? Infinity : now - 10_000 });
          continue;
        }
        const interval = state.phase === "dealer" && e.dealer ? TIMING.dealerDraw : TIMING.dealCard;
        const at = Math.max(now, this.cursor + interval);
        this.cursor = at;
        this.cards.set(e.key, { at, flipAt: e.code === HIDDEN_CARD ? Infinity : at + 230 });
        this.pending.push({ at, kind: "deal", dealer: e.dealer });
        this.busyUntil = Math.max(this.busyUntil, at + 450);
      } else if (known.flipAt === Infinity && e.code !== HIDDEN_CARD) {
        const at = Math.max(now, this.cursor + 120);
        known.flipAt = at;
        this.cursor = at + TIMING.dealerReveal - TIMING.dealerDraw;
        this.pending.push({ at, kind: "flip", dealer: true });
        this.busyUntil = Math.max(this.busyUntil, at + 500);
      }
    }
    this.initialized = true;
  }

  timing(key: string): CardTiming | undefined {
    return this.cards.get(key);
  }

  /** Events scheduled since the last call (for sounds). */
  drain(): TimelineEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  /** When everything currently scheduled will have landed. */
  settledAt() {
    return this.cursor + 450;
  }
}

/** When every listed card has landed face up (client clock). */
export function handShowAt(cards: { n: number }[], round: number, timeline: DealTimeline) {
  let at = 0;
  for (const c of cards) {
    const t = timeline.timing(cardKey(round, c.n));
    if (!t) continue;
    at = Math.max(at, t.at + 430, Number.isFinite(t.flipAt) ? t.flipAt + 230 : 0);
  }
  return at;
}

/** When the cards deciding the deal-time side bets are all face up on the table. */
export function sideRevealAt(seat: Seat, state: TableState, timeline: DealTimeline) {
  const cards = [...(seat.hands[0]?.cards.slice(0, 2) ?? []), ...(state.dealer.cards[0] ? [state.dealer.cards[0]] : [])];
  return handShowAt(cards, state.round, timeline) + 400;
}
