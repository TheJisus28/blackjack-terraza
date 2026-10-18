"use client";

import {
  limitToLast,
  onChildAdded,
  onDisconnect,
  onValue,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
} from "firebase/database";
import { useCallback, useEffect, useRef, useState } from "react";
import { tableAction } from "@/lib/api";
import { firebase } from "@/lib/firebase/client";
import { normalizeConfig, normalizeState } from "@/lib/game/normalize";
import type { TableConfig, TableState } from "@/lib/game/types";

export function useTable(tableId: string, enabled: boolean) {
  const [config, setConfig] = useState<TableConfig | null>(null);
  const [state, setState] = useState<TableState | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const { db } = firebase();
    const offConfig = onValue(ref(db, `tables/${tableId}/config`), (snap) => {
      if (!snap.exists()) {
        setMissing(true);
        return;
      }
      setMissing(false);
      setConfig(normalizeConfig(snap.val(), tableId));
    });
    const offState = onValue(ref(db, `tables/${tableId}/state`), (snap) => {
      if (snap.exists()) setState(normalizeState(snap.val()));
    });
    return () => {
      offConfig();
      offState();
    };
  }, [tableId, enabled]);

  return { config, state, missing };
}

/** Milliseconds to add to Date.now() to get the database server clock. */
export function useServerClock(enabled: boolean) {
  const offset = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    return onValue(ref(firebase().db, ".info/serverTimeOffset"), (snap) => {
      offset.current = typeof snap.val() === "number" ? snap.val() : 0;
    });
  }, [enabled]);
  return useCallback(() => Date.now() + offset.current, []);
}

/** Registers this browser tab at the table; disconnects are handled by the server. */
export function usePresence(tableId: string, uid: string | undefined) {
  useEffect(() => {
    if (!uid) return;
    const { db } = firebase();
    const base = `presence/${tableId}/${uid}`;
    const conn = push(ref(db, `${base}/conns`));
    const lastSeen = ref(db, `${base}/lastSeen`);
    const off = onValue(ref(db, ".info/connected"), async (snap) => {
      if (snap.val() !== true) return;
      try {
        await onDisconnect(conn).remove();
        await onDisconnect(lastSeen).set(serverTimestamp());
        await set(conn, true);
        await set(lastSeen, serverTimestamp());
      } catch {
        // Permission races while signing out are harmless.
      }
    });
    return () => {
      off();
      remove(conn).catch(() => {});
      set(lastSeen, serverTimestamp()).catch(() => {});
      onDisconnect(conn).cancel().catch(() => {});
    };
  }, [tableId, uid]);
}

/**
 * Asks the server to advance the table whenever its deadline passes. Every
 * client may do this; the transaction makes duplicates harmless. Spectators
 * wait a little longer so seated players usually do it.
 */
export function useTicker(tableId: string, state: TableState | null, serverNow: () => number, seated: boolean) {
  const inFlight = useRef(false);
  const deadline = state?.phaseEndsAt ?? 0;
  const updatedAt = state?.updatedAt ?? 0;

  useEffect(() => {
    if (!deadline) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const schedule = () => {
      const slack = (seated ? 120 : 1600) + Math.random() * 250 + attempt * 900;
      const wait = Math.max(0, deadline - serverNow()) + slack;
      timer = setTimeout(fire, Math.min(wait, 60_000));
    };
    const fire = async () => {
      if (document.hidden && !seated) return schedule();
      if (inFlight.current) return schedule();
      inFlight.current = true;
      try {
        await tableAction(tableId, { type: "tick" });
      } catch {
        // A failed tick is retried with backoff.
      } finally {
        inFlight.current = false;
      }
      attempt++;
      if (attempt < 6) schedule();
    };
    schedule();
    return () => clearTimeout(timer);
  }, [tableId, deadline, updatedAt, serverNow, seated]);
}

export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  text: string;
  ts: number;
}

export function useChat(tableId: string, enabled: boolean) {
  // Messages are stored with the table they belong to, so switching tables starts empty.
  const [log, setLog] = useState<{ tableId: string; list: ChatMessage[] }>({ tableId, list: [] });
  useEffect(() => {
    if (!enabled) return;
    const q = query(ref(firebase().db, `chat/${tableId}`), limitToLast(40));
    return onChildAdded(q, (snap) => {
      const v = snap.val() as Omit<ChatMessage, "id">;
      if (!v?.text) return;
      setLog((prev) => {
        const list = prev.tableId === tableId ? prev.list : [];
        // Re-subscribing replays existing children: skip the ones we have.
        if (list.some((m) => m.id === snap.key)) return prev;
        return { tableId, list: [...list.slice(-39), { ...v, id: snap.key as string }] };
      });
    });
  }, [tableId, enabled]);
  const messages = log.tableId === tableId ? log.list : [];

  const send = useCallback(
    async (uid: string, name: string, text: string) => {
      const clean = text.trim().slice(0, 200);
      if (!clean) return;
      await push(ref(firebase().db, `chat/${tableId}`), { uid, name, text: clean, ts: serverTimestamp() });
    },
    [tableId],
  );
  return { messages, send };
}

export interface Emote {
  e: string;
  ts: number;
}

export function useEmotes(tableId: string, enabled: boolean) {
  const [emotes, setEmotes] = useState<Record<string, Emote>>({});
  useEffect(() => {
    if (!enabled) return;
    return onValue(ref(firebase().db, `emotes/${tableId}`), (snap) => setEmotes((snap.val() ?? {}) as Record<string, Emote>));
  }, [tableId, enabled]);
  const send = useCallback(
    (uid: string, e: string) => set(ref(firebase().db, `emotes/${tableId}/${uid}`), { e, ts: serverTimestamp() }),
    [tableId],
  );
  return { emotes, send };
}
