"use client";

import { limitToLast, onValue, orderByChild, query, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { ChipIcon } from "@/components/ui/Chip";
import { Portrait } from "@/components/ui/Portrait";
import { TopBar } from "@/components/ui/TopBar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { firebase } from "@/lib/firebase/client";
import { compact, fmt } from "@/lib/format";
import { normalizePublicProfile, type PublicProfile } from "@/lib/profile";

const MEDALS = ["#f6c544", "#c9ced6", "#c98f4c"];

export default function RankingPage() {
  const { status, user } = useRequireAuth();
  const [rows, setRows] = useState<(PublicProfile & { uid: string })[] | null>(null);

  useEffect(() => {
    if (status !== "signedIn") return;
    const q = query(ref(firebase().db, "publicProfiles"), orderByChild("worth"), limitToLast(50));
    return onValue(q, (snap) => {
      const list: (PublicProfile & { uid: string })[] = [];
      snap.forEach((child) => {
        const p = normalizePublicProfile(child.val());
        if (p) list.push({ ...p, uid: child.key as string });
      });
      setRows(list.reverse());
    });
  }, [status]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="font-display text-base text-gold">RANKING</h1>
          <p className="mt-1 text-ink-dim">Los 50 jugadores con más fichas (saldo + fichas en la mesa).</p>
        </div>
        {rows === null ? (
          <p className="py-20 text-center font-display text-xs text-ink-dim animate-blink-steps">CARGANDO...</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <li
                key={r.uid}
                className={`pixel-box flex items-center gap-4 px-4 py-3 ${r.uid === user?.uid ? "bg-[#3d2f0d]" : ""}`}
              >
                <span
                  className="w-10 text-center font-display text-sm"
                  style={{ color: MEDALS[i] ?? "var(--ink-dim)" }}
                >
                  {i + 1}
                </span>
                <Portrait id={r.avatar.id} size={44} ring={MEDALS[i]} />
                <div className="flex flex-1 flex-col leading-tight">
                  <span className="text-lg">
                    {r.name} {r.uid === user?.uid && <span className="text-sm text-gold">(tú)</span>}
                  </span>
                  <span className="text-sm text-ink-dim">
                    Nivel {r.level} · {fmt(r.hands)} manos · {fmt(r.blackjacks)} blackjacks
                  </span>
                </div>
                <div className="hidden flex-col items-end text-sm text-ink-dim sm:flex">
                  <span>Mayor ganancia</span>
                  <span className="text-gold">{compact(r.biggestWin)}</span>
                </div>
                <span className="pixel-inset flex items-center gap-2 px-3 py-1.5">
                  <ChipIcon value={1000} size={20} />
                  <span className="font-display text-[0.65rem] text-gold">{compact(r.worth)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
