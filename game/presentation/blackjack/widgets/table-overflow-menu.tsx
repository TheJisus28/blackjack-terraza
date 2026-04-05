"use client";

import { useEffect, useRef, useState } from "react";

type TableOverflowMenuProps = {
  /** You are in spectator / stand-up mode (not betting this round). */
  isSpectator: boolean;
  canStandUp: boolean;
  canSitIn: boolean;
  onStandUp: () => void;
  onSitIn: () => void;
  onLeaveTable: () => void;
};

export function TableOverflowMenu({
  isSpectator,
  canStandUp,
  canSitIn,
  onStandUp,
  onSitIn,
  onLeaveTable,
}: TableOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const statusLabel = isSpectator
    ? "Watching"
    : "Seated & playing";
  const statusHint = isSpectator
    ? "Not betting this round — sit in to join the next one."
    : "You can bet and take actions when it is your turn.";

  return (
    <div className="relative z-50 isolate" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Table menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-[min(18rem,calc(100vw-2rem))] py-1 rounded-lg bg-zinc-900/95 border border-white/10 shadow-xl z-[100] backdrop-blur-sm"
        >
          <div className="px-3 pt-2 pb-2 border-b border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              Your seat
            </p>
            <p className="text-sm font-semibold text-white mt-0.5">{statusLabel}</p>
            <p className="text-xs text-white/55 mt-1 leading-snug">{statusHint}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            disabled={!canStandUp}
            title={
              !canStandUp
                ? "Only between rounds, with no active bet or cards"
                : undefined
            }
            onClick={() => {
              setOpen(false);
              onStandUp();
            }}
            className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Stand up & watch
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canSitIn}
            title={
              !canSitIn
                ? "You are already seated for play"
                : "Join the next betting round"
            }
            onClick={() => {
              setOpen(false);
              onSitIn();
            }}
            className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Sit in to play
          </button>
          <div className="my-1 h-px bg-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLeaveTable();
            }}
            className="w-full text-left px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/15 cursor-pointer"
          >
            Leave table
          </button>
        </div>
      )}
    </div>
  );
}
