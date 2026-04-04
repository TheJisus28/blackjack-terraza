"use client";

import { use } from "react";
import { MultiplayerTable } from "@/components/game/MultiplayerTable";

export default function TablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <MultiplayerTable tableId={id} />;
}
