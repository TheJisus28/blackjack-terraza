"use client";

import { use } from "react";
import { MultiplayerTable } from "@/game/presentation/blackjack";

export default function TablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <MultiplayerTable tableId={id} />;
}
