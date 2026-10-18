import "server-only";
import { levelFromXp } from "@/lib/game/constants";
import type { PendingCashout, StatsDelta } from "@/lib/game/types";
import { normalizeStats, normalizeUser, type PublicProfile } from "@/lib/profile";
import { adminDb } from "./admin";

type RawUser = Record<string, unknown> & {
  chips?: number;
  ops?: Record<string, number>;
  table?: { op?: string; stack?: number } | null;
};

const OPS_TTL = 3 * 24 * 60 * 60 * 1000;

function pruneOps(ops: Record<string, number>, now: number) {
  const out: Record<string, number> = {};
  for (const [k, ts] of Object.entries(ops)) if (now - ts < OPS_TTL) out[k] = ts;
  return out;
}

/**
 * Credits a table cash-out to its owner exactly once. The op id is stored on the
 * user inside the same transaction, so retries and concurrent requests are safe.
 */
export async function applyCashout(tableId: string, opId: string, pending: PendingCashout) {
  const db = adminDb();
  let credited = false;
  await db.ref(`users/${pending.uid}`).transaction((raw: RawUser | null) => {
    credited = false;
    if (raw === null) return null;
    const now = Date.now();
    const ops = raw.ops ?? {};
    if (ops[opId]) return;
    raw.chips = (raw.chips ?? 0) + pending.amount;
    raw.ops = pruneOps({ ...ops, [opId]: now }, now);
    if (raw.table?.op === pending.seatOp) raw.table = null;
    credited = true;
    return raw;
  });
  await db.ref(`tables/${tableId}/secret/pending/${opId}`).remove();
  if (credited) await syncPublicProfile(pending.uid);
}

export async function applyStats(uid: string, delta: StatsDelta, stack: number) {
  await adminDb()
    .ref(`users/${uid}`)
    .transaction((raw: RawUser | null) => {
      if (raw === null) return null;
      const s = normalizeStats(raw.stats);
      raw.stats = {
        hands: s.hands + delta.hands,
        wins: s.wins + delta.wins,
        losses: s.losses + delta.losses,
        pushes: s.pushes + delta.pushes,
        blackjacks: s.blackjacks + delta.blackjacks,
        busts: s.busts + delta.busts,
        wagered: s.wagered + delta.wagered,
        net: s.net + delta.net,
        biggestWin: Math.max(s.biggestWin, delta.biggestWin),
      };
      const xp = (typeof raw.xp === "number" ? raw.xp : 0) + delta.xp;
      raw.xp = xp;
      raw.level = levelFromXp(xp);
      if (raw.table) raw.table.stack = stack;
      return raw;
    });
  await syncPublicProfile(uid);
}

export async function syncPublicProfile(uid: string) {
  const db = adminDb();
  const user = normalizeUser((await db.ref(`users/${uid}`).get()).val());
  if (!user) return;
  const profile: PublicProfile = {
    name: user.name,
    avatar: user.avatar,
    level: user.level,
    worth: user.chips + (user.table?.stack ?? 0),
    hands: user.stats.hands,
    wins: user.stats.wins,
    blackjacks: user.stats.blackjacks,
    biggestWin: user.stats.biggestWin,
    updatedAt: Date.now(),
  };
  await db.ref(`publicProfiles/${uid}`).set(profile);
}
