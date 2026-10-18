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
    <div className="pointer-events-auto absolute bottom-40 right-3 z-30 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col">
      <div className="pixel-box flex max-h-[45vh] flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-display text-[0.55rem] text-gold">CHAT DE LA MESA</span>
          <button className="pixel-btn btn-ghost px-2 py-1 text-[0.5rem]" onClick={onClose}>
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
          <input
            className="pixel-input py-1.5 text-sm"
            value={text}
            maxLength={200}
            placeholder="Escribe un mensaje..."
            onChange={(e) => setText(e.target.value)}
          />
          <button className="pixel-btn btn-gold px-2 text-[0.5rem]" type="submit">
            OK
          </button>
        </form>
      </div>
    </div>
  );
}
