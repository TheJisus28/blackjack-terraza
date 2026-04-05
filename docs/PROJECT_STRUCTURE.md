# Project structure

The repo is organized like a **video game** built on the web: a **simulation** (rules and state), a **presentation** (what the player sees and hears), and a **platform shell** (Next.js routes and shared services).

## Layout

| Path | Role (game terms) |
|------|-------------------|
| `game/simulation/blackjack/` | **Core simulation**: rules, types, deck, hands, deal order. Phase literals: `PHASE` / `GamePhase`; moves: `PLAYER_ACTION`. `table-row-status.ts` maps simulation phase → lobby row `status` (shared by API routes). |
| `game/presentation/blackjack/` | **Blackjack product**: `scenes/` = full screens; `widgets/` = table UI; `hooks/` = client orchestration; `lib/` includes **presentation FSM** (`table-surface-fsm.ts` — HUD vs deal-wave) and deal-wave helpers. Routes: `@/game/presentation/blackjack`. |
| `game/presentation/lobby/` | **Lobby / front-end scene**: table list, create table. Meta-game UI before joining a session. |
| `app/` | **Platform entry**: App Router pages and API routes only. Keep files thin; compose presentation components here. |
| `shared/` | **Platform services**: Supabase, broadcast, identity, uuid, shared audio defs, generic hooks (e.g. sequential reveal). `shared/types/` holds **wire contracts** (e.g. `blackjack-session-action.ts`) shared by API routes and clients so action names stay in one place. |

## Dependency direction

```
app/api/*              → game/simulation/blackjack + shared/lib
app/pages              → game/presentation/* + shared/*
game/presentation/*    → game/simulation/blackjack + shared/*
game/simulation/*      → shared/lib/uuid (ids only); optional read-only helpers in `view-queries.ts` for UI
shared/types/*         → game/simulation/blackjack/types (for `PlayerAction` only in session contract)
```

## Where to add code

- New **rules, phases, or state shape**: `game/simulation/blackjack/` (extend types + engine).
- New **full screens**: `game/presentation/blackjack/scenes/<name>/` (compose widgets + hooks).
- New **reusable table UI**: `game/presentation/blackjack/widgets/`.
- New **infrastructure** (DB, transport, auth): `shared/lib/`.

## Language

User-facing copy and code comments are **English**. The product name “Terraza” may stay in branding strings where desired.
