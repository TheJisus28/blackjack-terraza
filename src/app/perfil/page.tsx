"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { authMessage } from "@/components/providers/AuthProvider";
import { ChipIcon } from "@/components/ui/Chip";
import { Portrait } from "@/components/ui/Portrait";
import { TopBar } from "@/components/ui/TopBar";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { api } from "@/lib/api";
import { PLAYER_AVATARS } from "@/lib/avatar";
import { compact, fmt, signed } from "@/lib/format";
import { levelFromXp, xpForLevel } from "@/lib/game/constants";
import { NAME_RULES, validateName } from "@/lib/profile";
import { errorText, toast } from "@/lib/toast";

const AvatarPreview = dynamic(() => import("@/components/three/AvatarPreview"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-panel-2" />,
});

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="pixel-inset flex flex-col gap-1 px-3 py-2">
      <span className="text-xs text-ink-dim">{label}</span>
      <span className={`font-display text-[0.65rem] ${tone ?? "text-ink"}`}>{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { status, profile, isGuest, user, signInGoogle, linkEmail, signOut } = useRequireAuth();
  // Drafts stay null until edited, so the form always reflects the saved profile.
  const [draftName, setName] = useState<string | null>(null);
  const [draftAvatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (status !== "signedIn" || !profile) {
    return (
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <p className="py-20 text-center font-display text-xs text-ink-dim animate-blink-steps">CARGANDO PERFIL...</p>
      </div>
    );
  }

  const name = draftName ?? profile.name;
  const avatar = draftAvatar ?? profile.avatar.id;
  const dirty = name.trim() !== profile.name || avatar !== profile.avatar.id;
  const nameError = name.trim() === profile.name ? null : validateName(name);
  const level = levelFromXp(profile.xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const progress = Math.min(100, ((profile.xp - from) / (to - from)) * 100);
  const s = profile.stats;
  const winRate = s.hands ? Math.round((s.wins / s.hands) * 100) : 0;

  async function save() {
    setSaving(true);
    try {
      await api("/api/profile", { action: "update", name, avatar: { id: avatar } });
      setName(null);
      setAvatar(null);
      toast.success("Perfil guardado");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[380px_1fr]">
        <section className="flex flex-col gap-4">
          <div className="pixel-box aspect-[4/5] w-full overflow-hidden p-0">
            <AvatarPreview id={avatar} />
          </div>
          <div className="pixel-box flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-2">
              <span className="text-ink-dim">Nombre en la mesa</span>
              <input
                className="pixel-input"
                value={name}
                maxLength={NAME_RULES.max}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {nameError && <p className="text-sm text-red">{nameError}</p>}
            <button className="pixel-btn btn-gold py-3" disabled={!dirty || !!nameError || saving} onClick={save}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            {profile.table && <p className="text-xs text-ink-dim">Tu nombre y avatar también se actualizan en tu mesa.</p>}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="pixel-box flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <Portrait id={profile.avatar.id} size={56} ring="#f6c544" />
              <div className="flex-1">
                <p className="text-2xl">{profile.name}</p>
                <p className="text-ink-dim">
                  Nivel {level} · {fmt(profile.xp)} XP
                </p>
                <div className="mt-2 h-3 w-full max-w-sm bg-black/50">
                  <div className="h-full bg-gold" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-dim">{fmt(to - profile.xp)} XP para el nivel {level + 1}</p>
              </div>
              <div className="pixel-inset flex items-center gap-2 px-4 py-3">
                <ChipIcon value={5000} size={32} />
                <div className="flex flex-col">
                  <span className="font-display text-sm text-gold">{fmt(profile.chips)}</span>
                  <span className="text-xs text-ink-dim">
                    {profile.table ? `+ ${fmt(profile.table.stack)} en la mesa` : "fichas disponibles"}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Manos jugadas" value={fmt(s.hands)} />
              <Stat label="% de victorias" value={`${winRate}%`} tone="text-green" />
              <Stat label="Blackjacks" value={fmt(s.blackjacks)} tone="text-gold" />
              <Stat label="Mayor ganancia" value={compact(s.biggestWin)} tone="text-gold" />
              <Stat label="Ganadas" value={fmt(s.wins)} />
              <Stat label="Perdidas" value={fmt(s.losses)} />
              <Stat label="Empates" value={fmt(s.pushes)} />
              <Stat label="Neto total" value={signed(s.net)} tone={s.net >= 0 ? "text-green" : "text-red"} />
            </div>
          </div>

          <div className="pixel-box p-5">
            <h2 className="mb-4 font-display text-xs text-gold">ELIGE TU AVATAR</h2>
            <div className="grid grid-cols-5 gap-3 sm:grid-cols-7 md:grid-cols-9">
              {PLAYER_AVATARS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAvatar(a.id)}
                  className="flex flex-col items-center gap-1 transition-transform hover:-translate-y-1"
                  title={a.name}
                >
                  <Portrait id={a.id} size={52} ring={avatar === a.id ? "#f6c544" : undefined} />
                  <span className={`max-w-14 truncate text-[0.65rem] ${avatar === a.id ? "text-gold" : "text-ink-dim"}`}>{a.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pixel-box flex flex-col gap-4 p-5">
            <h2 className="font-display text-xs text-gold">CUENTA</h2>
            {isGuest ? (
              <>
                <p>
                  Juegas como <b>invitado</b>. Vincula tu cuenta para conservar fichas y progreso en cualquier dispositivo.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="pixel-btn btn-blue"
                    onClick={() => signInGoogle().catch((err) => toast.error(authMessage(err)))}
                  >
                    Vincular Google
                  </button>
                </div>
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    linkEmail(email, password).catch((err) => toast.error(authMessage(err)));
                  }}
                >
                  <input className="pixel-input" type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <input
                    className="pixel-input"
                    type="password"
                    placeholder="Contraseña (6+)"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button className="pixel-btn btn-green" type="submit">
                    Vincular correo
                  </button>
                </form>
              </>
            ) : (
              <p>
                Sesión iniciada como <b>{user?.email ?? user?.displayName ?? "jugador"}</b>.
              </p>
            )}
            <button className="pixel-btn btn-red w-fit" onClick={() => signOut()}>
              Cerrar sesión
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
