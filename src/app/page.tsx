"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authMessage, useAuth } from "@/components/providers/AuthProvider";
import { CardSprite } from "@/components/ui/CardSprite";
import { ChipIcon } from "@/components/ui/Chip";
import { Portrait } from "@/components/ui/Portrait";
import { PLAYER_AVATARS } from "@/lib/avatar";
import { fmt } from "@/lib/format";
import { toast } from "@/lib/toast";

const HERO_AVATARS = PLAYER_AVATARS.filter((a) =>
  ["mafiossini", "olivia", "oldmoustache", "kate", "coolmoneybag", "dracula", "erika", "captainlobster"].includes(a.id),
);

export default function Home() {
  const { status, profile, user, signInGuest, signInGoogle, signInEmail, signUpEmail, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"none" | "login" | "register">("none");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function run(fn: () => Promise<void>, goLobby = true) {
    setBusy(true);
    try {
      await fn();
      if (goLobby) router.push("/lobby");
    } catch (err) {
      toast.error(authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10">
      <Backdrop />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-10">
        <header className="flex flex-col items-center gap-5 text-center">
          <div className="flex items-end gap-2">
            {["AS", "KH", "XX"].map((c, i) => (
              <CardSprite
                key={c}
                code={c}
                scale={2}
                className="drop-shadow-[4px_4px_0_rgba(0,0,0,0.6)]"
                style={{ transform: `rotate(${(i - 1) * 12}deg) translateY(${i === 1 ? -8 : 0}px)` }}
              />
            ))}
          </div>
          <h1 className="font-display text-3xl leading-tight sm:text-5xl">
            <span className="gold-shimmer">BLACKJACK</span>
            <br />
            <span className="text-ink text-shadow-pixel">TERRAZA</span>
          </h1>
          <p className="max-w-xl text-lg text-ink-dim">
            Mesas en tiempo real en 3D pixel art: siéntate con otros jugadores, apuesta tus fichas y vence al crupier.
          </p>
        </header>

        <div className="flex items-end justify-center gap-3">
          {HERO_AVATARS.map((a, i) => (
            <div key={a.id} className="animate-bounce" style={{ animationDelay: `${i * 120}ms`, animationDuration: "1.6s" }}>
              <Portrait id={a.id} size={56} />
            </div>
          ))}
        </div>

        <section className="pixel-box w-full max-w-md p-6">
          {status === "loading" ? (
            <p className="text-center font-display text-xs text-ink-dim animate-blink-steps">CARGANDO...</p>
          ) : status === "signedIn" && user ? (
            <div className="flex flex-col items-center gap-4 text-center">
              {profile && <Portrait id={profile.avatar.id} size={72} ring="#f6c544" />}
              <p className="text-xl">
                ¡Hola, <span className="text-gold">{profile?.name ?? "jugador"}</span>!
              </p>
              {profile && (
                <p className="flex items-center gap-2 text-ink-dim">
                  <ChipIcon value={1000} size={20} /> {fmt(profile.chips)} fichas
                </p>
              )}
              <Link href="/lobby" className="pixel-btn btn-gold w-full py-3 text-xs">
                Entrar al casino
              </Link>
              <button className="pixel-btn btn-ghost text-[0.6rem]" onClick={() => run(signOut, false)} disabled={busy}>
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button className="pixel-btn btn-gold w-full py-3 text-xs" disabled={busy} onClick={() => run(signInGuest)}>
                Jugar como invitado
              </button>
              <button className="pixel-btn btn-blue w-full py-3" disabled={busy} onClick={() => run(signInGoogle)}>
                Continuar con Google
              </button>
              {mode === "none" ? (
                <button className="pixel-btn w-full" disabled={busy} onClick={() => setMode("login")}>
                  Usar correo
                </button>
              ) : (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => (mode === "login" ? signInEmail(email, password) : signUpEmail(email, password)));
                  }}
                >
                  <div className="flex gap-2">
                    {(["login", "register"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`pixel-btn flex-1 text-[0.6rem] ${mode === m ? "btn-green" : "btn-ghost"}`}
                        onClick={() => setMode(m)}
                      >
                        {m === "login" ? "Entrar" : "Crear cuenta"}
                      </button>
                    ))}
                  </div>
                  <input
                    className="pixel-input"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className="pixel-input"
                    type="password"
                    placeholder="Contraseña"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                  <button className="pixel-btn btn-green w-full py-3" disabled={busy} type="submit">
                    {mode === "login" ? "Entrar" : "Crear cuenta"}
                  </button>
                </form>
              )}
              <p className="text-center text-sm text-ink-dim">
                Los invitados pueden vincular Google o correo después sin perder su progreso.
              </p>
            </div>
          )}
        </section>

        <footer className="text-center text-sm text-ink-dim/70">
          Avatares vóxel de 100Avatars (Polygonal Mind) · Animaciones de Quaternius y KayKit · Cartas, fichas y
          sonidos de Kenney — todos CC0.
        </footer>
      </div>
    </main>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#1f5a3c_0%,#123323_35%,#0d0a16_75%)]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
        }}
      />
      <div className="scanlines absolute inset-0" />
    </div>
  );
}
