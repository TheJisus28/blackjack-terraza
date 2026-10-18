import assets from "@/lib/generated/assets.json";
import { chipFor } from "@/lib/format";

const SHEET = assets.chips;

/** One chip from the pixel-art sprite sheet. */
export function ChipIcon({ value, size = 28, className = "" }: { value: number; size?: number; className?: string }) {
  const chip = chipFor(value);
  const scale = size / SHEET.size;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 pixelated ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${SHEET.file})`,
        backgroundSize: `${SHEET.size * SHEET.values.length * scale}px ${SHEET.size * scale}px`,
        backgroundPosition: `${-chip.index * SHEET.size * scale}px 0`,
      }}
    />
  );
}

export function ChipAmount({ amount, size = 18, className = "" }: { amount: number; size?: number; className?: string }) {
  const top = [...SHEET.values].reverse().find((c) => amount >= c.value)?.value ?? 1;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <ChipIcon value={top} size={size} />
      <span className="font-display text-[0.7em] tabular-nums">{amount.toLocaleString("es-CO")}</span>
    </span>
  );
}
