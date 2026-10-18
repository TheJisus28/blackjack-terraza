import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { after } from "next/server";
import { normalizeAvatar } from "@/lib/avatar";
import { TIMING } from "@/lib/game/constants";
import { applyAction, createTableDoc, lobbySummary, type LobbySummary } from "@/lib/game/engine";
import { findSeatOf, normalizeConfig, normalizeDoc, normalizeSeats } from "@/lib/game/normalize";
import { customConfig, OFFICIAL_TABLES, officialConfig, type CreateTableInput } from "@/lib/game/tables";
import {
  GameError,
  type Effect,
  type EngineContext,
  type PresenceStatus,
  type Seat,
  type TableAction,
  type TableDoc,
} from "@/lib/game/types";
import { normalizeUser } from "@/lib/profile";
import { adminDb } from "./admin";
import { applyCashout, applyStats, syncPublicProfile } from "./users";

const rng = () => randomInt(0, 2 ** 47) / 2 ** 47;
const toDb = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const fmt = (n: number) => n.toLocaleString("es-CO");

// ---------------------------------------------------------------------------
// Keeping hot tables in the Admin SDK cache makes the first transaction
// attempt use fresh local data instead of a blind round-trip.
// ---------------------------------------------------------------------------

const warm = new Map<string, { last: number; off: () => void }>();

function keepWarm(tableId: string) {
  const now = Date.now();
  const entry = warm.get(tableId);
  if (entry) {
    entry.last = now;
  } else {
    const db = adminDb();
    const refs = [db.ref(`tables/${tableId}`), db.ref(`presence/${tableId}`)];
    const noop = () => {};
    for (const ref of refs) ref.on("value", noop);
    warm.set(tableId, { last: now, off: () => refs.forEach((ref) => ref.off("value", noop)) });
  }
  for (const [id, e] of warm) {
    if (now - e.last > 10 * 60_000) {
      e.off();
      warm.delete(id);
    }
  }
}

type PresenceNode = { conns?: Record<string, boolean>; lastSeen?: number };

async function loadPresence(tableId: string): Promise<EngineContext["presence"]> {
  const snap = await adminDb().ref(`presence/${tableId}`).get();
  const data = (snap.val() ?? {}) as Record<string, PresenceNode>;
  return (uid: string, seat: Seat): PresenceStatus => {
    const node = data[uid];
    if (node?.conns && Object.keys(node.conns).length > 0) return "online";
    const now = Date.now();
    if (!node) return now - seat.joinedAt < TIMING.joinGrace ? "online" : "gone";
    return now - Math.max(node.lastSeen ?? 0, seat.joinedAt) < TIMING.offlineGrace ? "away" : "gone";
  };
}

/** Runs one engine action as a transaction on tables/{id}. */
export async function runTableAction(tableId: string, actor: string, action: TableAction): Promise<TableDoc> {
  keepWarm(tableId);
  const presence = await loadPresence(tableId);
  const ref = adminDb().ref(`tables/${tableId}`);
  let effects: Effect[] = [];
  let failure: unknown = null;
  let changed = false;

  const result = await ref.transaction(
    (raw: unknown) => {
      effects = [];
      failure = null;
      changed = false;
      // An empty local cache yields null first; returning null makes the
      // server reply with the real value (or confirms the table is missing).
      if (raw === null) return null;
      const doc = normalizeDoc(raw, tableId);
      const before = JSON.stringify(doc);
      try {
        applyAction(doc, actor, action, { now: Date.now(), rng, presence, effects });
      } catch (err) {
        failure = err;
        return;
      }
      if (JSON.stringify(doc) === before) return;
      changed = true;
      return toDb(doc);
    },
    undefined,
    false,
  );

  if (failure) throw failure;
  if (!result.snapshot.exists()) throw new GameError("La mesa no existe");
  // From here on the action is committed: never surface errors as a failed action.
  try {
    const doc = normalizeDoc(result.snapshot.val(), tableId);
    if (changed && result.committed) {
      const committedEffects = effects;
      after(() => processEffects(tableId, doc, committedEffects));
    }
    return doc;
  } catch (err) {
    console.error("[table] post-commit", tableId, err);
    return normalizeDoc(null, tableId);
  }
}

async function processEffects(tableId: string, doc: TableDoc, effects: Effect[]) {
  const tasks: Promise<unknown>[] = [];
  // Every pending cash-out is retried, not only this request's, so a crash
  // between the table commit and the credit never loses chips.
  for (const [opId, pending] of Object.entries(doc.secret.pending)) tasks.push(applyCashout(tableId, opId, pending));
  for (const e of effects) if (e.type === "stats") tasks.push(applyStats(e.uid, e.delta, e.stack));
  tasks.push(writeLobby(tableId, lobbySummary(doc)));
  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === "rejected") console.error("[effects]", tableId, r.reason);
}

async function writeLobby(tableId: string, summary: LobbySummary) {
  await adminDb()
    .ref(`lobby/${tableId}`)
    .transaction((current: { updatedAt?: number } | null) => {
      if (current && (current.updatedAt ?? 0) > summary.updatedAt) return;
      return toDb(summary);
    });
}

// ---------------------------------------------------------------------------
// Seats: chips move from the profile to the table and back.
// ---------------------------------------------------------------------------

type RawUser = Record<string, unknown> & {
  chips?: number;
  table?: { id: string; op: string; stack?: number; buyIn?: number; seat?: number; ts?: number } | null;
};

export async function sitDown(tableId: string, uid: string, seat: number, buyIn: number) {
  const db = adminDb();
  const configSnap = await db.ref(`tables/${tableId}/config`).get();
  if (!configSnap.exists()) throw new GameError("La mesa no existe");
  const config = normalizeConfig(configSnap.val(), tableId);
  if (!Number.isInteger(buyIn) || buyIn < config.minBet) {
    throw new GameError(`La entrada mínima es ${fmt(config.minBet)} fichas`);
  }
  await reconcileSeat(uid);

  const op = randomBytes(9).toString("base64url");
  const box: { user?: ReturnType<typeof normalizeUser>; reason?: string } = {};
  const reserve = await db.ref(`users/${uid}`).transaction((raw: RawUser | null) => {
    box.user = undefined;
    box.reason = undefined;
    if (raw === null) return null;
    if (raw.table) {
      box.reason = raw.table.id === tableId ? "Ya estás sentado en esta mesa" : "Ya estás sentado en otra mesa";
      return;
    }
    if ((raw.chips ?? 0) < buyIn) {
      box.reason = "No tienes suficientes fichas";
      return;
    }
    raw.chips = (raw.chips ?? 0) - buyIn;
    raw.table = { id: tableId, seat, op, buyIn, stack: buyIn, ts: Date.now() };
    box.user = normalizeUser(raw);
    return raw;
  });
  if (!reserve.committed || !box.user) throw new GameError(box.reason ?? "Crea tu perfil antes de jugar");

  try {
    const doc = await runTableAction(tableId, uid, {
      type: "sit",
      seat,
      buyIn,
      op,
      name: box.user.name,
      avatar: normalizeAvatar(box.user.avatar),
      level: box.user.level,
    });
    after(() => syncPublicProfile(uid));
    return doc;
  } catch (err) {
    // Refund only if the seat really did not make it to the table.
    const seats = normalizeSeats((await db.ref(`tables/${tableId}/state/seats`).get()).val());
    if (Object.values(seats).some((s) => s.uid === uid && s.op === op)) {
      console.error("[sit] seated despite error", tableId, err);
      return normalizeDoc((await db.ref(`tables/${tableId}`).get()).val(), tableId);
    }
    await db.ref(`users/${uid}`).transaction((raw: RawUser | null) => {
      if (raw === null) return null;
      if (raw.table?.op !== op) return;
      raw.chips = (raw.chips ?? 0) + buyIn;
      raw.table = null;
      return raw;
    });
    throw err;
  }
}

export async function rebuy(tableId: string, uid: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new GameError("Cantidad inválida");
  const db = adminDb();
  let reason = "";
  const reserve = await db.ref(`users/${uid}`).transaction((raw: RawUser | null) => {
    reason = "";
    if (raw === null) return null;
    if (raw.table?.id !== tableId) {
      reason = "No estás sentado en esta mesa";
      return;
    }
    if ((raw.chips ?? 0) < amount) {
      reason = "No tienes suficientes fichas";
      return;
    }
    raw.chips = (raw.chips ?? 0) - amount;
    raw.table.stack = (raw.table.stack ?? 0) + amount;
    return raw;
  });
  if (!reserve.committed) throw new GameError(reason || "Perfil no encontrado");
  try {
    return await runTableAction(tableId, uid, { type: "rebuy", amount });
  } catch (err) {
    await db.ref(`users/${uid}`).transaction((raw: RawUser | null) => {
      if (raw === null) return null;
      raw.chips = (raw.chips ?? 0) + amount;
      if (raw.table) raw.table.stack = Math.max(0, (raw.table.stack ?? 0) - amount);
      return raw;
    });
    throw err;
  }
}

export async function leaveTable(tableId: string, uid: string) {
  const doc = await runTableAction(tableId, uid, { type: "leave" });
  // With nobody else attending, the engine fast-forwards the round right away.
  if (findSeatOf(doc.state, uid)) return runTableAction(tableId, uid, { type: "tick" });
  return doc;
}

/**
 * Repairs users/{uid}/table when it no longer matches reality: credits a pending
 * cash-out, advances a table the player left, or refunds a buy-in that never
 * reached the table.
 */
export async function reconcileSeat(uid: string) {
  const db = adminDb();
  const user = normalizeUser((await db.ref(`users/${uid}`).get()).val());
  const ref = user?.table;
  if (!ref) return;
  const tableSnap = await db.ref(`tables/${ref.id}`).get();
  if (tableSnap.exists()) {
    let doc = normalizeDoc(tableSnap.val(), ref.id);
    let found = findSeatOf(doc.state, uid);
    if (found && found[1].op === ref.op && found[1].leaving) {
      doc = await runTableAction(ref.id, uid, { type: "tick" });
      found = findSeatOf(doc.state, uid);
    }
    if (found && found[1].op === ref.op) return;
    const pending = Object.entries(doc.secret.pending).find(([, p]) => p.uid === uid && p.seatOp === ref.op);
    if (pending) {
      await applyCashout(ref.id, pending[0], pending[1]);
      return;
    }
  }
  if (Date.now() - ref.ts < 60_000) return; // a sit request may still be in flight
  await db.ref(`users/${uid}`).transaction((raw: RawUser | null) => {
    if (raw === null) return null;
    if (raw.table?.op !== ref.op) return;
    raw.chips = (raw.chips ?? 0) + (raw.table.buyIn ?? 0);
    raw.table = null;
    return raw;
  });
  await syncPublicProfile(uid);
}

// ---------------------------------------------------------------------------
// Table catalogue
// ---------------------------------------------------------------------------

export async function ensureOfficialTables() {
  const db = adminDb();
  const lobby = ((await db.ref("lobby").get()).val() ?? {}) as Record<string, unknown>;
  const missing = OFFICIAL_TABLES.filter((preset) => !lobby[preset.id]);
  if (!missing.length) return;
  const now = Date.now();
  await Promise.all(
    missing.map(async (preset) => {
      const existing = await db.ref(`tables/${preset.id}`).get();
      if (existing.exists()) {
        await writeLobby(preset.id, lobbySummary(normalizeDoc(existing.val(), preset.id)));
        return;
      }
      const doc = createTableDoc(officialConfig(preset, now), now);
      await db.ref(`tables/${preset.id}`).set(toDb(doc));
      await db.ref(`lobby/${preset.id}`).set(toDb(lobbySummary(doc)));
    }),
  );
}

export async function createCustomTable(uid: string, input: CreateTableInput) {
  const db = adminDb();
  const user = normalizeUser((await db.ref(`users/${uid}`).get()).val());
  if (!user) throw new GameError("Crea tu perfil antes de crear una mesa");
  if (user.createdTable && (await db.ref(`tables/${user.createdTable}/config`).get()).exists()) {
    throw new GameError("Ya tienes una mesa creada; ciérrala o espera a que se libere");
  }
  const id = `m-${randomBytes(4).toString("hex")}`;
  const now = Date.now();
  const doc = createTableDoc(customConfig(id, input, uid, now), now);
  await db.ref(`tables/${id}`).set(toDb(doc));
  await db.ref(`lobby/${id}`).set(toDb(lobbySummary(doc)));
  await db.ref(`users/${uid}/createdTable`).set(id);
  return id;
}

const CUSTOM_TTL = 30 * 60_000;

/** Advances stale tables, deletes abandoned custom tables and trims chats. */
export async function sweepTables() {
  const db = adminDb();
  const now = Date.now();
  const gate = await db.ref("meta/lastSweep").transaction((last: number | null) => {
    if (typeof last === "number" && now - last < 15_000) return;
    return now;
  });
  if (!gate.committed) return { skipped: true };

  const lobby = ((await db.ref("lobby").get()).val() ?? {}) as Record<string, LobbySummary>;
  let ticked = 0;
  let removed = 0;
  await Promise.all(
    Object.entries(lobby).map(async ([id, t]) => {
      try {
        const stale = t.phaseEndsAt > 0 && now > t.phaseEndsAt + 5_000;
        if ((t.humans > 0 || t.bots > 0) && (stale || now - t.updatedAt > 60_000)) {
          await runTableAction(id, "system", { type: "tick" });
          ticked++;
        }
        if (!t.official && t.humans === 0 && now - Math.max(t.updatedAt, t.createdAt) > CUSTOM_TTL) {
          const doc = normalizeDoc((await db.ref(`tables/${id}`).get()).val(), id);
          if (Object.keys(doc.state.seats).length === 0 && Object.keys(doc.secret.pending).length === 0) {
            await Promise.all(
              [`tables/${id}`, `lobby/${id}`, `chat/${id}`, `presence/${id}`, `emotes/${id}`].map((p) => db.ref(p).remove()),
            );
            if (t.createdBy) await db.ref(`users/${t.createdBy}/createdTable`).remove();
            removed++;
          }
        }
      } catch (err) {
        console.error("[sweep]", id, err);
      }
    }),
  );
  await trimChats(Object.keys(lobby));
  return { ticked, removed };
}

async function trimChats(tableIds: string[]) {
  const db = adminDb();
  await Promise.all(
    tableIds.map(async (id) => {
      const snap = await db.ref(`chat/${id}`).orderByChild("ts").get();
      const keys: string[] = [];
      snap.forEach((child) => {
        keys.push(child.key as string);
      });
      if (keys.length <= 80) return;
      const updates: Record<string, null> = {};
      for (const key of keys.slice(0, keys.length - 80)) updates[key] = null;
      await db.ref(`chat/${id}`).update(updates);
    }),
  );
}
