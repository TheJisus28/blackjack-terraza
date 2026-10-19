"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { fmt } from "@/lib/format";
import { ChipIcon } from "./Chip";
import { Portrait } from "./Portrait";

const LINKS = [
  { href: "/lobby", label: "Mesas", icon: "🃏" },
  { href: "/perfil", label: "Perfil", icon: "👤" },
  { href: "/ranking", label: "Ranking", icon: "🏆" },
];

/**
 * Header for the lobby, profile and ranking pages. On phones the links move to a
 * tab bar at the bottom; pages leave room for it with `TAB_BAR_SPACE`.
 */
export function TopBar({ right }: { right?: React.ReactNode }) {
  const { profile } = useAuth();
  const path = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b-4 border-[#120d22] bg-bg-2/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-x-3 gap-y-3 px-4 py-2.5 sm:gap-x-6 sm:py-3">
          <Link href="/lobby" className="font-display text-[0.6rem] leading-tight sm:text-xs">
            <span className="text-gold">BLACKJACK</span> <span className="text-ink">TERRAZA</span>
          </Link>
          <nav className="hidden gap-1 sm:flex">
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
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            {right}
            {profile && (
              <Link href="/perfil" className="flex items-center gap-2 sm:gap-3">
                <span className="pixel-inset flex items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3">
                  <ChipIcon value={1000} size={18} />
                  <span className="font-display text-[0.6rem] tabular-nums text-gold sm:text-[0.65rem]">{fmt(profile.chips)}</span>
                </span>
                <Portrait id={profile.avatar.id} size={32} />
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="text-base">{profile.name}</span>
                  <span className="text-xs text-ink-dim">Nivel {profile.level}</span>
                </span>
              </Link>
            )}
          </div>
        </div>
      </header>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t-4 border-[#120d22] bg-bg-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={path === l.href ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 font-display text-[0.5rem] ${path === l.href ? "bg-panel text-gold" : "text-ink-dim"}`}
          >
            <span aria-hidden className="text-xl leading-none">
              {l.icon}
            </span>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Bottom padding for pages with a TopBar, so the phone tab bar never covers content. */
export const TAB_BAR_SPACE = "pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-6";
