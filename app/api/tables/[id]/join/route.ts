import { getSupabase } from "@/lib/supabase";
import {
  addPlayer,
  removePlayer,
  runToCompletion,
  deserializeDeck,
  serializeDeck,
  toClientState,
} from "@/lib/blackjack/engine";
import type { GameState } from "@/lib/blackjack/types";
import { broadcastToTable } from "@/lib/broadcast";

/**
 * Remove this player from every table except `exceptTableId`.
 * Handles cleanup (delete empty tables, transfer creator, etc.)
 */
async function leaveOtherTables(
  sb: ReturnType<typeof getSupabase>,
  playerId: string,
  exceptTableId: string,
) {
  const { data: allTables } = await sb
    .from("game_tables")
    .select("id, game_state, deck_data, creator_id")
    .neq("id", exceptTableId);

  if (!allTables) return;

  for (const row of allTables) {
    const gs: GameState = {
      ...row.game_state,
      deck: deserializeDeck(row.deck_data),
    };

    if (!gs.players.some((p) => p.id === playerId)) continue;

    const leavingPlayer = gs.players.find((p) => p.id === playerId);
    let updated = removePlayer(gs, playerId);
    const newCount = updated.players.length;

    if (newCount === 0) {
      await sb.from("game_tables").delete().eq("id", row.id);
      await broadcastToTable(row.id, { type: "table_closed" });
      continue;
    }

    if (
      updated.phase === "dealer_turn" &&
      (gs.phase === "playing" || gs.phase === "insurance")
    ) {
      const { state: completed } = runToCompletion(updated);
      updated = completed;
    }

    const newStatus =
      updated.phase === "finished" ? "waiting" :
      updated.phase === "playing" ||
        updated.phase === "betting" ||
        updated.phase === "insurance"
        ? "playing"
      : "waiting";

    const updateFields: Record<string, unknown> = {
      game_state: toClientState(updated),
      deck_data: serializeDeck(updated.deck),
      player_count: newCount,
      status: newStatus,
    };

    if (playerId === row.creator_id && updated.players.length > 0) {
      updateFields.creator_id = updated.players[0].id;
      updateFields.created_by = updated.players[0].name;
    }

    await sb.from("game_tables").update(updateFields).eq("id", row.id);

    await broadcastToTable(row.id, {
      type: "player_left",
      playerName: leavingPlayer?.name ?? "",
      playerCount: newCount,
    });
    await broadcastToTable(row.id, {
      type: "state_update",
      state: toClientState(updated),
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { playerId, playerName } = (await request.json()) as {
    playerId: string;
    playerName: string;
  };

  if (!playerId || !playerName) {
    return Response.json({ error: "Faltan campos" }, { status: 400 });
  }

  const sb = getSupabase();

  // Remove the player from any other tables first
  await leaveOtherTables(sb, playerId, id);

  const { data: table, error } = await sb
    .from("game_tables")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !table) {
    return Response.json({ error: "Mesa no encontrada" }, { status: 404 });
  }

  if (table.player_count >= table.max_players) {
    return Response.json({ error: "Mesa llena" }, { status: 400 });
  }

  const gameState: GameState = {
    ...table.game_state,
    deck: deserializeDeck(table.deck_data),
  };

  if (gameState.players.some((p: { id: string }) => p.id === playerId)) {
    return Response.json({ ok: true, alreadyJoined: true });
  }

  const updated = addPlayer(gameState, playerId, playerName);
  const newCount = updated.players.length;

  const { error: updateError } = await sb
    .from("game_tables")
    .update({
      game_state: toClientState(updated),
      deck_data: serializeDeck(updated.deck),
      player_count: newCount,
    })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await broadcastToTable(id, {
    type: "player_joined",
    playerName,
    playerCount: newCount,
  });

  await broadcastToTable(id, {
    type: "state_update",
    state: toClientState(updated),
  });

  return Response.json({ ok: true });
}
