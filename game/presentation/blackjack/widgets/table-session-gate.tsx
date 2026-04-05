"use client";

import Link from "next/link";

export function TableSessionLoading() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0f0f1a]">
      <div
        className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"
        aria-hidden
      />
      <p className="sr-only">Loading table</p>
    </div>
  );
}

interface TableSessionErrorProps {
  message: string;
}

export function TableSessionError({ message }: TableSessionErrorProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0f0f1a] gap-4">
      <p className="text-red-400 font-semibold">{message}</p>
      <Link
        href="/lobby"
        className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
      >
        Back to lobby
      </Link>
    </div>
  );
}
