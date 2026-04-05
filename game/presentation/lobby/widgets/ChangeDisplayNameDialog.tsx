"use client";

import { useEffect, useState } from "react";

interface ChangeDisplayNameDialogProps {
  open: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (name: string) => void;
}

export function ChangeDisplayNameDialog({
  open,
  onClose,
  currentName,
  onSave,
}: ChangeDisplayNameDialogProps) {
  const [draft, setDraft] = useState(currentName);

  useEffect(() => {
    if (open) setDraft(currentName);
  }, [open, currentName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="change-name-title"
        aria-modal="true"
        className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="change-name-title" className="text-xl font-bold text-white mb-1">
          Change display name
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          This is how other players see you in multiplayer.
        </p>

        <label htmlFor="display-name-input" className="sr-only">
          Display name
        </label>
        <input
          id="display-name-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) {
              onSave(trimmed);
              onClose();
            }
          }}
          maxLength={20}
          autoFocus
          placeholder="Your name..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center
            text-lg placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors mb-5"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium
              transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canSave) return;
              onSave(trimmed);
              onClose();
            }}
            disabled={!canSave}
            className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold
              disabled:opacity-40 transition-colors cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
