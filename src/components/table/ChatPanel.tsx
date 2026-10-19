"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/hooks/useTable";
import { errorText, toast } from "@/lib/toast";

export function ChatPanel({
  messages,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  return (
    // Phones: a sheet over the bottom HUD (or a column on the left when sideways); desktop: a box on the right.
    <div className="pointer-events-auto absolute inset-x-[max(0.5rem,env(safe-area-inset-left))] bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 flex flex-col short:inset-x-auto short:bottom-2 short:left-[max(0.5rem,env(safe-area-inset-left))] short:top-[calc(3.5rem+env(safe-area-inset-top))] short:w-[min(20rem,50vw)] desk:inset-x-auto desk:bottom-40 desk:right-3 desk:z-30 desk:w-80">
      <div className="pixel-box flex max-h-[55dvh] flex-col short:h-full short:max-h-none desk:max-h-[45vh]">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-display text-[0.55rem] text-gold">CHAT DE LA MESA</span>
          <button className="pixel-btn btn-ghost px-2 py-1 text-[0.5rem]" onClick={onClose} aria-label="Cerrar chat">
            X
          </button>
        </div>
        <div ref={list} className="scrollbar-pixel flex-1 overflow-y-auto px-3 pb-2 text-base">
          {messages.length === 0 && <p className="text-ink-dim">Saluda a la mesa 👋</p>}
          {messages.map((m) => (
            <p key={m.id} className="break-words leading-snug">
              <span className="text-gold">{m.name}:</span> {m.text}
            </p>
          ))}
        </div>
        <form
          className="flex gap-2 p-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = text;
            setText("");
            try {
              await onSend(value);
            } catch (err) {
              toast.error(errorText(err));
            }
          }}
        >
          {/* 16px on phones: smaller inputs make iOS zoom the page on focus. */}
          <input
            className="pixel-input py-1.5 text-base desk:text-sm"
            value={text}
            maxLength={200}
            placeholder="Escribe un mensaje..."
            onChange={(e) => setText(e.target.value)}
          />
          <button className="pixel-btn btn-gold px-2 text-[0.5rem] pointer-coarse:px-3" type="submit">
            OK
          </button>
        </form>
      </div>
    </div>
  );
}
