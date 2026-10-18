import { z } from "zod";
import { CreateTableSchema } from "@/lib/game/tables";
import { fail, ok, readJson, requireUser } from "@/lib/server/http";
import { createCustomTable, ensureOfficialTables, sweepTables } from "@/lib/server/tables";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sweep") }),
  z.object({ action: z.literal("create"), table: CreateTableSchema }),
]);

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = Body.parse(await readJson(req));
    switch (body.action) {
      case "sweep":
        await ensureOfficialTables();
        return ok(await sweepTables());
      case "create":
        return ok({ id: await createCustomTable(user.uid, body.table) });
    }
  } catch (err) {
    return fail(err);
  }
}
