import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { dealerShouldHit, handTotal, totalLabel } from "./cards";
import { TIMING } from "./constants";
import { applyAction, createTableDoc, lobbySummary } from "./engine";
import { normalizeDoc } from "./normalize";
import { bustIt, hotThree, perfectPairs, twentyOnePlusThree } from "./sidebets";
import { basicStrategy } from "./strategy";
import { OFFICIAL_TABLES, officialConfig } from "./tables";
import type { EngineContext, PresenceStatus, TableAction, TableConfig, TableDoc } from "./types";

function rng(seed = 42) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Harness {
  doc: TableDoc;
  now = 1_000_000;
  random = rng();
  presence: Record<string, PresenceStatus> = {};
  effects: EngineContext["effects"] = [];

  constructor(overrides: Partial<TableConfig> = {}) {
    const preset = OFFICIAL_TABLES[0];
    this.doc = createTableDoc({ ...officialConfig(preset, 0), bots: 0, ...overrides }, this.now);
  }

  ctx(): EngineContext {
    return {
      now: this.now,
      rng: this.random,
      presence: (uid) => this.presence[uid] ?? "online",
      effects: this.effects,
    };
  }

  act(uid: string, action: TableAction) {
    applyAction(this.doc, uid, action, this.ctx());
    // Round-trip through JSON + normalize like the real database does.
    this.doc = normalizeDoc(JSON.parse(JSON.stringify(this.doc)), this.doc.config.id);
  }

  sit(uid: string, seat: number, buyIn = 1_000) {
    this.act(uid, { type: "sit", seat, buyIn, op: `op-${uid}`, name: uid, avatar: DEFAULT_AVATAR, level: 1 });
  }

  /** Puts the given cards on top of the shoe ("AS KD 7H ..."). */
  stack(cards: string) {
    const top = cards.split(/\s+/).filter(Boolean).join("");
    this.doc.secret.shoe = top + "9C".repeat(200);
  }

  /** Jumps to the current deadline and processes it. */
  expire() {
    this.now = Math.max(this.now, this.doc.state.phaseEndsAt);
    this.act("system", { type: "tick" });
  }

  get s() {
    return this.doc.state;
  }

  seat(i: number) {
    return this.doc.state.seats[i];
  }
}

describe("hand totals", () => {
  it("counts aces as 1 or 11", () => {
    expect(handTotal(["AS", "KD"])).toEqual({ total: 21, soft: true });
    expect(handTotal(["AS", "AD", "9C"])).toEqual({ total: 21, soft: true });
    expect(handTotal(["AS", "5D", "KC"])).toEqual({ total: 16, soft: false });
    expect(handTotal(["AS", "AD"])).toEqual({ total: 12, soft: true });
    expect(handTotal(["KS", "QD", "2C"])).toEqual({ total: 22, soft: false });
  });

  it("labels soft totals and blackjack", () => {
    const cards = (s: string) => s.split(" ").map((c, n) => ({ c, n }));
    expect(totalLabel({ cards: cards("AS 6D"), split: false })).toBe("7/17");
    expect(totalLabel({ cards: cards("AS KD"), split: false })).toBe("BJ");
    expect(totalLabel({ cards: cards("AS KD"), split: true })).toBe("21");
    expect(totalLabel({ cards: cards("TS 6D"), split: false })).toBe("16");
  });

  it("applies H17 and S17", () => {
    expect(dealerShouldHit(["AS", "6D"], true)).toBe(true);
    expect(dealerShouldHit(["AS", "6D"], false)).toBe(false);
    expect(dealerShouldHit(["TS", "7D"], true)).toBe(false);
    expect(dealerShouldHit(["TS", "6D"], false)).toBe(true);
  });
});

describe("round flow", () => {
  it("plays a full round and pays a win", () => {
    const h = new Harness();
    h.sit("ana", 0);
    expect(h.s.phase).toBe("betting");
    h.stack("TS 6D 9H TC 9S"); // P:T,9=19  D:6,T=16 then draws 9 -> 25 bust
    h.act("ana", { type: "bet", amount: 100 });
    expect(h.seat(0).stack).toBe(900);
    h.act("ana", { type: "ready" });
    expect(h.s.phase).toBe("dealing");
    expect(h.seat(0).hands[0].cards.map((c) => c.c)).toEqual(["TS", "9H"]);
    expect(h.s.dealer.cards.map((c) => c.c)).toEqual(["6D", "XX"]);
    expect(h.doc.secret.hole).toBe("TC");

    h.expire();
    expect(h.s.phase).toBe("playing");
    expect(h.s.turn).toEqual({ seat: 0, hand: 0 });
    h.act("ana", { type: "stand" });
    expect(h.s.phase).toBe("dealer");
    expect(h.s.dealer.cards.map((c) => c.c)).toEqual(["6D", "TC", "9S"]);

    h.expire();
    expect(h.s.phase).toBe("payout");
    expect(h.seat(0).hands[0].result).toBe("win");
    expect(h.seat(0).stack).toBe(1_100);
    expect(h.seat(0).net).toBe(100);
    expect(h.effects.some((e) => e.type === "stats" && e.uid === "ana")).toBe(true);

    h.expire();
    expect(h.s.phase).toBe("betting");
    expect(h.s.round).toBe(2);
    expect(h.seat(0).hands).toEqual([]);
    expect(h.seat(0).lastBet).toBe(100);
  });

  it("pays blackjack 3:2 without a dealer turn", () => {
    const h = new Harness();
    h.sit("ana", 2);
    h.stack("AS 9D KH 7C");
    h.act("ana", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.expire(); // dealing -> playing has nothing to do -> dealer
    expect(h.s.phase).toBe("dealer");
    expect(h.s.dealer.cards).toHaveLength(2);
    h.expire();
    expect(h.seat(2).hands[0].result).toBe("blackjack");
    expect(h.seat(2).stack).toBe(900 + 250);
  });

  it("pays 6:5 tables correctly", () => {
    const h = new Harness({ blackjackPays: 1.2 });
    h.sit("ana", 0);
    h.stack("AS 9D KH 7C");
    h.act("ana", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.expire();
    h.expire();
    expect(h.seat(0).stack).toBe(900 + 220);
  });

  it("doubles down for one card", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.stack("6S 9D 5H 8C TD 2C"); // P:6,5=11  D:9,8=17  double -> TD = 21
    h.act("ana", { type: "bet", amount: 50 });
    h.act("ana", { type: "ready" });
    h.expire();
    h.act("ana", { type: "double" });
    const hand = h.seat(0).hands[0];
    expect(hand.bet).toBe(100);
    expect(hand.doubled).toBe(true);
    expect(hand.cards.map((c) => c.c)).toEqual(["6S", "5H", "TD"]);
    expect(h.s.phase).toBe("dealer");
    h.expire();
    expect(h.seat(0).hands[0].result).toBe("win");
    expect(h.seat(0).stack).toBe(1_000 - 100 + 200);
  });

  it("splits pairs and plays each hand", () => {
    const h = new Harness();
    h.sit("ana", 0);
    // P: 8,8  D: 6,T. Split: hand0 gets 3 (11), double -> T (21). hand1 gets K (18) stand.
    // Dealer 16 draws 9 -> bust.
    h.stack("8S 6D 8H TC 3D TH KS 9S");
    h.act("ana", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.expire();
    h.act("ana", { type: "split" });
    expect(h.seat(0).hands).toHaveLength(2);
    expect(h.seat(0).hands[0].cards.map((c) => c.c)).toEqual(["8S", "3D"]);
    expect(h.seat(0).hands[1].cards.map((c) => c.c)).toEqual(["8H"]);
    expect(h.seat(0).stack).toBe(800);
    h.act("ana", { type: "double" });
    expect(h.s.turn).toEqual({ seat: 0, hand: 1 });
    expect(h.seat(0).hands[1].cards.map((c) => c.c)).toEqual(["8H", "KS"]);
    h.act("ana", { type: "stand" });
    expect(h.s.phase).toBe("dealer");
    h.expire();
    const [a, b] = h.seat(0).hands;
    expect(a.result).toBe("win");
    expect(b.result).toBe("win");
    expect(h.seat(0).stack).toBe(700 + 400 + 200);
  });

  it("gives split aces a single card each", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.stack("AS 7D AH TC KD 5S"); // split aces -> A+K = 21, A+5 = 16
    h.act("ana", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.expire();
    h.act("ana", { type: "split" });
    const hands = h.seat(0).hands;
    expect(hands.every((x) => x.done)).toBe(true);
    expect(hands[0].cards.map((c) => c.c)).toEqual(["AS", "KD"]);
    expect(hands[1].cards.map((c) => c.c)).toEqual(["AH", "5S"]);
    expect(h.s.phase).toBe("dealer");
    h.expire();
    // 21 after a split is not a blackjack: it pays 1:1. Dealer 17 beats 16.
    expect(h.seat(0).hands[0].result).toBe("win");
    expect(h.seat(0).hands[1].result).toBe("lose");
    expect(h.seat(0).stack).toBe(800 + 200);
  });

  it("returns half the bet on surrender", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.stack("TS TD 6H 7C");
    h.act("ana", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.expire();
    h.act("ana", { type: "surrender" });
    h.expire();
    expect(h.seat(0).hands[0].result).toBe("surrender");
    expect(h.seat(0).stack).toBe(950);
  });

  it("handles insurance against a dealer blackjack", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.sit("beto", 1);
    h.stack("TS 9C AD 7H 8S KD"); // ana T,7=17  beto 9,8=17  dealer A,K = blackjack
    h.act("ana", { type: "bet", amount: 100 });
    h.act("beto", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.act("beto", { type: "ready" });
    h.expire();
    expect(h.s.phase).toBe("insurance");
    h.act("ana", { type: "insurance", take: true });
    expect(h.seat(0).stack).toBe(850);
    h.act("beto", { type: "insurance", take: false });
    expect(h.s.phase).toBe("dealer");
    expect(h.s.dealerBlackjack).toBe(true);
    h.expire();
    expect(h.seat(0).hands[0].result).toBe("lose");
    expect(h.seat(0).stack).toBe(850 + 150);
    expect(h.seat(1).stack).toBe(900);
  });

  it("loses the insurance when the dealer has no blackjack", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.stack("TS AD 9H 6C"); // ana T,9=19  dealer A,6
    h.act("ana", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.expire();
    h.act("ana", { type: "insurance", take: true });
    expect(h.s.phase).toBe("playing");
    expect(h.s.peeked).toBe(true);
    h.act("ana", { type: "stand" });
    h.expire();
    // Dealer soft 17 stands (S17): 19 beats 17.
    expect(h.seat(0).hands[0].result).toBe("win");
    expect(h.seat(0).stack).toBe(1_000 - 150 + 200);
  });

  it("stands automatically when the turn times out", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.stack("TS 6D 7H TC 5C");
    h.act("ana", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.expire();
    expect(h.s.phase).toBe("playing");
    h.expire();
    expect(h.s.phase).toBe("dealer");
    expect(h.seat(0).hands[0].cards).toHaveLength(2);
    expect(h.seat(0).timeouts).toBe(1);
  });

  it("refuses invalid actions", () => {
    const h = new Harness();
    h.sit("ana", 0);
    expect(() => h.act("ana", { type: "hit" })).toThrow("No es tu turno");
    expect(() => h.act("ana", { type: "bet", amount: 5_000 })).toThrow();
    expect(() => h.act("ana", { type: "ready" })).toThrow("La apuesta mínima");
    expect(() => h.act("ana", { type: "bet", amount: 2_000 })).toThrow();
    h.act("ana", { type: "bet", amount: 300 });
    h.act("ana", { type: "clearBet" });
    expect(h.seat(0).stack).toBe(1_000);
    expect(() => h.sit("beto", 0)).toThrow("ocupado");
  });
});

describe("seats and presence", () => {
  it("cashes out immediately when leaving between hands", () => {
    const h = new Harness();
    h.sit("ana", 0, 700);
    h.act("ana", { type: "bet", amount: 50 });
    h.act("ana", { type: "leave" });
    expect(h.seat(0)).toBeUndefined();
    expect(h.s.phase).toBe("waiting");
    const pending = Object.values(h.doc.secret.pending);
    expect(pending).toEqual([{ uid: "ana", amount: 700, seatOp: "op-ana", ts: h.now }]);
  });

  it("finishes the hand before cashing out a player who leaves mid-round", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.sit("beto", 1);
    h.stack("TS 9S 6D 8H 9C TC 5C");
    h.act("ana", { type: "bet", amount: 100 });
    h.act("beto", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.act("beto", { type: "ready" });
    h.expire();
    expect(h.s.turn?.seat).toBe(0);
    h.act("ana", { type: "leave" });
    expect(h.seat(0).leaving).toBe(true);
    expect(h.s.turn?.seat).toBe(1);
    h.act("beto", { type: "stand" });
    h.expire(); // settle
    h.expire(); // next round removes ana
    expect(h.seat(0)).toBeUndefined();
    expect(h.doc.secret.pending["co_op-ana"].amount).toBe(h.doc.secret.pending["co_op-ana"].amount);
    expect(h.seat(1)).toBeDefined();
  });

  it("auto-plays and removes disconnected players", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.sit("beto", 1);
    h.stack("TS 9S 6D 8H 9C TC 5C");
    h.act("ana", { type: "bet", amount: 100 });
    h.act("beto", { type: "bet", amount: 100 });
    h.act("ana", { type: "ready" });
    h.act("beto", { type: "ready" });
    h.expire();
    h.presence.ana = "gone";
    h.act("beto", { type: "tick" });
    expect(h.s.turn?.seat).toBe(1);
    h.act("beto", { type: "stand" });
    h.expire();
    h.expire();
    expect(h.seat(0)).toBeUndefined();
    expect(h.doc.secret.pending["co_op-ana"]).toBeDefined();
  });

  it("fills the table with bots that play by themselves", () => {
    const h = new Harness({ bots: 3 });
    h.sit("ana", 3);
    const bots = Object.values(h.s.seats).filter((s) => s.bot);
    expect(bots).toHaveLength(3);
    // Bots occasionally sit a round out; the ones that bet are ready.
    const betting = bots.filter((b) => b.bet > 0);
    expect(betting.length).toBeGreaterThan(0);
    expect(betting.every((b) => b.ready && b.bet >= h.doc.config.minBet)).toBe(true);
    h.act("ana", { type: "bet", amount: 10 });
    h.act("ana", { type: "ready" });
    // Play until the next betting phase, standing on every human turn.
    for (let i = 0; i < 60 && h.s.round === 1; i++) {
      if (h.s.phase === "playing" && h.s.turn && h.seat(h.s.turn.seat)?.uid === "ana") {
        h.act("ana", { type: "stand" });
      } else {
        h.expire();
      }
    }
    expect(h.s.round).toBe(2);
    expect(h.s.phase).toBe("betting");
    const summary = lobbySummary(h.doc);
    expect(summary.humans).toBe(1);
    expect(summary.bots).toBe(3);
  });

  it("lets a person take a bot's seat between hands", () => {
    const h = new Harness({ bots: 6 });
    h.sit("ana", 0);
    const botSeat = Number(Object.keys(h.s.seats).find((k) => h.s.seats[k].bot));
    h.sit("beto", botSeat);
    expect(h.seat(botSeat).uid).toBe("beto");
  });

  it("fast-forwards the round when the last person leaves mid-hand", () => {
    const h = new Harness({ bots: 2 });
    h.sit("ana", 0);
    h.act("ana", { type: "bet", amount: 10 });
    h.act("ana", { type: "ready" });
    expect(h.s.phase).toBe("dealing");
    h.act("ana", { type: "leave" });
    h.act("system", { type: "tick" });
    expect(h.s.phase).toBe("waiting");
    expect(Object.keys(h.s.seats)).toHaveLength(0);
    expect(h.doc.secret.pending["co_op-ana"]).toBeDefined();
  });

  it("removes bots and goes idle when the last person leaves", () => {
    const h = new Harness({ bots: 2 });
    h.sit("ana", 0);
    h.act("ana", { type: "leave" });
    expect(Object.keys(h.s.seats)).toHaveLength(0);
    expect(h.s.phase).toBe("waiting");
  });

  it("deals immediately when every attentive player is ready", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.sit("beto", 1);
    h.presence.beto = "away";
    h.act("ana", { type: "bet", amount: 10 });
    h.act("ana", { type: "ready" });
    expect(h.s.phase).toBe("dealing");
    expect(h.seat(1).hands).toHaveLength(0);
    expect(h.now + TIMING.dealCard).toBeLessThan(h.s.phaseEndsAt);
  });
});

describe("side bets", () => {
  it("evaluates every combination", () => {
    expect(perfectPairs("7H", "7H")?.kind).toBe("perfect");
    expect(perfectPairs("7H", "7D")?.kind).toBe("colored");
    expect(perfectPairs("7H", "7S")?.kind).toBe("mixed");
    expect(perfectPairs("KH", "QH")).toBeNull();

    expect(twentyOnePlusThree("7H", "7H", "7H")?.kind).toBe("suitedTrips");
    expect(twentyOnePlusThree("5H", "6H", "7H")?.kind).toBe("straightFlush");
    expect(twentyOnePlusThree("7H", "7D", "7S")?.kind).toBe("trips");
    expect(twentyOnePlusThree("QS", "KH", "AD")?.kind).toBe("straight");
    expect(twentyOnePlusThree("AS", "2H", "3D")?.kind).toBe("straight");
    expect(twentyOnePlusThree("2H", "9H", "KH")?.kind).toBe("flush");
    expect(twentyOnePlusThree("2H", "9D", "KH")).toBeNull();

    expect(hotThree("7S", "7D", "7C")?.multiplier).toBe(100);
    expect(hotThree("KH", "QH", "AH")?.kind).toBe("suited21");
    expect(hotThree("TS", "9D", "2C")?.kind).toBe("21");
    expect(hotThree("9S", "KD", "AC")?.kind).toBe("20");
    expect(hotThree("TS", "9D", "KC")).toBeNull();

    expect(bustIt(["TS", "6D", "9C"])?.kind).toBe("bust3");
    expect(bustIt(["5S", "6D", "4C", "9H"])?.multiplier).toBe(2);
    expect(bustIt(["2S", "2D", "2C", "2H", "3S", "4D", "5C", "TH"])?.kind).toBe("bust8");
    expect(bustIt(["TS", "7D"])).toBeNull();
  });

  it("pays deal-time side bets immediately and counts them in the round", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.stack("7H 8H 7H 9C"); // perfect pair, 21+3 flush, Hot 3 = 22 (no)
    h.act("ana", { type: "bet", amount: 100 });
    for (const bet of ["pp", "t21", "hot3"] as const) h.act("ana", { type: "side", bet, amount: 10 });
    expect(h.seat(0).stack).toBe(870);
    h.act("ana", { type: "ready" });
    const seat = h.seat(0);
    expect(seat.sideResults.pp).toEqual({ kind: "perfect", payout: 260 });
    expect(seat.sideResults.t21).toEqual({ kind: "flush", payout: 60 });
    expect(seat.sideResults.hot3).toEqual({ kind: "none", payout: 0 });
    expect(seat.stack).toBe(870 + 320);
    h.expire();
    h.act("ana", { type: "stand" }); // 14 vs dealer 17
    h.expire();
    expect(h.seat(0).hands[0].result).toBe("lose");
    expect(h.seat(0).net).toBe(190);
    expect(h.seat(0).stack).toBe(1_190);
    h.expire();
    expect(h.seat(0).side).toEqual({ pp: 0, t21: 0, hot3: 0, bust: 0 });
    h.act("ana", { type: "repeat" });
    expect(h.seat(0).bet).toBe(100);
    expect(h.seat(0).side).toEqual({ pp: 10, t21: 10, hot3: 10, bust: 0 });
    expect(h.seat(0).stack).toBe(1_190 - 130);
  });

  it("pays Bust It by the number of dealer cards", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.stack("TS 6C 7D TD 9H"); // ana 17; dealer 6+10 draws 9 -> 25 with 3 cards
    h.act("ana", { type: "bet", amount: 100 });
    h.act("ana", { type: "side", bet: "bust", amount: 20 });
    h.act("ana", { type: "ready" });
    h.expire();
    h.act("ana", { type: "stand" });
    h.expire();
    const seat = h.seat(0);
    expect(seat.sideResults.bust).toEqual({ kind: "bust3", payout: 40 });
    expect(seat.hands[0].result).toBe("win");
    expect(seat.net).toBe(120);
    expect(seat.stack).toBe(1_120);
  });

  it("refunds side bets when clearing or sitting the round out", () => {
    const h = new Harness();
    h.sit("ana", 0);
    h.act("ana", { type: "side", bet: "pp", amount: 25 });
    h.act("ana", { type: "clearBet" });
    expect(h.seat(0).stack).toBe(1_000);
    h.act("ana", { type: "side", bet: "t21", amount: 25 });
    h.sit("beto", 1);
    h.act("beto", { type: "bet", amount: 10 });
    h.act("beto", { type: "ready" });
    h.expire(); // ana never placed a main bet
    expect(h.seat(0).side.t21).toBe(0);
    expect(h.seat(0).stack).toBe(1_000);
    expect(() => h.act("beto", { type: "side", bet: "pp", amount: 10 })).toThrow();
  });

  it("caps side bets", () => {
    const h = new Harness();
    h.sit("ana", 0);
    expect(() => h.act("ana", { type: "side", bet: "pp", amount: 1_000 })).toThrow("lateral máxima");
    const off = new Harness({ sideBets: false });
    off.sit("ana", 0);
    expect(() => off.act("ana", { type: "side", bet: "pp", amount: 10 })).toThrow("no tiene apuestas laterales");
  });
});

describe("normalization", () => {
  it("reads sparse seat arrays coming from the database", () => {
    const sparse: unknown[] = [];
    sparse[3] = { uid: "ana", stack: 10 };
    sparse[5] = { uid: "beto", stack: 20 };
    const doc = normalizeDoc({ state: { seats: sparse } }, "t");
    expect(Object.keys(doc.state.seats)).toEqual(["3", "5"]);
    expect(doc.state.seats[5].uid).toBe("beto");
  });
});

describe("basic strategy", () => {
  const all = { hit: true, stand: true, double: true, split: true, surrender: true };
  const rules = { hitSoft17: false, doubleAfterSplit: true };
  it("matches textbook plays", () => {
    expect(basicStrategy(["8S", "8D"], "TC", all, rules)).toBe("split");
    expect(basicStrategy(["TS", "6D"], "TC", all, rules)).toBe("surrender");
    expect(basicStrategy(["TS", "6D"], "TC", { ...all, surrender: false }, rules)).toBe("hit");
    expect(basicStrategy(["6S", "5D"], "6C", all, rules)).toBe("double");
    expect(basicStrategy(["AS", "7D"], "9C", all, rules)).toBe("hit");
    expect(basicStrategy(["AS", "7D"], "8C", all, rules)).toBe("stand");
    expect(basicStrategy(["TS", "2D"], "4C", all, rules)).toBe("stand");
    expect(basicStrategy(["TS", "TD"], "6C", all, rules)).toBe("stand");
  });
});
