"use client";

import Link from "next/link";

interface TableItem {
  id: string;
  name: string;
  status: string;
  max_players: number;
  min_bet: number;
  max_bet: number;
  player_count: number;
  created_by: string;
  created_at: string;
}

interface TableListProps {
  tables: TableItem[];
  loading: boolean;
}

export function TableList({ tables, loading }: TableListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No hay mesas disponibles</p>
        <p className="text-gray-600 text-sm mt-1">
          Crea una o usa un codigo de invitacion
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {tables.map((table) => (
        <Link
          key={table.id}
          href={`/table/${table.id}`}
          className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06]
            rounded-xl hover:bg-white/[0.06] transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
              {table.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              por {table.created_by} &middot; ${table.min_bet}-${table.max_bet}
            </p>
          </div>

          <div className="flex items-center gap-3 ml-4">
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  table.status === "waiting"
                    ? "bg-emerald-400"
                    : "bg-amber-400 animate-pulse"
                }`}
              />
              <span className="text-sm text-gray-400">
                {table.player_count}/{table.max_players}
              </span>
            </div>

            <span className={`text-xs px-2 py-1 rounded-md ${
              table.status === "waiting"
                ? "text-emerald-400 bg-emerald-500/10"
                : "text-amber-400 bg-amber-500/10"
            }`}>
              {table.status === "waiting" ? "Esperando" : "En juego"}
            </span>

            {table.status === "playing" && table.player_count < table.max_players && (
              <span className="text-[10px] text-emerald-400/70">
                Unirse
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
