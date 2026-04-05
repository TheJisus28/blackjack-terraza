"use client";

import { useState } from "react";
import { DEFAULT_MIN_BET, DEFAULT_MAX_BET } from "@/game/simulation/blackjack/constants";

interface CreateTableDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (config: {
    name: string;
    isPrivate: boolean;
    maxPlayers: number;
    minBet: number;
    maxBet: number;
  }) => void;
  loading: boolean;
}

export function CreateTableDialog({
  open,
  onClose,
  onCreate,
  loading,
}: CreateTableDialogProps) {
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(7);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-6">Create table</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Table name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday night blackjack"
              maxLength={72}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white
                placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-400">
              Private table
            </label>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer
                ${isPrivate ? "bg-emerald-500" : "bg-white/10"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${isPrivate ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Max players: {maxPlayers}
            </label>
            <input
              type="range"
              min={2}
              max={7}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white
              font-medium hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              onCreate({
                name: name || "Untitled table",
                isPrivate,
                maxPlayers,
                minBet: DEFAULT_MIN_BET,
                maxBet: DEFAULT_MAX_BET,
              })
            }
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white
              font-bold disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? "Creating..." : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
