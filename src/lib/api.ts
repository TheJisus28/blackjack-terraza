"use client";

import { firebase } from "@/lib/firebase/client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  const user = firebase().auth.currentUser;
  if (!user) throw new ApiError("Inicia sesión para continuar", 401);
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Sin conexión con el servidor", 0);
  }
  const data = (await res.json().catch(() => null)) as ({ ok: boolean; error?: string } & T) | null;
  if (!data) throw new ApiError("Respuesta inválida del servidor", res.status);
  if (!data.ok) throw new ApiError(data.error ?? "Algo salió mal", res.status);
  return data;
}

export const tableAction = (tableId: string, action: Record<string, unknown>) =>
  api(`/api/tables/${tableId}`, action);
