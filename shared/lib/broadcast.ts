import { getSupabase } from "./supabase";
import type { ClientGameState } from "./blackjack/types";

export type BroadcastEvent =
  | { type: "state_update"; state: ClientGameState }
  | { type: "player_joined"; playerName: string; playerCount: number }
  | { type: "player_left"; playerName: string; playerCount: number }
  | { type: "table_closed" };

export function getChannelName(tableId: string): string {
  return `table:${tableId}`;
}

export async function broadcastToTable(
  tableId: string,
  event: BroadcastEvent,
): Promise<void> {
  const sb = getSupabase();
  const channel = sb.channel(getChannelName(tableId));

  await channel.send({
    type: "broadcast",
    event: "game",
    payload: event,
  });

  sb.removeChannel(channel);
}
