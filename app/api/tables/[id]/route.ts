import { getSupabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = getSupabase();

  const { data, error } = await sb
    .from("game_tables")
    .select("id, name, invite_code, is_private, status, max_players, min_bet, max_bet, deck_count, game_state, created_by, creator_id, player_count, created_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: "Mesa no encontrada" }, { status: 404 });
  }

  return Response.json(data);
}
