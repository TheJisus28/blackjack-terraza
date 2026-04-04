"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/player-identity";
import { TableList } from "@/components/lobby/TableList";
import { CreateTableDialog } from "@/components/lobby/CreateTableDialog";

export default function LobbyPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [nameSet, setNameSet] = useState(false);

  useEffect(() => {
    const saved = getPlayerName();
    if (saved) {
      setName(saved);
      setNameSet(true);
    }
  }, []);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch("/api/tables");
      const data = await res.json();
      setTables(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (nameSet) fetchTables();
  }, [nameSet, fetchTables]);

  useEffect(() => {
    if (!nameSet) return;
    const interval = setInterval(fetchTables, 5000);
    return () => clearInterval(interval);
  }, [nameSet, fetchTables]);

  const handleSetName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayerName(trimmed);
    setNameSet(true);
  };

  const handleCreate = async (config: {
    name: string;
    isPrivate: boolean;
    maxPlayers: number;
    minBet: number;
    maxBet: number;
  }) => {
    setCreating(true);
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          createdBy: name,
          creatorId: getPlayerId(),
        }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/table/${data.id}`);
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await fetch(`/api/tables?code=${code}`);
      const data = await res.json();
      if (data.id) {
        router.push(`/table/${data.id}`);
      }
    } catch {
      /* ignore */
    }
  };

  if (!nameSet) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-gray-950 via-emerald-950 to-gray-950 px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Blackjack <span className="text-emerald-400">Terraza</span>
          </h1>
          <p className="text-gray-400 mb-8">Elige tu nombre para jugar</p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSetName()}
            placeholder="Tu nombre..."
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center
              text-lg placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors mb-4"
          />

          <button
            onClick={handleSetName}
            disabled={!name.trim()}
            className="w-full px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold
              disabled:opacity-40 transition-colors cursor-pointer"
          >
            Entrar al Lobby
          </button>

          <Link
            href="/"
            className="inline-block mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-gray-950 via-emerald-950 to-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold hover:opacity-80 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/50">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Blackjack <span className="text-emerald-400">Terraza</span>
        </Link>
        <span className="text-sm text-gray-400">
          Hola, <span className="text-white font-medium">{name}</span>
        </span>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold
              transition-colors cursor-pointer"
          >
            Crear Mesa
          </button>

          <div className="flex flex-1 gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
              placeholder="Codigo..."
              maxLength={6}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white
                placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors
                uppercase tracking-widest text-center font-mono"
            />
            <button
              onClick={handleJoinByCode}
              disabled={!joinCode.trim()}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium
                disabled:opacity-40 transition-colors cursor-pointer"
            >
              Unirse
            </button>
          </div>
        </div>

        {/* Table list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Mesas Publicas
            </h2>
            <button
              onClick={fetchTables}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            >
              Actualizar
            </button>
          </div>

          <TableList tables={tables as never[]} loading={loading} />
        </div>
      </main>

      <CreateTableDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        loading={creating}
      />
    </div>
  );
}
