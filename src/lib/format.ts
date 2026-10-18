import assets from "@/lib/generated/assets.json";

export const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");

export function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const trim = (x: number) => (x >= 100 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, ""));
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}${trim(abs / 1_000)}K`;
  return `${sign}${fmt(abs)}`;
}

export const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `-${fmt(-n)}` : "0");

export interface ChipDenomination {
  value: number;
  color: string;
  index: number;
}

export const CHIPS: ChipDenomination[] = assets.chips.values.map((c, index) => ({ ...c, index }));

export function chipFor(value: number): ChipDenomination {
  return CHIPS.find((c) => c.value === value) ?? CHIPS[0];
}

/** Greedy breakdown of an amount into chips, largest first. */
export function chipBreakdown(amount: number, maxChips = 40): ChipDenomination[] {
  const out: ChipDenomination[] = [];
  let rest = Math.floor(amount);
  for (let i = CHIPS.length - 1; i >= 0 && rest > 0; i--) {
    const chip = CHIPS[i];
    while (rest >= chip.value && out.length < maxChips) {
      out.push(chip);
      rest -= chip.value;
    }
  }
  return out;
}

/** Denominations that make sense to bet with at a table. */
export function bettingChips(minBet: number, maxBet: number): ChipDenomination[] {
  const usable = CHIPS.filter((c) => c.value >= Math.max(1, minBet / 10) && c.value <= maxBet);
  return usable.slice(0, 6);
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "ahora";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
