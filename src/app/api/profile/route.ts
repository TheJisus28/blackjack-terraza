import { z } from "zod";
import { AvatarSchema } from "@/lib/avatar";
import { fail, ok, readJson, requireUser } from "@/lib/server/http";
import { claimDaily, claimRescue, initProfile, updateProfile } from "@/lib/server/profiles";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("init") }),
  z.object({ action: z.literal("update"), name: z.string().max(40), avatar: AvatarSchema }),
  z.object({ action: z.literal("daily") }),
  z.object({ action: z.literal("rescue") }),
]);

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = Body.parse(await readJson(req));
    switch (body.action) {
      case "init":
        return ok({ profile: await initProfile(user.uid, user.name) });
      case "update":
        return ok({ profile: await updateProfile(user.uid, body.name, body.avatar) });
      case "daily":
        return ok(await claimDaily(user.uid));
      case "rescue":
        return ok(await claimRescue(user.uid));
    }
  } catch (err) {
    return fail(err);
  }
}
