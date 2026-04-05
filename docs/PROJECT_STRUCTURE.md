# Project structure

The repo is organized like a **video game** built on the web: a **simulation** (rules and state), a **presentation** (what the player sees and hears), and a **platform shell** (Next.js routes and shared services).

## Layout

| Path | Role (game terms) |
|------|-------------------|
| `game/simulation/blackjack/` | **Core simulation**: `model/` (types), `meta/` (`PHASE`, `PLAYER_ACTION`), `rules/` (deck, hand, constants), `table/` (deal order, `view-queries`, `table-row-status` → lobby row `status`), `engine.ts`. Public API: `@/game/simulation/blackjack`. |
| `game/presentation/blackjack/` | **Blackjack product**: `scenes/` = full screens; `widgets/` = table UI; `runtime/` = client hooks (solo/MP orchestration); `fx/` = presentation timing / FSM helpers (deal wave, chips, stable deal indices). |
| `game/presentation/lobby/` | **Lobby / front-end scene**: `widgets/` (table list, create dialog). Meta-game UI before joining a session. |
| `app/` | **Platform entry**: App Router pages and API routes only. Keep files thin; compose presentation components here. |
| `shared/` | **Platform services**: Supabase, broadcast, identity, uuid, shared audio defs, generic hooks (e.g. sequential reveal). `shared/types/` holds **wire contracts** (e.g. `blackjack-session-action.ts`) shared by API routes and clients so action names stay in one place. |

## Dependency direction

```
app/api/*              → game/simulation/blackjack + shared/lib
app/pages              → game/presentation/* + shared/*
game/presentation/*    → game/simulation/blackjack + shared/*
game/simulation/*      → shared/lib/uuid (ids only); optional read-only helpers in `table/view-queries.ts` for UI
shared/types/*         → game/simulation/blackjack (for `PlayerAction` only in session contract)
```

## Where to add code

- New **rules, phases, or state shape**: `game/simulation/blackjack/` (extend `model/types` + `engine.ts`).
- New **full screens**: `game/presentation/blackjack/scenes/<name>/` (compose widgets + runtime hooks).
- New **reusable table UI**: `game/presentation/blackjack/widgets/`.
- New **client orchestration** (effects, subscriptions): `game/presentation/blackjack/runtime/`.
- New **presentation-only timing / polish**: `game/presentation/blackjack/fx/`.
- New **infrastructure** (DB, transport, auth): `shared/lib/`.

## Language

User-facing copy and code comments are **English**. The product name “Terraza” may stay in branding strings where desired.
