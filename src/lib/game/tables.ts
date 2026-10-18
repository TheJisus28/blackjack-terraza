import { z } from "zod";
import { MAX_SEATS } from "./constants";
import type { TableConfig, TableTheme } from "./types";

type Preset = Omit<TableConfig, "createdAt" | "official" | "isPrivate" | "createdBy">;

const base = {
  decks: 6,
  hitSoft17: false,
  blackjackPays: 1.5,
  surrender: true,
  doubleAfterSplit: true,
  doubleOn: "any",
  maxHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  insurance: true,
  sideBets: true,
  penetration: 0.75,
  seats: MAX_SEATS,
} as const satisfies Partial<Preset>;

export const OFFICIAL_TABLES: Preset[] = [
  { ...base, id: "terraza-principiantes", name: "Terraza Principiantes", minBet: 10, maxBet: 500, bots: 3, theme: "emerald" },
  { ...base, id: "salon-esmeralda", name: "Salón Esmeralda", minBet: 25, maxBet: 1_000, bots: 2, theme: "teal", hitSoft17: true },
  { ...base, id: "mesa-zafiro", name: "Mesa Zafiro", minBet: 50, maxBet: 2_500, bots: 2, theme: "royal" },
  { ...base, id: "mesa-rubi", name: "Mesa Rubí", minBet: 100, maxBet: 5_000, bots: 2, theme: "ruby", decks: 8 },
  { ...base, id: "salon-onix", name: "Salón Ónix", minBet: 250, maxBet: 10_000, bots: 2, theme: "onyx", hitSoft17: true },
  { ...base, id: "salon-dorado", name: "Salón Dorado", minBet: 500, maxBet: 25_000, bots: 1, theme: "gold" },
  {
    ...base,
    id: "vip-diamante",
    name: "VIP Diamante",
    minBet: 2_500,
    maxBet: 100_000,
    bots: 1,
    theme: "violet",
    seats: 5,
    resplitAces: true,
  },
  {
    ...base,
    id: "mazo-unico",
    name: "Mazo Único",
    minBet: 25,
    maxBet: 1_000,
    bots: 2,
    theme: "onyx",
    decks: 1,
    blackjackPays: 1.2,
    doubleOn: "10-11",
    surrender: false,
    doubleAfterSplit: false,
    maxHands: 2,
    penetration: 0.6,
    seats: 5,
  },
];

export function officialConfig(preset: Preset, now: number): TableConfig {
  return { ...preset, official: true, isPrivate: false, createdBy: null, createdAt: now };
}

export const STAKE_PRESETS = [
  { min: 10, max: 500 },
  { min: 25, max: 1_000 },
  { min: 50, max: 2_500 },
  { min: 100, max: 5_000 },
  { min: 250, max: 10_000 },
  { min: 500, max: 25_000 },
  { min: 1_000, max: 50_000 },
  { min: 2_500, max: 100_000 },
] as const;

export const THEMES: { id: TableTheme; label: string; felt: string; accent: string }[] = [
  { id: "emerald", label: "Esmeralda", felt: "#0f6b3f", accent: "#d4af37" },
  { id: "teal", label: "Turquesa", felt: "#0d6566", accent: "#e8c872" },
  { id: "royal", label: "Zafiro", felt: "#173f8a", accent: "#e0c068" },
  { id: "ruby", label: "Rubí", felt: "#7d1426", accent: "#e8c36a" },
  { id: "onyx", label: "Ónix", felt: "#23262b", accent: "#c9a24b" },
  { id: "gold", label: "Dorado", felt: "#5a3d12", accent: "#f2d27a" },
  { id: "violet", label: "Violeta", felt: "#4a1f73", accent: "#e6c76f" },
];

export const themeOf = (id: TableTheme) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const CreateTableSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(28, "El nombre es demasiado largo"),
  stake: z.number().int().min(0).max(STAKE_PRESETS.length - 1),
  decks: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
  hitSoft17: z.boolean(),
  blackjackPays: z.union([z.literal(1.5), z.literal(1.2)]),
  surrender: z.boolean(),
  sideBets: z.boolean(),
  bots: z.number().int().min(0).max(MAX_SEATS - 1),
  seats: z.number().int().min(3).max(MAX_SEATS),
  theme: z.enum(["emerald", "royal", "ruby", "onyx", "violet", "teal", "gold"]),
  isPrivate: z.boolean(),
});

export type CreateTableInput = z.infer<typeof CreateTableSchema>;

export function customConfig(id: string, input: CreateTableInput, uid: string, now: number): TableConfig {
  const stake = STAKE_PRESETS[input.stake];
  return {
    ...base,
    id,
    name: input.name,
    minBet: stake.min,
    maxBet: stake.max,
    decks: input.decks,
    hitSoft17: input.hitSoft17,
    blackjackPays: input.blackjackPays,
    surrender: input.surrender,
    sideBets: input.sideBets,
    penetration: input.decks === 1 ? 0.6 : 0.75,
    seats: input.seats,
    bots: Math.min(input.bots, input.seats - 1),
    theme: input.theme,
    official: false,
    isPrivate: input.isPrivate,
    createdBy: uid,
    createdAt: now,
  };
}
