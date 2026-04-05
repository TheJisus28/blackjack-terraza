import { getSupabase } from "@/shared/lib/supabase";
import {
  createMultiplayerGame,
  addPlayer,
  toClientState,
  serializeDeck,
} from "@/game/simulation/blackjack/engine";
import { DEFAULT_MIN_BET, DEFAULT_MAX_BET } from "@/game/simulation/blackjack/constants";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    name,
    isPrivate = false,
    maxPlayers = 7,
    minBet = DEFAULT_MIN_BET,
    maxBet = DEFAULT_MAX_BET,
    deckCount = 6,
    createdBy,
    creatorId,
  } = body as {
    name: string;
    isPrivate?: boolean;
    maxPlayers?: number;
    minBet?: number;
    maxBet?: number;
    deckCount?: number;
    createdBy: string;
    creatorId: string;
  };

  if (!name || !createdBy || !creatorId) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  let gameState = createMultiplayerGame({ minBet, maxBet, deckCount });
  gameState = addPlayer(gameState, creatorId, createdBy);

  const inviteCode = generateInviteCode();

  const sb = getSupabase();

  const { data, error } = await sb
    .from("game_tables")
    .insert({
      name,
      invite_code: inviteCode,
      is_private: isPrivate,
      status: "waiting",
      max_players: maxPlayers,
      min_bet: minBet,
      max_bet: maxBet,
      deck_count: deckCount,
      game_state: toClientState(gameState),
      deck_data: serializeDeck(gameState.deck),
      created_by: createdBy,
      creator_id: creatorId,
      player_count: 1,
    })
    .select("id, invite_code")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ id: data.id, inviteCode: data.invite_code });
}

const STALE_TABLE_HOURS = 1;

async function cleanupStaleTables(sb: ReturnType<typeof getSupabase>) {
  const cutoff = new Date(Date.now() - STALE_TABLE_HOURS * 60 * 60 * 1000).toISOString();

  // Delete finished tables and tables older than 1 hour
  await sb.from("game_tables").delete().eq("status", "finished");
  await sb.from("game_tables").delete().eq("player_count", 0);
  await sb.from("game_tables").delete().lt("created_at", cutoff);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const sb = getSupabase();

  // Fire-and-forget cleanup on every list request
  cleanupStaleTables(sb).catch(() => {});

  if (code) {
    const { data, error } = await sb
      .from("game_tables")
      .select("id, name, invite_code, is_private, status, max_players, min_bet, max_bet, player_count, created_by, created_at")
      .eq("invite_code", code.toUpperCase())
      .single();

    if (error || !data) {
      return Response.json({ error: "Table not found" }, { status: 404 });
    }
    return Response.json(data);
  }

  const { data, error } = await sb
    .from("game_tables")
    .select("id, name, invite_code, status, max_players, min_bet, max_bet, player_count, created_by, created_at")
    .eq("is_private", false)
    .in("status", ["waiting", "playing"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? []);
}
