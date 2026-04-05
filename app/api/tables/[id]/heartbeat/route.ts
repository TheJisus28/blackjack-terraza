import { getSupabase } from "@/shared/lib/supabase";
import type { GameState } from "@/game/simulation/blackjack";
import {
  deserializeDeck,
  serializeDeck,
  toClientState,
  touchPlayerLastSeen,
} from "@/game/simulation/blackjack";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { playerId } = (await request.json()) as { playerId: string };

  if (!playerId) {
    return Response.json({ error: "Missing playerId" }, { status: 400 });
  }

  const sb = getSupabase();

  const { data: table, error } = await sb
    .from("game_tables")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !table) {
    return Response.json({ error: "Table not found" }, { status: 404 });
  }

  const gameState: GameState = {
    ...table.game_state,
    deck: deserializeDeck(table.deck_data),
  };

  if (!gameState.players.some((p) => p.id === playerId)) {
    return Response.json({ error: "Not at table" }, { status: 403 });
  }

  const touched = touchPlayerLastSeen(gameState, playerId);

  const { error: updateError } = await sb
    .from("game_tables")
    .update({
      game_state: toClientState(touched),
      deck_data: serializeDeck(touched.deck),
    })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
