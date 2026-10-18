import "server-only";
import { randomAvatar, type AvatarConfig } from "@/lib/avatar";
import {
  DAILY_BONUS_BASE,
  DAILY_BONUS_STEP,
  DAILY_COOLDOWN,
  DAILY_MAX_STREAK,
  RESCUE_CHIPS,
  RESCUE_COOLDOWN,
  RESCUE_THRESHOLD,
  STARTING_CHIPS,
} from "@/lib/game/constants";
import { GameError } from "@/lib/game/types";
import { EMPTY_STATS, normalizeUser, validateName, type UserRecord } from "@/lib/profile";
import { adminDb } from "./admin";
import { reconcileSeat, runTableAction } from "./tables";
import { syncPublicProfile } from "./users";

type RawUser = Record<string, unknown> & {
  chips?: number;
  daily?: { last?: number; streak?: number };
  rescueAt?: number;
  table?: { stack?: number } | null;
};

function defaultName(displayName?: string) {
  const first = displayName?.trim().split(/\s+/)[0] ?? "";
  if (first && !validateName(first)) return first.slice(0, 16);
  return `Jugador${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function initProfile(uid: string, displayName?: string): Promise<UserRecord> {
  const db = adminDb();
  const ref = db.ref(`users/${uid}`);
  await ref.transaction((raw: RawUser | null) => {
    if (raw !== null) return;
    const now = Date.now();
    return {
      name: defaultName(displayName),
      avatar: randomAvatar(),
      chips: STARTING_CHIPS,
      xp: 0,
      level: 1,
      stats: EMPTY_STATS,
      createdAt: now,
      daily: { last: 0, streak: 0 },
      rescueAt: 0,
      table: null,
    };
  });
  await reconcileSeat(uid);
  await syncPublicProfile(uid);
  const user = normalizeUser((await ref.get()).val());
  if (!user) throw new GameError("No se pudo crear el perfil");
  return user;
}

export async function updateProfile(uid: string, name: string, avatar: AvatarConfig) {
  const problem = validateName(name);
  if (problem) throw new GameError(problem);
  const clean = name.trim().replace(/\s+/g, " ");
  const db = adminDb();
  const ref = db.ref(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists()) throw new GameError("Perfil no encontrado");
  await ref.update({ name: clean, avatar });
  await syncPublicProfile(uid);
  const user = normalizeUser((await ref.get()).val());
  if (user?.table) {
    await runTableAction(user.table.id, uid, { type: "profile", name: clean, avatar, level: user.level }).catch(() => {});
  }
  return user;
}

export async function claimDaily(uid: string) {
  const box = { bonus: 0, streak: 0, reason: "" };
  const result = await adminDb()
    .ref(`users/${uid}`)
    .transaction((raw: RawUser | null) => {
      box.bonus = 0;
      box.reason = "";
      if (raw === null) return null;
      const now = Date.now();
      const last = raw.daily?.last ?? 0;
      if (now - last < DAILY_COOLDOWN) {
        const hours = Math.ceil((DAILY_COOLDOWN - (now - last)) / 3_600_000);
        box.reason = `Vuelve en ${hours} ${hours === 1 ? "hora" : "horas"} por tu próximo bono`;
        return;
      }
      const streak = now - last < 48 * 3_600_000 ? Math.min(DAILY_MAX_STREAK, (raw.daily?.streak ?? 0) + 1) : 1;
      box.bonus = DAILY_BONUS_BASE + (streak - 1) * DAILY_BONUS_STEP;
      box.streak = streak;
      raw.chips = (raw.chips ?? 0) + box.bonus;
      raw.daily = { last: now, streak };
      return raw;
    });
  if (!result.committed) throw new GameError(box.reason || "Perfil no encontrado");
  await syncPublicProfile(uid);
  return { bonus: box.bonus, streak: box.streak };
}

export async function claimRescue(uid: string) {
  let reason = "";
  const result = await adminDb()
    .ref(`users/${uid}`)
    .transaction((raw: RawUser | null) => {
      reason = "";
      if (raw === null) return null;
      const now = Date.now();
      const worth = (raw.chips ?? 0) + (raw.table?.stack ?? 0);
      if (worth >= RESCUE_THRESHOLD) {
        reason = "El rescate es solo para quien se quedó sin fichas";
        return;
      }
      if (now - (raw.rescueAt ?? 0) < RESCUE_COOLDOWN) {
        reason = "Ya usaste el rescate hace poco, inténtalo más tarde";
        return;
      }
      raw.chips = (raw.chips ?? 0) + RESCUE_CHIPS;
      raw.rescueAt = now;
      return raw;
    });
  if (!result.committed) throw new GameError(reason || "Perfil no encontrado");
  await syncPublicProfile(uid);
  return { bonus: RESCUE_CHIPS };
}
