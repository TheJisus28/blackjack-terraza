import { normalizeAvatar, type AvatarConfig } from "@/lib/avatar";
import { levelFromXp } from "@/lib/game/constants";

export interface PlayerStats {
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  busts: number;
  wagered: number;
  net: number;
  biggestWin: number;
}

export interface SeatRef {
  id: string;
  seat: number;
  op: string;
  buyIn: number;
  stack: number;
  ts: number;
}

/** Private record at users/{uid}; only the server writes it. */
export interface UserRecord {
  name: string;
  avatar: AvatarConfig;
  chips: number;
  xp: number;
  level: number;
  stats: PlayerStats;
  createdAt: number;
  daily: { last: number; streak: number };
  rescueAt: number;
  table: SeatRef | null;
  createdTable: string | null;
  ops: Record<string, number>;
}

/** Public record at publicProfiles/{uid}, used by the ranking and chat rules. */
export interface PublicProfile {
  name: string;
  avatar: AvatarConfig;
  level: number;
  worth: number;
  hands: number;
  wins: number;
  blackjacks: number;
  biggestWin: number;
  updatedAt: number;
}

export const EMPTY_STATS: PlayerStats = {
  hands: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  busts: 0,
  wagered: 0,
  net: 0,
  biggestWin: 0,
};

type Raw = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

export function normalizeStats(v: unknown): PlayerStats {
  const o = (v ?? {}) as Raw;
  const out = { ...EMPTY_STATS };
  for (const k of Object.keys(out) as (keyof PlayerStats)[]) out[k] = num(o[k]);
  return out;
}

export function normalizeUser(v: unknown): UserRecord | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Raw;
  const daily = (o.daily ?? {}) as Raw;
  const t = o.table as Raw | null | undefined;
  const xp = num(o.xp);
  return {
    name: str(o.name, "Jugador"),
    avatar: normalizeAvatar(o.avatar),
    chips: num(o.chips),
    xp,
    level: levelFromXp(xp),
    stats: normalizeStats(o.stats),
    createdAt: num(o.createdAt),
    daily: { last: num(daily.last), streak: num(daily.streak) },
    rescueAt: num(o.rescueAt),
    table:
      t && typeof t === "object" && t.id
        ? {
            id: str(t.id),
            seat: num(t.seat),
            op: str(t.op),
            buyIn: num(t.buyIn),
            stack: num(t.stack),
            ts: num(t.ts),
          }
        : null,
    createdTable: str(o.createdTable) || null,
    ops: (o.ops ?? {}) as Record<string, number>,
  };
}

export function normalizePublicProfile(v: unknown): PublicProfile | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Raw;
  return {
    name: str(o.name, "Jugador"),
    avatar: normalizeAvatar(o.avatar),
    level: num(o.level, 1),
    worth: num(o.worth),
    hands: num(o.hands),
    wins: num(o.wins),
    blackjacks: num(o.blackjacks),
    biggestWin: num(o.biggestWin),
    updatedAt: num(o.updatedAt),
  };
}

export const NAME_RULES = {
  min: 2,
  max: 16,
  pattern: /^[\p{L}\p{N} ._-]+$/u,
};

export function validateName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < NAME_RULES.min) return `El nombre debe tener al menos ${NAME_RULES.min} caracteres`;
  if (name.length > NAME_RULES.max) return `El nombre puede tener hasta ${NAME_RULES.max} caracteres`;
  if (!NAME_RULES.pattern.test(name)) return "Usa solo letras, números, espacios, punto, guion o guion bajo";
  return null;
}
