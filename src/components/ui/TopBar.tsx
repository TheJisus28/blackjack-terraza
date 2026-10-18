"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { fmt } from "@/lib/format";
import { ChipIcon } from "./Chip";
import { Portrait } from "./Portrait";

const LINKS = [
  { href: "/lobby", label: "Mesas" },
  { href: "/perfil", label: "Perfil" },
  { href: "/ranking", label: "Ranking" },
];

export function TopBar({ right }: { right?: React.ReactNode }) {
  const { profile } = useAuth();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b-4 border-[#120d22] bg-bg-2/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/lobby" className="font-display text-xs leading-tight">
          <span className="text-gold">BLACKJACK</span> <span className="text-ink">TERRAZA</span>
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`pixel-btn btn-ghost px-3 py-2 text-[0.6rem] ${path === l.href ? "text-gold" : "text-ink-dim"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {right}
          {profile && (
            <Link href="/perfil" className="flex items-center gap-3">
              <span className="pixel-inset flex items-center gap-2 px-3 py-1.5">
                <ChipIcon value={1000} size={20} />
                <span className="font-display text-[0.65rem] tabular-nums text-gold">{fmt(profile.chips)}</span>
              </span>
              <Portrait id={profile.avatar.id} size={36} />
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-base">{profile.name}</span>
                <span className="text-xs text-ink-dim">Nivel {profile.level}</span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
