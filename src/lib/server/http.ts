import "server-only";
import { ZodError } from "zod";
import { GameError } from "@/lib/game/types";
import { adminAuth } from "./admin";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(req: Request): Promise<{ uid: string; name?: string; anonymous: boolean }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Inicia sesión para jugar");
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
      anonymous: decoded.firebase?.sign_in_provider === "anonymous",
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("[auth] verifyIdToken failed:", err);
    throw new HttpError(401, "Tu sesión expiró, vuelve a entrar");
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Solicitud inválida");
  }
}

export function ok(data: unknown = {}) {
  return Response.json({ ok: true, ...((data as object) ?? {}) });
}

export function fail(err: unknown) {
  if (err instanceof GameError) return Response.json({ ok: false, error: err.message }, { status: 400 });
  if (err instanceof HttpError) return Response.json({ ok: false, error: err.message }, { status: err.status });
  if (err instanceof ZodError) {
    return Response.json({ ok: false, error: err.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  console.error("[api]", err);
  return Response.json({ ok: false, error: "Error del servidor, inténtalo de nuevo" }, { status: 500 });
}
