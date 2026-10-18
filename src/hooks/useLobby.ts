"use client";

import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import type { LobbySummary } from "@/lib/game/engine";
import { firebase } from "@/lib/firebase/client";

export function useLobby(enabled: boolean) {
  const [tables, setTables] = useState<LobbySummary[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return onValue(ref(firebase().db, "lobby"), (snap) => {
      const val = (snap.val() ?? {}) as Record<string, LobbySummary>;
      setTables(
        Object.values(val)
          .map((t) => ({ ...t, players: t.players ?? {} }))
          .sort((a, b) => Number(b.official) - Number(a.official) || a.minBet - b.minBet || a.name.localeCompare(b.name)),
      );
    });
  }, [enabled]);
  return tables;
}

export function useOnlineCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    return onValue(ref(firebase().db, "online"), (snap) => setCount(snap.size));
  }, [enabled]);
  return count;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
