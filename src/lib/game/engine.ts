import { randomAvatar } from "@/lib/avatar";
import { buildShoe, cardValue, codes, dealerShouldHit, handTotal, handValue, isNatural, rankOf } from "./cards";
import { AFK_TIMEOUTS, BOT_NAMES, MAX_IDLE_ROUNDS, TIMING, XP } from "./constants";
import { findSeatOf, seatIndices } from "./normalize";
import { allowedActions } from "./rules";
import { bustIt, hotThree, maxSideBet, perfectPairs, SIDE_BET_IDS, twentyOnePlusThree, type SideBetId } from "./sidebets";
import { basicStrategy, safeMove, type Move } from "./strategy";
import {
  GameError,
  HIDDEN_CARD,
  type DealtCard,
  type EngineContext,
  type Hand,
  type HandResult,
  type PresenceStatus,
  type Seat,
  type ServerAction,
  type SideBets,
  type StatsDelta,
  type TableAction,
  type TableConfig,
  type TableDoc,
  type TableState,
} from "./types";

// ---------------------------------------------------------------------------
// The engine mutates a TableDoc in place. The server runs it inside a Realtime
// Database transaction, so every function here must be deterministic given the
// document, the clock and the RNG in the context (no I/O, no globals).
// ---------------------------------------------------------------------------

export function createTableDoc(config: TableConfig, now: number): TableDoc {
  const total = config.decks * 52;
  return {
    config,
    state: {
      phase: "waiting",
      round: 1,
      phaseEndsAt: 0,
      turn: null,
      seats: {},
      dealer: { cards: [], revealed: false },
      dealerBlackjack: false,
      peeked: false,
      seq: 0,
      shoe: { remaining: 0, total, cut: Math.round(total * (1 - config.penetration)), shuffleId: 0 },
      shuffling: false,
      updatedAt: now,
    },
    secret: { shoe: "", hole: "", pending: {} },
  };
}

export function applyAction(doc: TableDoc, actor: string, action: TableAction, ctx: EngineContext): void {
  advance(doc, ctx);
  switch (action.type) {
    case "tick":
      break;
    case "sit":
      sit(doc, actor, action, ctx);
      break;
    case "leave":
      leave(doc, actor, ctx);
      break;
    case "rebuy":
      rebuy(doc, actor, action.amount);
      break;
    case "profile":
      updateProfile(doc, actor, action);
      break;
    case "bet":
      placeBet(doc, actor, action.amount, action.mode ?? "add");
      break;
    case "side":
      placeSideBet(doc, actor, action.bet, action.amount, action.mode ?? "add");
      break;
    case "repeat":
      repeatBets(doc, actor);
      break;
    case "clearBet":
      clearBet(doc, actor);
      break;
    case "ready":
      markReady(doc, actor, ctx);
      break;
    case "insurance":
      decideInsurance(doc, actor, action.take, ctx);
      break;
    case "hit":
    case "stand":
    case "double":
    case "split":
    case "surrender":
      playMove(doc, actor, action.type, ctx);
      break;
  }
  doc.state.updatedAt = ctx.now;
}

/** Processes every deadline that has already passed. */
export function advance(doc: TableDoc, ctx: EngineContext): void {
  for (let guard = 0; guard < 300; guard++) {
    const s = doc.state;
    if (s.phase === "playing" && s.turn) {
      const seat = s.seats[s.turn.seat];
      if (!seat) {
        moveToNextHand(doc, ctx);
        continue;
      }
      if (!seat.bot && (seat.leaving || presenceOf(ctx, seat) === "gone")) {
        for (const h of seat.hands) h.done = true;
        moveToNextHand(doc, ctx);
        continue;
      }
    }
    if (s.phaseEndsAt > 0 && (ctx.now >= s.phaseEndsAt || fastForward(doc, ctx))) {
      onTimeout(doc, ctx);
      continue;
    }
    break;
  }
}

function onTimeout(doc: TableDoc, ctx: EngineContext) {
  switch (doc.state.phase) {
    case "betting":
      return closeBetting(doc, ctx);
    case "dealing":
      return afterDeal(doc, ctx);
    case "insurance":
      return resolveInsurance(doc, ctx);
    case "playing":
      return turnTimeout(doc, ctx);
    case "dealer":
      return settle(doc, ctx);
    case "payout":
      return nextRound(doc, ctx);
    default:
      doc.state.phaseEndsAt = 0;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function presenceOf(ctx: EngineContext, seat: Seat): PresenceStatus {
  return seat.bot ? "online" : ctx.presence(seat.uid, seat);
}

const humanIndices = (s: TableState) => seatIndices(s).filter((i) => !s.seats[i].bot);
const botIndices = (s: TableState) => seatIndices(s).filter((i) => s.seats[i].bot);

/** No human is watching their seat (or all are leaving): skip every animation delay. */
function fastForward(doc: TableDoc, ctx: EngineContext): boolean {
  const s = doc.state;
  return !humanIndices(s).some((i) => !s.seats[i].leaving && presenceOf(ctx, s.seats[i]) !== "gone");
}

function wait(doc: TableDoc, ctx: EngineContext, ms: number): number {
  return fastForward(doc, ctx) ? ctx.now : ctx.now + ms;
}

function requireSeat(s: TableState, uid: string): [number, Seat] {
  const found = findSeatOf(s, uid);
  if (!found) throw new GameError("No estás sentado en esta mesa");
  return found;
}

function touch(seat: Seat) {
  seat.timeouts = 0;
  seat.afk = false;
}

function newShoe(doc: TableDoc, ctx: EngineContext) {
  const cfg = doc.config;
  const total = cfg.decks * 52;
  doc.secret.shoe = buildShoe(cfg.decks, ctx.rng);
  doc.state.shoe = {
    remaining: total,
    total,
    cut: Math.round(total * (1 - cfg.penetration)),
    shuffleId: doc.state.shoe.shuffleId + 1,
  };
}

function needsShuffle(doc: TableDoc): boolean {
  const remaining = doc.secret.shoe.length / 2;
  const players = seatIndices(doc.state).length;
  return remaining === 0 || remaining < Math.max(doc.state.shoe.cut, 10 + players * 5);
}

function drawCode(doc: TableDoc, ctx: EngineContext): string {
  // Emergency reshuffle; the cut-card check at round start makes this rare.
  if (doc.secret.shoe.length < 2) newShoe(doc, ctx);
  const code = doc.secret.shoe.slice(0, 2);
  doc.secret.shoe = doc.secret.shoe.slice(2);
  doc.state.shoe.remaining = doc.secret.shoe.length / 2;
  return code;
}

function dealCard(doc: TableDoc, ctx: EngineContext): DealtCard {
  doc.state.seq += 1;
  return { c: drawCode(doc, ctx), n: doc.state.seq };
}

function emptyHand(bet: number): Hand {
  return {
    cards: [],
    bet,
    doubled: false,
    split: false,
    splitAces: false,
    done: false,
    surrendered: false,
    result: null,
    payout: 0,
  };
}

function emptyDelta(): StatsDelta {
  return { hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0, wagered: 0, net: 0, biggestWin: 0, xp: 0 };
}

const noSide = (): SideBets => ({ pp: 0, t21: 0, hot3: 0, bust: 0 });
const noSideResults = (): Seat["sideResults"] => ({ pp: null, t21: null, hot3: null, bust: null });

function newSeat(fields: Pick<Seat, "uid" | "name" | "avatar" | "level" | "bot" | "op" | "stack" | "joinedAt">): Seat {
  return {
    ...fields,
    bet: 0,
    lastBet: 0,
    side: noSide(),
    lastSide: noSide(),
    sideResults: noSideResults(),
    ready: false,
    hands: [],
    insurance: 0,
    insuranceDecided: false,
    net: 0,
    missed: 0,
    timeouts: 0,
    afk: false,
    leaving: false,
  };
}

const sideTotal = (seat: Seat) => SIDE_BET_IDS.reduce((sum, id) => sum + seat.side[id], 0);

function cashOutSeat(doc: TableDoc, ctx: EngineContext, idx: number) {
  const seat = doc.state.seats[idx];
  if (!seat) return;
  delete doc.state.seats[idx];
  if (seat.bot) return;
  const opId = `co_${seat.op}`;
  // Side stakes are still refundable here: they are cleared once consumed.
  const amount = seat.stack + seat.bet + sideTotal(seat);
  doc.secret.pending[opId] = { uid: seat.uid, amount, seatOp: seat.op, ts: ctx.now };
  ctx.effects.push({ type: "cashout", opId });
}

function removeAllBots(doc: TableDoc) {
  for (const i of botIndices(doc.state)) delete doc.state.seats[i];
}

function toWaiting(doc: TableDoc) {
  const s = doc.state;
  s.phase = "waiting";
  s.phaseEndsAt = 0;
  s.turn = null;
  s.shuffling = false;
}

/** Seats without cards in play that should go: leaving, disconnected or idle. */
function removeInactiveSeats(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  for (const idx of seatIndices(s)) {
    const seat = s.seats[idx];
    if (seat.bot || seat.hands.length > 0) continue;
    if (seat.leaving || presenceOf(ctx, seat) === "gone" || seat.missed >= MAX_IDLE_ROUNDS) {
      cashOutSeat(doc, ctx, idx);
    }
  }
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

function manageBots(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const cfg = doc.config;
  const humans = humanIndices(s);
  const bots = botIndices(s);
  if (humans.length === 0) {
    removeAllBots(doc);
    return;
  }
  // Always keep one seat free so another person can join.
  const target = Math.min(cfg.bots, Math.max(0, cfg.seats - humans.length - 1));
  if (bots.length > target) {
    for (const i of bots.slice(target)) delete s.seats[i];
    return;
  }
  const free: number[] = [];
  for (let i = 0; i < cfg.seats; i++) if (!s.seats[i]) free.push(i);
  const used = new Set(seatIndices(s).map((i) => s.seats[i].name));
  const names = BOT_NAMES.filter((n) => !used.has(n));
  for (let k = bots.length; k < target && free.length > 0; k++) {
    const seatIdx = free.splice(Math.floor(ctx.rng() * free.length), 1)[0];
    const name = names.length ? names.splice(Math.floor(ctx.rng() * names.length), 1)[0] : `Bot ${seatIdx + 1}`;
    const uid = `bot_${seatIdx}_${s.round}`;
    s.seats[seatIdx] = newSeat({
      uid,
      name,
      avatar: randomAvatar(ctx.rng),
      level: 1 + Math.floor(ctx.rng() * 24),
      bot: true,
      op: uid,
      stack: cfg.minBet * (40 + Math.floor(ctx.rng() * 80)),
      joinedAt: ctx.now,
    });
  }
}

function botsBet(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const cfg = doc.config;
  const multipliers = [1, 1, 1, 2, 2, 3, 4, 5];
  for (const i of botIndices(s)) {
    const seat = s.seats[i];
    // Occasionally a bot sits a round out, like real players do.
    if (ctx.rng() < 0.08) continue;
    const mult = multipliers[Math.floor(ctx.rng() * multipliers.length)];
    const bet = Math.min(cfg.maxBet, cfg.minBet * mult);
    if (seat.stack < bet) seat.stack += cfg.minBet * 60;
    seat.stack -= bet;
    seat.bet = bet;
    if (cfg.sideBets) {
      const side = Math.max(1, Math.min(maxSideBet(cfg.maxBet), Math.floor(cfg.minBet / 2)));
      for (const id of SIDE_BET_IDS) {
        if (ctx.rng() < (id === "bust" ? 0.12 : 0.18) && seat.stack >= side) {
          seat.stack -= side;
          seat.side[id] = side;
        }
      }
    }
    seat.ready = true;
  }
}

// ---------------------------------------------------------------------------
// Seating
// ---------------------------------------------------------------------------

function sit(doc: TableDoc, actor: string, action: Extract<ServerAction, { type: "sit" }>, ctx: EngineContext) {
  const s = doc.state;
  const cfg = doc.config;
  if (!Number.isInteger(action.seat) || action.seat < 0 || action.seat >= cfg.seats) {
    throw new GameError("Asiento inválido");
  }
  if (findSeatOf(s, actor)) throw new GameError("Ya estás sentado en esta mesa");
  const occupant = s.seats[action.seat];
  if (occupant) {
    if (!occupant.bot || occupant.hands.length > 0) throw new GameError("Ese asiento está ocupado");
    // Bots give their seat to people between hands.
    delete s.seats[action.seat];
  }
  s.seats[action.seat] = newSeat({
    uid: actor,
    name: action.name,
    avatar: action.avatar,
    level: action.level,
    bot: false,
    op: action.op,
    stack: action.buyIn,
    joinedAt: ctx.now,
  });
  if (s.phase === "waiting") startBetting(doc, ctx);
}

function leave(doc: TableDoc, actor: string, ctx: EngineContext) {
  const s = doc.state;
  const found = findSeatOf(s, actor);
  if (!found) return;
  const [idx, seat] = found;
  if (seat.hands.length === 0) {
    cashOutSeat(doc, ctx, idx);
    if (humanIndices(s).length === 0) {
      if (s.phase === "waiting" || s.phase === "betting") {
        removeAllBots(doc);
        toWaiting(doc);
      }
    } else if (s.phase === "betting") {
      maybeStartDeal(doc, ctx);
    }
    return;
  }
  // Cards in play: the seat stays until the round ends and plays itself out.
  seat.leaving = true;
  if (s.phase === "playing" && s.turn?.seat === idx) {
    for (const h of seat.hands) h.done = true;
    moveToNextHand(doc, ctx);
  } else if (s.phase === "insurance" && !seat.insuranceDecided) {
    seat.insuranceDecided = true;
    if (allInsuranceDecided(s)) resolveInsurance(doc, ctx);
  }
}

function rebuy(doc: TableDoc, actor: string, amount: number) {
  const [, seat] = requireSeat(doc.state, actor);
  if (seat.hands.length > 0) throw new GameError("Espera a que termine la mano para recargar");
  if (!Number.isInteger(amount) || amount <= 0) throw new GameError("Cantidad inválida");
  seat.stack += amount;
  seat.leaving = false;
  touch(seat);
}

function updateProfile(doc: TableDoc, actor: string, action: Extract<ServerAction, { type: "profile" }>) {
  const found = findSeatOf(doc.state, actor);
  if (!found) return;
  const seat = found[1];
  seat.name = action.name;
  seat.avatar = action.avatar;
  seat.level = action.level;
}

// ---------------------------------------------------------------------------
// Betting
// ---------------------------------------------------------------------------

function startBetting(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const shuffled = needsShuffle(doc);
  if (shuffled) newShoe(doc, ctx);
  s.shuffling = shuffled;
  s.phase = "betting";
  s.turn = null;
  for (const idx of seatIndices(s)) {
    const seat = s.seats[idx];
    seat.ready = false;
    seat.net = 0;
    seat.hands = [];
    seat.insurance = 0;
    seat.insuranceDecided = false;
    seat.sideResults = noSideResults();
  }
  manageBots(doc, ctx);
  botsBet(doc, ctx);
  s.phaseEndsAt = wait(doc, ctx, TIMING.betting + (shuffled ? TIMING.shuffle : 0));
}

function placeBet(doc: TableDoc, actor: string, amount: number, mode: "add" | "set") {
  const s = doc.state;
  const cfg = doc.config;
  if (s.phase !== "betting") throw new GameError("Las apuestas están cerradas");
  const [, seat] = requireSeat(s, actor);
  if (seat.leaving) throw new GameError("Estás saliendo de la mesa");
  if (!Number.isFinite(amount)) throw new GameError("Cantidad inválida");
  const value = Math.floor(amount);
  const target = mode === "set" ? value : seat.bet + value;
  if (target < 0) throw new GameError("Cantidad inválida");
  if (target > cfg.maxBet) throw new GameError(`La apuesta máxima es ${cfg.maxBet.toLocaleString("es-CO")}`);
  const available = seat.stack + seat.bet;
  if (target > available) throw new GameError("No tienes suficientes fichas en la mesa");
  seat.stack = available - target;
  seat.bet = target;
  seat.ready = false;
  seat.missed = 0;
  touch(seat);
}

function placeSideBet(doc: TableDoc, actor: string, id: SideBetId, amount: number, mode: "add" | "set") {
  const s = doc.state;
  const cfg = doc.config;
  if (!cfg.sideBets) throw new GameError("Esta mesa no tiene apuestas laterales");
  if (s.phase !== "betting") throw new GameError("Las apuestas están cerradas");
  const [, seat] = requireSeat(s, actor);
  if (seat.leaving) throw new GameError("Estás saliendo de la mesa");
  if (!Number.isFinite(amount)) throw new GameError("Cantidad inválida");
  const value = Math.floor(amount);
  const target = mode === "set" ? value : seat.side[id] + value;
  const max = maxSideBet(cfg.maxBet);
  if (target < 0) throw new GameError("Cantidad inválida");
  if (target > max) throw new GameError(`La apuesta lateral máxima es ${max.toLocaleString("es-CO")}`);
  const available = seat.stack + seat.side[id];
  if (target > available) throw new GameError("No tienes suficientes fichas en la mesa");
  seat.stack = available - target;
  seat.side[id] = target;
  seat.ready = false;
  touch(seat);
}

/** Puts back last round's main and side bets in one step. */
function repeatBets(doc: TableDoc, actor: string) {
  const s = doc.state;
  const cfg = doc.config;
  if (s.phase !== "betting") throw new GameError("Las apuestas están cerradas");
  const [, seat] = requireSeat(s, actor);
  if (!seat.lastBet) throw new GameError("No hay una apuesta anterior");
  const side = cfg.sideBets ? { ...seat.lastSide } : noSide();
  const pool = seat.stack + seat.bet + sideTotal(seat);
  const wanted = Math.min(seat.lastBet, cfg.maxBet) + SIDE_BET_IDS.reduce((sum, id) => sum + side[id], 0);
  if (wanted > pool) throw new GameError("No tienes suficientes fichas para repetir");
  seat.bet = Math.min(seat.lastBet, cfg.maxBet);
  seat.side = side;
  seat.stack = pool - wanted;
  seat.ready = false;
  seat.missed = 0;
  touch(seat);
}

function clearBet(doc: TableDoc, actor: string) {
  const s = doc.state;
  if (s.phase !== "betting") throw new GameError("Las apuestas están cerradas");
  const [, seat] = requireSeat(s, actor);
  seat.stack += seat.bet + sideTotal(seat);
  seat.bet = 0;
  seat.side = noSide();
  seat.ready = false;
  touch(seat);
}

function markReady(doc: TableDoc, actor: string, ctx: EngineContext) {
  const s = doc.state;
  if (s.phase !== "betting") throw new GameError("Las apuestas están cerradas");
  const [, seat] = requireSeat(s, actor);
  if (seat.bet < doc.config.minBet) {
    throw new GameError(`La apuesta mínima es ${doc.config.minBet.toLocaleString("es-CO")}`);
  }
  seat.ready = true;
  seat.missed = 0;
  touch(seat);
  maybeStartDeal(doc, ctx);
}

/** Deals right away once every attentive person at the table has confirmed. */
function maybeStartDeal(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  if (s.phase !== "betting") return;
  const humans = humanIndices(s).map((i) => s.seats[i]);
  const attentive = humans.filter((seat) => !seat.leaving && !seat.afk && presenceOf(ctx, seat) === "online");
  if (humans.some((seat) => seat.ready) && attentive.every((seat) => seat.ready)) closeBetting(doc, ctx);
}

function closeBetting(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const cfg = doc.config;
  const participants: number[] = [];
  for (const idx of seatIndices(s)) {
    const seat = s.seats[idx];
    if (!seat.leaving && presenceOf(ctx, seat) !== "gone" && seat.bet >= cfg.minBet) {
      participants.push(idx);
      continue;
    }
    if (seat.bet > 0 || sideTotal(seat) > 0) {
      seat.stack += seat.bet + sideTotal(seat);
      seat.bet = 0;
      seat.side = noSide();
    }
    seat.ready = false;
    if (!seat.bot) seat.missed += 1;
  }
  removeInactiveSeats(doc, ctx);
  if (humanIndices(s).length === 0) {
    removeAllBots(doc);
    toWaiting(doc);
    return;
  }
  const playing = participants.filter((i) => s.seats[i]);
  if (playing.length === 0) {
    startBetting(doc, ctx);
    return;
  }
  deal(doc, ctx, playing);
}

// ---------------------------------------------------------------------------
// Dealing, insurance and peek
// ---------------------------------------------------------------------------

function deal(doc: TableDoc, ctx: EngineContext, participants: number[]) {
  const s = doc.state;
  s.seq = 0;
  s.dealer = { cards: [], revealed: false };
  s.dealerBlackjack = false;
  s.peeked = false;
  s.shuffling = false;
  doc.secret.hole = "";
  for (const idx of participants) {
    const seat = s.seats[idx];
    seat.hands = [emptyHand(seat.bet)];
    seat.lastBet = seat.bet;
    seat.lastSide = { ...seat.side };
    seat.sideResults = noSideResults();
    seat.bet = 0;
    seat.ready = false;
    seat.missed = 0;
    seat.insurance = 0;
    seat.insuranceDecided = false;
    seat.net = 0;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const idx of participants) s.seats[idx].hands[0].cards.push(dealCard(doc, ctx));
    if (pass === 0) {
      s.dealer.cards.push(dealCard(doc, ctx));
    } else {
      s.seq += 1;
      doc.secret.hole = drawCode(doc, ctx);
      s.dealer.cards.push({ c: HIDDEN_CARD, n: s.seq });
    }
  }
  for (const idx of participants) {
    const hand = s.seats[idx].hands[0];
    if (isNatural(hand)) hand.done = true;
  }
  resolveSideBets(doc, participants);
  s.phase = "dealing";
  s.turn = null;
  s.phaseEndsAt = wait(doc, ctx, s.seq * TIMING.dealCard + TIMING.dealExtra);
}

/** Side bets only need the first two cards and the up card, so they pay right after the deal. */
function resolveSideBets(doc: TableDoc, participants: number[]) {
  const s = doc.state;
  const up = s.dealer.cards[0]?.c;
  for (const idx of participants) {
    const seat = s.seats[idx];
    const [a, b] = seat.hands[0].cards.map((c) => c.c);
    if (seat.side.pp > 0) {
      const win = perfectPairs(a, b);
      const payout = win ? seat.side.pp * (win.multiplier + 1) : 0;
      seat.sideResults.pp = { kind: win?.kind ?? "none", payout };
      seat.stack += payout;
    }
    if (seat.side.t21 > 0 && up) {
      const win = twentyOnePlusThree(a, b, up);
      const payout = win ? seat.side.t21 * (win.multiplier + 1) : 0;
      seat.sideResults.t21 = { kind: win?.kind ?? "none", payout };
      seat.stack += payout;
    }
    if (seat.side.hot3 > 0 && up) {
      const win = hotThree(a, b, up);
      const payout = win ? seat.side.hot3 * (win.multiplier + 1) : 0;
      seat.sideResults.hot3 = { kind: win?.kind ?? "none", payout };
      seat.stack += payout;
    }
  }
}

const participantSeats = (s: TableState) =>
  seatIndices(s)
    .map((i) => s.seats[i])
    .filter((seat) => seat.hands.length > 0);

function allInsuranceDecided(s: TableState): boolean {
  return participantSeats(s).every((seat) => seat.insuranceDecided);
}

function afterDeal(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const up = s.dealer.cards[0]?.c;
  if (up && rankOf(up) === "A" && doc.config.insurance) {
    s.phase = "insurance";
    for (const seat of participantSeats(s)) {
      const cost = Math.floor(seat.hands[0].bet / 2);
      // Bots follow basic strategy and never insure.
      seat.insuranceDecided = seat.bot || seat.leaving || cost < 1 || seat.stack < cost;
    }
    if (allInsuranceDecided(s)) {
      resolveInsurance(doc, ctx);
      return;
    }
    s.phaseEndsAt = wait(doc, ctx, TIMING.insurance);
    return;
  }
  peekAndPlay(doc, ctx);
}

function decideInsurance(doc: TableDoc, actor: string, take: boolean, ctx: EngineContext) {
  const s = doc.state;
  if (s.phase !== "insurance") throw new GameError("No es momento de seguro");
  const [, seat] = requireSeat(s, actor);
  if (seat.hands.length === 0) throw new GameError("No tienes mano en esta ronda");
  if (seat.insuranceDecided) throw new GameError("Ya decidiste el seguro");
  if (take) {
    const cost = Math.floor(seat.hands[0].bet / 2);
    if (cost < 1 || seat.stack < cost) throw new GameError("No tienes fichas suficientes para el seguro");
    seat.stack -= cost;
    seat.insurance = cost;
  }
  seat.insuranceDecided = true;
  touch(seat);
  if (allInsuranceDecided(s)) resolveInsurance(doc, ctx);
}

function resolveInsurance(doc: TableDoc, ctx: EngineContext) {
  for (const seat of participantSeats(doc.state)) seat.insuranceDecided = true;
  peekAndPlay(doc, ctx);
}

function revealHole(doc: TableDoc) {
  const s = doc.state;
  const hole = s.dealer.cards[1];
  if (!s.dealer.revealed && hole) {
    s.dealer.cards[1] = { c: doc.secret.hole || hole.c, n: hole.n };
    doc.secret.hole = "";
  }
  s.dealer.revealed = true;
}

function peekAndPlay(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const up = s.dealer.cards[0]?.c;
  if (up && cardValue(up) >= 10) {
    s.peeked = true;
    if (doc.secret.hole && handTotal([up, doc.secret.hole]).total === 21) {
      s.dealerBlackjack = true;
      revealHole(doc);
      s.phase = "dealer";
      s.turn = null;
      s.phaseEndsAt = wait(doc, ctx, TIMING.dealerReveal + TIMING.dealerExtra);
      return;
    }
  }
  s.phase = "playing";
  s.turn = null;
  moveToNextHand(doc, ctx);
}

// ---------------------------------------------------------------------------
// Player turns
// ---------------------------------------------------------------------------

function turnDuration(doc: TableDoc, ctx: EngineContext, seat: Seat): number {
  if (seat.bot) return TIMING.botThink + Math.floor(ctx.rng() * TIMING.botThinkJitter);
  if (presenceOf(ctx, seat) === "away") return TIMING.turnAway;
  if (seat.afk) return TIMING.turnAfk;
  return TIMING.turn;
}

/** A hand that cannot take more decisions is closed automatically. */
function autoComplete(cfg: TableConfig, seat: Seat, handIdx: number) {
  const hand = seat.hands[handIdx];
  if (handValue(hand).total >= 21) {
    hand.done = true;
    return;
  }
  if (hand.splitAces && !cfg.hitSplitAces && !allowedActions(cfg, seat, handIdx).split) hand.done = true;
}

/** Activates the first unfinished hand in seat order, or hands over to the dealer. */
function moveToNextHand(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const cfg = doc.config;
  for (const idx of seatIndices(s)) {
    const seat = s.seats[idx];
    for (let h = 0; h < seat.hands.length; h++) {
      const hand = seat.hands[h];
      if (hand.done) continue;
      let dealt = false;
      if (hand.cards.length < 2) {
        hand.cards.push(dealCard(doc, ctx));
        dealt = true;
        autoComplete(cfg, seat, h);
        if (hand.done) continue;
      }
      if (!seat.bot && (seat.leaving || presenceOf(ctx, seat) === "gone")) {
        hand.done = true;
        continue;
      }
      s.turn = { seat: idx, hand: h };
      s.phaseEndsAt = wait(doc, ctx, turnDuration(doc, ctx, seat) + (dealt ? TIMING.dealCard : 0));
      return;
    }
  }
  s.turn = null;
  startDealer(doc, ctx);
}

function playMove(doc: TableDoc, actor: string, move: Move, ctx: EngineContext) {
  const s = doc.state;
  if (s.phase !== "playing" || !s.turn) throw new GameError("No es tu turno");
  const seat = s.seats[s.turn.seat];
  if (!seat || seat.uid !== actor) throw new GameError("No es tu turno");
  touch(seat);
  executeMove(doc, ctx, s.turn.seat, s.turn.hand, move);
}

function executeMove(doc: TableDoc, ctx: EngineContext, seatIdx: number, handIdx: number, move: Move) {
  const s = doc.state;
  const cfg = doc.config;
  const seat = s.seats[seatIdx];
  const hand = seat.hands[handIdx];
  const allowed = allowedActions(cfg, seat, handIdx);
  if (!allowed[move]) throw new GameError("Esa jugada no está permitida ahora");

  let dealt = false;
  switch (move) {
    case "hit":
      hand.cards.push(dealCard(doc, ctx));
      dealt = true;
      if (handValue(hand).total >= 21) hand.done = true;
      break;
    case "stand":
      hand.done = true;
      break;
    case "double":
      seat.stack -= hand.bet;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(dealCard(doc, ctx));
      hand.done = true;
      break;
    case "split": {
      seat.stack -= hand.bet;
      const second = hand.cards.pop() as DealtCard;
      const aces = rankOf(second.c) === "A";
      const extra = emptyHand(hand.bet);
      extra.cards = [second];
      extra.split = true;
      extra.splitAces = aces;
      hand.split = true;
      hand.splitAces = aces;
      seat.hands.splice(handIdx + 1, 0, extra);
      hand.cards.push(dealCard(doc, ctx));
      dealt = true;
      autoComplete(cfg, seat, handIdx);
      break;
    }
    case "surrender":
      hand.surrendered = true;
      hand.done = true;
      break;
  }

  if (hand.done) {
    moveToNextHand(doc, ctx);
  } else {
    s.phaseEndsAt = wait(doc, ctx, turnDuration(doc, ctx, seat) + (dealt ? TIMING.dealCard : 0));
  }
}

function turnTimeout(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const turn = s.turn;
  if (!turn) {
    startDealer(doc, ctx);
    return;
  }
  const seat = s.seats[turn.seat];
  const hand = seat?.hands[turn.hand];
  if (!seat || !hand) {
    moveToNextHand(doc, ctx);
    return;
  }
  if (seat.bot) {
    const allowed = allowedActions(doc.config, seat, turn.hand);
    const up = s.dealer.cards[0]?.c ?? "2S";
    const move = safeMove(basicStrategy(codes(hand.cards), up, allowed, doc.config), allowed);
    executeMove(doc, ctx, turn.seat, turn.hand, move);
    return;
  }
  seat.timeouts += 1;
  if (seat.timeouts >= AFK_TIMEOUTS) seat.afk = true;
  hand.done = true;
  moveToNextHand(doc, ctx);
}

// ---------------------------------------------------------------------------
// Dealer and settlement
// ---------------------------------------------------------------------------

function anyLiveHand(s: TableState): boolean {
  return participantSeats(s).some((seat) =>
    seat.hands.some((h) => !h.surrendered && handValue(h).total <= 21 && !isNatural(h)),
  );
}

function startDealer(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  revealHole(doc);
  s.phase = "dealer";
  s.turn = null;
  let draws = 0;
  if (!s.dealerBlackjack && anyLiveHand(s)) {
    while (dealerShouldHit(codes(s.dealer.cards), doc.config.hitSoft17)) {
      s.dealer.cards.push(dealCard(doc, ctx));
      draws++;
    }
  }
  s.phaseEndsAt = wait(doc, ctx, TIMING.dealerReveal + draws * TIMING.dealerDraw + TIMING.dealerExtra);
}

export function settleHand(hand: Hand, dealerTotal: number, dealerBlackjack: boolean, blackjackPays: number) {
  const { total } = handValue(hand);
  let result: HandResult;
  let payout = 0;
  if (hand.surrendered) {
    result = "surrender";
    payout = Math.floor(hand.bet / 2);
  } else if (total > 21) {
    result = "bust";
  } else if (isNatural(hand)) {
    if (dealerBlackjack) {
      result = "push";
      payout = hand.bet;
    } else {
      result = "blackjack";
      payout = hand.bet + Math.floor(hand.bet * blackjackPays);
    }
  } else if (dealerBlackjack) {
    result = "lose";
  } else if (dealerTotal > 21 || total > dealerTotal) {
    result = "win";
    payout = hand.bet * 2;
  } else if (total === dealerTotal) {
    result = "push";
    payout = hand.bet;
  } else {
    result = "lose";
  }
  return { result, payout };
}

function settle(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  const cfg = doc.config;
  revealHole(doc);
  const dealerTotal = handTotal(codes(s.dealer.cards)).total;
  for (const seat of participantSeats(s)) {
    let returned = 0;
    let wagered = seat.insurance;
    const delta = emptyDelta();
    for (const hand of seat.hands) {
      wagered += hand.bet;
      const { result, payout } = settleHand(hand, dealerTotal, s.dealerBlackjack, cfg.blackjackPays);
      hand.result = result;
      hand.payout = payout;
      hand.done = true;
      returned += payout;
      delta.hands += 1;
      if (result === "win" || result === "blackjack") delta.wins += 1;
      if (result === "lose" || result === "bust" || result === "surrender") delta.losses += 1;
      if (result === "push") delta.pushes += 1;
      if (result === "blackjack") delta.blackjacks += 1;
      if (result === "bust") delta.busts += 1;
      delta.xp += XP.hand + (result === "win" ? XP.win : 0) + (result === "blackjack" ? XP.blackjack : 0);
    }
    if (seat.insurance > 0 && s.dealerBlackjack) returned += seat.insurance * 3;

    // Bust It depends on the dealer's final hand.
    if (seat.side.bust > 0) {
      const win = bustIt(codes(s.dealer.cards));
      const payout = win ? seat.side.bust * (win.multiplier + 1) : 0;
      seat.sideResults.bust = { kind: win?.kind ?? "none", payout };
      returned += payout;
    }
    // Deal-time side bets were already paid into the stack.
    let sidePaidEarlier = 0;
    for (const id of SIDE_BET_IDS) {
      if (id !== "bust") sidePaidEarlier += seat.sideResults[id]?.payout ?? 0;
    }
    seat.stack += returned;
    const staked = wagered + sideTotal(seat);
    seat.net = returned + sidePaidEarlier - staked;
    delta.wagered = staked;
    delta.net = seat.net;
    delta.biggestWin = Math.max(0, seat.net);
    if (seat.bot) {
      if (seat.stack < cfg.minBet * 5) seat.stack += cfg.minBet * 60;
    } else {
      ctx.effects.push({ type: "stats", uid: seat.uid, delta, stack: seat.stack });
    }
  }
  s.phase = "payout";
  s.turn = null;
  s.phaseEndsAt = wait(doc, ctx, TIMING.payout);
}

function nextRound(doc: TableDoc, ctx: EngineContext) {
  const s = doc.state;
  for (const idx of seatIndices(s)) {
    const seat = s.seats[idx];
    // Side stakes were consumed by this round (and paid if they won).
    if (seat.hands.length) seat.side = noSide();
    seat.hands = [];
    seat.insurance = 0;
    seat.insuranceDecided = false;
    seat.ready = false;
  }
  s.dealer = { cards: [], revealed: false };
  s.dealerBlackjack = false;
  s.peeked = false;
  s.seq = 0;
  s.turn = null;
  s.round += 1;
  doc.secret.hole = "";
  removeInactiveSeats(doc, ctx);
  if (humanIndices(s).length === 0) {
    removeAllBots(doc);
    toWaiting(doc);
    return;
  }
  startBetting(doc, ctx);
}

// ---------------------------------------------------------------------------
// Public summaries
// ---------------------------------------------------------------------------

export interface LobbyPlayer {
  name: string;
  avatar: Seat["avatar"];
  level: number;
  bot: boolean;
}

export interface LobbySummary {
  id: string;
  name: string;
  minBet: number;
  maxBet: number;
  decks: number;
  hitSoft17: boolean;
  blackjackPays: number;
  surrender: boolean;
  sideBets: boolean;
  theme: TableConfig["theme"];
  seats: number;
  official: boolean;
  isPrivate: boolean;
  createdBy: string | null;
  createdAt: number;
  players: Record<string, LobbyPlayer>;
  humans: number;
  bots: number;
  phase: TableState["phase"];
  round: number;
  phaseEndsAt: number;
  updatedAt: number;
}

export function lobbySummary(doc: TableDoc): LobbySummary {
  const { config: c, state: s } = doc;
  const players: Record<string, LobbyPlayer> = {};
  for (const idx of seatIndices(s)) {
    const seat = s.seats[idx];
    players[idx] = { name: seat.name, avatar: seat.avatar, level: seat.level, bot: seat.bot };
  }
  return {
    id: c.id,
    name: c.name,
    minBet: c.minBet,
    maxBet: c.maxBet,
    decks: c.decks,
    hitSoft17: c.hitSoft17,
    blackjackPays: c.blackjackPays,
    surrender: c.surrender,
    sideBets: c.sideBets,
    theme: c.theme,
    seats: c.seats,
    official: c.official,
    isPrivate: c.isPrivate,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    players,
    humans: humanIndices(s).length,
    bots: botIndices(s).length,
    phase: s.phase,
    round: s.round,
    phaseEndsAt: s.phaseEndsAt,
    updatedAt: s.updatedAt,
  };
}
