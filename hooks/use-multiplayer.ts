"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getChannelName, type BroadcastEvent } from "@/lib/broadcast";
import type { ClientGameState, PlayerAction } from "@/lib/blackjack/types";
import { getPlayerId, getPlayerName } from "@/lib/player-identity";

interface UseMultiplayerOptions {
  tableId: string;
}

export function useMultiplayer({ tableId }: UseMultiplayerOptions) {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [tableInfo, setTableInfo] = useState<Record<string, unknown> | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const hasJoinedRef = useRef(false);

  const playerId = typeof window !== "undefined" ? getPlayerId() : "";
  const playerName = typeof window !== "undefined" ? getPlayerName() : "";

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${tableId}`);
      if (!res.ok) {
        setError("Mesa no encontrada");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setTableInfo(data);
      setGameState(data.game_state);
      setLoading(false);
    } catch {
      setError("Error al cargar la mesa");
      setLoading(false);
    }
  }, [tableId]);

  const joinTable = useCallback(async () => {
    if (!playerId || !playerName || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    try {
      const res = await fetch(`/api/tables/${tableId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, playerName }),
      });
      const data = await res.json();
      if (data.state) {
        setGameState(data.state);
      }
    } catch {
      hasJoinedRef.current = false;
    }
  }, [tableId, playerId, playerName]);

  const leaveTable = useCallback(async () => {
    if (!playerId) return;
    try {
      await fetch(`/api/tables/${tableId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
    } catch {
      /* ignore */
    }
  }, [tableId, playerId]);

  const sendAction = useCallback(
    async (action: PlayerAction | "bet" | "start_round", amount?: number) => {
      try {
        const res = await fetch(`/api/tables/${tableId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, action, amount }),
        });
        const data = await res.json();
        if (data.state) {
          setGameState(data.state);
        }
      } catch {
        /* ignore */
      }
    },
    [tableId, playerId],
  );

  // Subscribe to Realtime + join
  useEffect(() => {
    mountedRef.current = true;
    hasJoinedRef.current = false;

    fetchState();

    const sb = getSupabase();
    const channel = sb.channel(getChannelName(tableId));

    channel
      .on("broadcast", { event: "game" }, ({ payload }) => {
        if (!mountedRef.current) return;
        const event = payload as BroadcastEvent;
        switch (event.type) {
          case "state_update":
            setGameState(event.state);
            break;
          case "player_joined":
          case "player_left":
            fetchState();
            break;
          case "table_closed":
            setError("La mesa fue cerrada");
            break;
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && mountedRef.current) {
          setConnected(true);
          joinTable();
        }
      });

    return () => {
      mountedRef.current = false;
      sb.removeChannel(channel);
    };
  }, [tableId, fetchState, joinTable]);

  // Leave ONLY on actual page navigation / tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (playerId) {
        navigator.sendBeacon(
          `/api/tables/${tableId}/leave`,
          JSON.stringify({ playerId }),
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [tableId, playerId]);

  const myPlayer = gameState?.players.find((p) => p.id === playerId) ?? null;
  const isAdmin = tableInfo?.creator_id === playerId;
  const isMyTurn =
    gameState?.phase === "playing" &&
    gameState.players[gameState.activePlayerIndex]?.id === playerId;

  return {
    gameState,
    tableInfo,
    myPlayer,
    playerId,
    isAdmin,
    isMyTurn,
    connected,
    loading,
    error,
    sendAction,
    leaveTable,
    refreshState: fetchState,
  };
}
