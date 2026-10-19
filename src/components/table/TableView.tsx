"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useChat, useEmotes, usePresence, useServerClock, useTable, useTicker } from "@/hooks/useTable";
import { findSeatOf } from "@/lib/game/normalize";
import { useSettings } from "@/lib/settings";
import { sound } from "@/lib/sound";
import { BuyInModal } from "./BuyInModal";
import { Hud } from "./Hud";
import { DealTimeline } from "./timeline";
import { useTableAudio } from "./useTableAudio";

const GameScene = dynamic(() => import("@/components/three/GameScene"), {
  ssr: false,
  loading: () => <SceneLoading />,
});

function SceneLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="font-display text-xs text-ink-dim animate-blink-steps">CARGANDO MESA...</p>
    </div>
  );
}

export function TableView({ tableId }: { tableId: string }) {
  const { status, user, profile } = useRequireAuth();
  const signedIn = status === "signedIn";
  const { config, state, missing } = useTable(tableId, signedIn);
  const serverNow = useServerClock(signedIn);
  usePresence(tableId, user?.uid);
  const settings = useSettings();
  const mine = state && user ? findSeatOf(state, user.uid) : null;
  const mySeat = mine?.[0] ?? null;
  useTicker(tableId, state, serverNow, mySeat !== null);
  const chat = useChat(tableId, signedIn);
  const { emotes, send: sendEmote } = useEmotes(tableId, signedIn);

  const chatLines = useMemo(() => {
    const out: Record<string, { text: string; ts: number }> = {};
    for (const m of chat.messages) out[m.uid] = { text: m.text, ts: m.ts };
    return out;
  }, [chat.messages]);

  const timeline = useMemo(() => new DealTimeline(), []);
  // Sync during render so the scene sees the schedule in the same frame.
  useMemo(() => {
    if (state) timeline.sync(state);
  }, [state, timeline]);

  const [dealerTalking, setDealerTalking] = useState(false);
  useTableAudio({ state, timeline, mySeat, onTalk: setDealerTalking });

  useEffect(() => {
    sound.configure({
      volume: settings.volume,
      sfx: settings.sfx,
      music: settings.music,
      ambience: settings.ambience,
      voice: settings.voice,
    });
  }, [settings.volume, settings.sfx, settings.music, settings.ambience, settings.voice]);

  // The table is a full-screen app: no page scroll, bounce or pull-to-refresh.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("game-mode");
    return () => root.classList.remove("game-mode");
  }, []);

  const [buyInSeat, setBuyInSeat] = useState<number | null>(null);
  const seatedElsewhere = !!profile?.table && profile.table.id !== tableId;
  const canSit = !!profile && !profile.table && mySeat === null;
  const onSit = useCallback((seat: number) => setBuyInSeat(seat), []);

  if (missing) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="font-display text-sm text-gold">MESA NO ENCONTRADA</p>
        <p className="text-ink-dim">Puede que la mesa se haya cerrado por inactividad.</p>
        <Link href="/lobby" className="pixel-btn btn-gold">
          Volver al lobby
        </Link>
      </main>
    );
  }

  return (
    <div
      className="relative h-dvh w-full select-none overflow-hidden bg-bg [-webkit-touch-callout:none]"
      onPointerDown={() => sound.unlock()}
      onPointerUp={() => sound.unlock()}
    >
      {config && state ? (
        <GameScene
          config={config}
          state={state}
          mySeat={mySeat}
          canSit={canSit}
          onSit={onSit}
          timeline={timeline}
          camera={settings.camera}
          pixelSize={settings.pixelSize}
          dealerTalking={dealerTalking}
          emotes={emotes}
          chatLines={chatLines}
          serverNow={serverNow}
        />
      ) : (
        <SceneLoading />
      )}
      {config && state && user && (
        <Hud
          tableId={tableId}
          config={config}
          state={state}
          uid={user.uid}
          profile={profile}
          mySeat={mySeat}
          seatedElsewhere={seatedElsewhere}
          serverNow={serverNow}
          chat={chat}
          onEmote={(e) => sendEmote(user.uid, e)}
          timeline={timeline}
          canSit={canSit}
          onSit={onSit}
        />
      )}
      {config && profile && (
        <BuyInModal
          tableId={tableId}
          config={config}
          seat={buyInSeat}
          chips={profile.chips}
          onClose={() => setBuyInSeat(null)}
        />
      )}
    </div>
  );
}
