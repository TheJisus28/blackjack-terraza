"use client";

import { create } from "zustand";

export type ToastKind = "info" | "success" | "error" | "chips";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastStore {
  items: ToastItem[];
  push: (kind: ToastKind, text: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>((set) => ({
  items: [],
  push: (kind, text) => {
    const id = nextId++;
    set((s) => ({ items: [...s.items.slice(-3), { id, kind, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), kind === "error" ? 4500 : 3200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (text: string) => useToasts.getState().push("info", text),
  success: (text: string) => useToasts.getState().push("success", text),
  error: (text: string) => useToasts.getState().push("error", text),
  chips: (text: string) => useToasts.getState().push("chips", text),
};

export function errorText(err: unknown) {
  return err instanceof Error ? err.message : "Algo salió mal";
}
