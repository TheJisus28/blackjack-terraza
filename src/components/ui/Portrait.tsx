import { avatarInfo } from "@/lib/avatar";

export function Portrait({
  id,
  size = 48,
  className = "",
  ring,
}: {
  id: string;
  size?: number;
  className?: string;
  ring?: string;
}) {
  const info = avatarInfo(id);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny pixel-art sprite, no optimization needed
    <img
      src={info.portrait}
      alt={info.name}
      width={size}
      height={size}
      className={`pixelated shrink-0 bg-panel-2 ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 3px ${ring ?? "#120d22"}`,
      }}
    />
  );
}
