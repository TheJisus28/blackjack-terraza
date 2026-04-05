import {
  assignGlobalDealIndices,
  type TableCardLayout,
} from "@/game/simulation/blackjack/deal-sequence";

/**
 * Presentation helper: monotonic global indices per card so deal deadlines never collapse
 * (e.g. missing map entry defaulting to 0 for two cards).
 */
export function stableGlobalIndicesForKeys(
  layout: TableCardLayout,
  keysInOrder: readonly string[],
): number[] {
  const map = assignGlobalDealIndices(layout);
  const out: number[] = [];
  for (let i = 0; i < keysInOrder.length; i++) {
    const key = keysInOrder[i]!;
    let g = map.get(key);
    if (g === undefined) {
      g = i === 0 ? 0 : out[i - 1]! + 1;
    } else if (i > 0 && g <= out[i - 1]!) {
      g = out[i - 1]! + 1;
    }
    out.push(g);
  }
  return out;
}
