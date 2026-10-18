import { z } from "zod";
import { MAX_SEATS } from "@/lib/game/constants";
import { SIDE_BET_IDS } from "@/lib/game/sidebets";
import { fail, HttpError, ok, readJson, requireUser } from "@/lib/server/http";
import { leaveTable, rebuy, runTableAction, sitDown } from "@/lib/server/tables";

const chips = z.number().int().min(0).max(1_000_000_000);

const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sit"), seat: z.number().int().min(0).max(MAX_SEATS - 1), buyIn: chips }),
  z.object({ type: z.literal("rebuy"), amount: chips }),
  z.object({ type: z.literal("leave") }),
  z.object({ type: z.literal("bet"), amount: chips, mode: z.enum(["add", "set"]).optional() }),
  z.object({ type: z.literal("side"), bet: z.enum(SIDE_BET_IDS), amount: chips, mode: z.enum(["add", "set"]).optional() }),
  z.object({ type: z.literal("repeat") }),
  z.object({ type: z.literal("clearBet") }),
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("hit") }),
  z.object({ type: z.literal("stand") }),
  z.object({ type: z.literal("double") }),
  z.object({ type: z.literal("split") }),
  z.object({ type: z.literal("surrender") }),
  z.object({ type: z.literal("insurance"), take: z.boolean() }),
  z.object({ type: z.literal("tick") }),
]);

export async function POST(req: Request, ctx: RouteContext<"/api/tables/[id]">) {
  try {
    const { id } = await ctx.params;
    if (!/^[a-z0-9-]{3,40}$/.test(id)) throw new HttpError(404, "Mesa no encontrada");
    const user = await requireUser(req);
    const action = Action.parse(await readJson(req));
    switch (action.type) {
      case "sit":
        await sitDown(id, user.uid, action.seat, action.buyIn);
        break;
      case "rebuy":
        await rebuy(id, user.uid, action.amount);
        break;
      case "leave":
        await leaveTable(id, user.uid);
        break;
      default:
        await runTableAction(id, user.uid, action);
    }
    return ok();
  } catch (err) {
    return fail(err);
  }
}
