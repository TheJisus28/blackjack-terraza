"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreateTableModal } from "@/components/lobby/CreateTableModal";
import { TableCard } from "@/components/lobby/TableCard";
import { ChipIcon } from "@/components/ui/Chip";
import { TopBar } from "@/components/ui/TopBar";
import { useLobby, useNow, useOnlineCount } from "@/hooks/useLobby";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { DAILY_COOLDOWN, RESCUE_THRESHOLD } from "@/lib/game/constants";
import type { LobbySummary } from "@/lib/game/engine";
import { errorText, toast } from "@/lib/toast";

const FILTERS: { id: string; label: string; test: (t: LobbySummary) => boolean }[] = [
  { id: "all", label: "Todas", test: () => true },
  { id: "low", label: "Bajas", test: (t) => t.minBet <= 25 },
  { id: "mid", label: "Medias", test: (t) => t.minBet > 25 && t.minBet <= 250 },
  { id: "high", label: "Altas", test: (t) => t.minBet > 250 },
  { id: "custom", label: "De jugadores", test: (t) => !t.official },
];

export default function LobbyPage() {
  const { status, profile, user } = useRequireAuth();
  const signedIn = status === "signedIn";
  const tables = useLobby(signedIn);
  const online = useOnlineCount(signedIn);
  const now = useNow(30_000);
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    api("/api/tables", { action: "sweep" }).catch(() => {});
  }, [signedIn]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    return (tables ?? []).filter((t) => f.test(t) && (!t.isPrivate || t.createdBy === user?.uid || t.id === profile?.table?.id));
  }, [tables, filter, user?.uid, profile?.table?.id]);

  const dailyReady = profile ? now - profile.daily.last >= DAILY_COOLDOWN : false;
  const hoursLeft = profile ? Math.ceil((DAILY_COOLDOWN - (now - profile.daily.last)) / 3_600_000) : 0;
  const broke = profile ? profile.chips + (profile.table?.stack ?? 0) < RESCUE_THRESHOLD : false;
  const seatedAt = profile?.table ? tables?.find((t) => t.id === profile.table?.id) : undefined;

  async function claim(action: "daily" | "rescue") {
    setClaiming(true);
    try {
      const res = await api<{ bonus: number; streak?: number }>("/api/profile", { action });
      toast.chips(
        action === "daily"
          ? `+${fmt(res.bonus)} fichas · racha de ${res.streak} ${res.streak === 1 ? "día" : "días"}`
          : `Rescate: +${fmt(res.bonus)} fichas`,
      );
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        <section className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="font-display text-base text-gold">MESAS</h1>
            <p className="mt-1 text-ink-dim">
              <span className="mr-1 inline-block h-2 w-2 bg-green align-middle" /> {online} en línea ·{" "}
              {tables?.reduce((n, t) => n + t.humans, 0) ?? 0} jugando
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-3">
            {broke && (
              <button className="pixel-btn btn-red" disabled={claiming} onClick={() => claim("rescue")}>
                Rescate de fichas
              </button>
            )}
            <button
              className={`pixel-btn ${dailyReady ? "btn-gold" : ""}`}
              disabled={claiming || !dailyReady}
              onClick={() => claim("daily")}
              title={dailyReady ? "Reclama tu bono diario" : `Disponible en ${hoursLeft} h`}
            >
              <ChipIcon value={500} size={18} />
              {dailyReady ? "Bono diario" : `Bono en ${hoursLeft}h`}
            </button>
            <button className="pixel-btn btn-green" onClick={() => setCreating(true)}>
              + Crear mesa
            </button>
          </div>
        </section>

        {profile?.table && (
          <Link href={`/mesa/${profile.table.id}`} className="pixel-box flex items-center gap-4 bg-[#3d2f0d] px-5 py-4">
            <ChipIcon value={5000} size={32} />
            <div className="flex-1">
              <p className="text-lg">
                Estás sentado en <span className="text-gold">{seatedAt?.name ?? "una mesa"}</span>
              </p>
              <p className="text-ink-dim">Tienes {fmt(profile.table.stack)} fichas en la mesa.</p>
            </div>
            <span className="pixel-btn btn-gold text-[0.6rem]">Volver</span>
          </Link>
        )}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`pixel-btn px-3 text-[0.6rem] ${filter === f.id ? "btn-gold" : "btn-ghost text-ink-dim"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {tables === null ? (
          <p className="py-20 text-center font-display text-xs text-ink-dim animate-blink-steps">CARGANDO MESAS...</p>
        ) : visible.length === 0 ? (
          <p className="py-20 text-center text-lg text-ink-dim">No hay mesas en esta categoría todavía.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => (
              <TableCard key={t.id} table={t} mine={t.id === profile?.table?.id} />
            ))}
          </div>
        )}
      </main>
      <CreateTableModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
