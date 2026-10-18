"use client";

import { useToasts, type ToastKind } from "@/lib/toast";
import { ChipIcon } from "./Chip";

const STYLE: Record<ToastKind, string> = {
  info: "bg-panel-2",
  success: "bg-[#1f5e3d]",
  error: "bg-[#6d1f2a]",
  chips: "bg-[#5a4313]",
};

export function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-3 px-4">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pixel-box animate-pop-in pointer-events-auto flex max-w-md items-center gap-3 px-4 py-2.5 text-left text-base ${STYLE[t.kind]}`}
        >
          {t.kind === "chips" && <ChipIcon value={1000} size={24} />}
          {t.kind === "error" && <span className="font-display text-xs text-red">!</span>}
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
