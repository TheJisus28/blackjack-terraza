"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { compact } from "@/lib/format";
import { STAKE_PRESETS, THEMES, type CreateTableInput } from "@/lib/game/tables";
import { errorText, toast } from "@/lib/toast";

const DEFAULTS: CreateTableInput = {
  name: "",
  stake: 1,
  decks: 6,
  hitSoft17: false,
  blackjackPays: 1.5,
  surrender: true,
  sideBets: true,
  bots: 2,
  seats: 7,
  theme: "emerald",
  isPrivate: false,
};

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center justify-between gap-3 py-1 text-left">
      <span>{label}</span>
      <span className={`pixel-inset px-2 py-0.5 font-display text-[0.55rem] ${value ? "text-green" : "text-ink-dim"}`}>
        {value ? "SÍ" : "NO"}
      </span>
    </button>
  );
}

export function CreateTableModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const patch = (p: Partial<CreateTableInput>) => setForm((f) => ({ ...f, ...p }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/api/tables", { action: "create", table: form });
      toast.success("¡Mesa creada!");
      setForm(DEFAULTS);
      onClose();
      router.push(`/mesa/${id}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="CREAR MESA" width="max-w-xl">
      <form onSubmit={submit} className="flex flex-col gap-5 text-base">
        <label className="flex flex-col gap-2">
          <span className="text-ink-dim">Nombre de la mesa</span>
          <input
            className="pixel-input"
            value={form.name}
            maxLength={28}
            placeholder="La mesa de los valientes"
            onChange={(e) => patch({ name: e.target.value })}
            required
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-ink-dim">Apuestas (mínima – máxima)</span>
          <div className="grid grid-cols-4 gap-2">
            {STAKE_PRESETS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => patch({ stake: i })}
                className={`pixel-btn px-1 text-[0.5rem] ${form.stake === i ? "btn-gold" : ""}`}
              >
                {compact(s.min)}-{compact(s.max)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-ink-dim">Mazos</span>
            <select
              className="pixel-input"
              value={form.decks}
              onChange={(e) => patch({ decks: Number(e.target.value) as CreateTableInput["decks"] })}
            >
              {[1, 2, 4, 6, 8].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-ink-dim">Asientos</span>
            <select className="pixel-input" value={form.seats} onChange={(e) => patch({ seats: Number(e.target.value) })}>
              {[3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-ink-dim">Bots (IA)</span>
            <select className="pixel-input" value={form.bots} onChange={(e) => patch({ bots: Number(e.target.value) })}>
              {[0, 1, 2, 3, 4, 5, 6].filter((b) => b < form.seats).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-ink-dim">Pago del blackjack</span>
            <select
              className="pixel-input"
              value={form.blackjackPays}
              onChange={(e) => patch({ blackjackPays: Number(e.target.value) as 1.5 | 1.2 })}
            >
              <option value={1.5}>3:2</option>
              <option value={1.2}>6:5</option>
            </select>
          </label>
        </div>

        <div className="pixel-inset flex flex-col gap-1 px-4 py-3">
          <Toggle label="El crupier pide con 17 suave (H17)" value={form.hitSoft17} onChange={(v) => patch({ hitSoft17: v })} />
          <Toggle label="Permitir rendición" value={form.surrender} onChange={(v) => patch({ surrender: v })} />
          <Toggle
            label="Apuestas laterales (Pares, 21+3, Hot 3, Bust It)"
            value={form.sideBets}
            onChange={(v) => patch({ sideBets: v })}
          />
          <Toggle label="Mesa privada (solo con enlace)" value={form.isPrivate} onChange={(v) => patch({ isPrivate: v })} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-ink-dim">Color del paño</span>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                onClick={() => patch({ theme: t.id })}
                className="h-9 w-9"
                style={{
                  background: t.felt,
                  boxShadow: `0 0 0 3px ${form.theme === t.id ? t.accent : "#120d22"}`,
                }}
              />
            ))}
          </div>
        </div>

        <button className="pixel-btn btn-gold py-3 text-xs" disabled={busy} type="submit">
          {busy ? "Creando..." : "Crear y sentarme"}
        </button>
      </form>
    </Modal>
  );
}
