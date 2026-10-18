import assets from "@/lib/generated/assets.json";

const SHEET = assets.cards;
const RANK_COL = Object.fromEntries(SHEET.ranks.map((r, i) => [r, i]));

/** A playing card cropped from the Kenney pixel-art tilesheet; "XX" shows the back. */
export function CardSprite({
  code,
  scale = 2,
  className = "",
  style,
}: {
  code: string;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hidden = code === "XX";
  const col = hidden ? SHEET.back.col : RANK_COL[code[0]] ?? 0;
  const row = hidden ? SHEET.back.row : SHEET.rows[code[1] as keyof typeof SHEET.rows] ?? 0;
  const { x, y, w, h } = SHEET.rect;
  return (
    <span
      role="img"
      aria-label={hidden ? "Carta boca abajo" : code}
      className={`inline-block shrink-0 pixelated ${className}`}
      style={{
        width: w * scale,
        height: h * scale,
        backgroundImage: `url(${SHEET.file})`,
        backgroundSize: `${SHEET.width * scale}px ${SHEET.height * scale}px`,
        backgroundPosition: `${-(col * SHEET.tile + x) * scale}px ${-(row * SHEET.tile + y) * scale}px`,
        ...style,
      }}
    />
  );
}
