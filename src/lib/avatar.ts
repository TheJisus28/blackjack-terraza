import { z } from "zod";
import assets from "@/lib/generated/assets.json";

/** Voxel avatar from the generated catalog (100Avatars by Polygonal Mind, CC0). */
export interface AvatarInfo {
  id: string;
  name: string;
  file: string;
  portrait: string;
  /** Rest position of the hips bone (avatar space). */
  hips: number[];
  /** Rest world position of the head bone. */
  head: number[];
  height: number;
  expressions: Record<string, { target: string; weight: number }[]>;
  dealer: boolean;
}

export const ALL_AVATARS = assets.avatars as AvatarInfo[];
export const PLAYER_AVATARS = ALL_AVATARS.filter((a) => !a.dealer);
export const DEALER_AVATAR = ALL_AVATARS.find((a) => a.dealer) ?? ALL_AVATARS[0];
const PLAYER_IDS = PLAYER_AVATARS.map((a) => a.id) as [string, ...string[]];

export interface AvatarConfig {
  id: string;
}

export const AvatarSchema = z.object({ id: z.enum(PLAYER_IDS) });

export const DEFAULT_AVATAR: AvatarConfig = { id: PLAYER_AVATARS[0].id };

export function avatarInfo(id: string): AvatarInfo {
  return ALL_AVATARS.find((a) => a.id === id) ?? PLAYER_AVATARS[0];
}

export function randomAvatar(rng: () => number = Math.random): AvatarConfig {
  return { id: PLAYER_AVATARS[Math.floor(rng() * PLAYER_AVATARS.length) % PLAYER_AVATARS.length].id };
}

/** Coerces anything read from the database into a valid avatar. */
export function normalizeAvatar(input: unknown): AvatarConfig {
  const parsed = AvatarSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_AVATAR;
}
