/**
 * Blackjack simulation: pure rules engine, types, and deal-order helpers.
 * Presentation and routes live under `game/presentation/` and `app/`; I/O in `shared/`.
 *
 * Layout: `model/` (types), `meta/` (phase & player moves), `rules/` (deck, hand, constants),
 * `table/` (deal order, lobby status, view queries), `engine.ts` (orchestration).
 */
export * from "./model/types";
export * from "./meta/game-phase";
export * from "./meta/player-action-kind";
export * from "./table/table-row-status";
export * from "./rules/constants";
export * from "./rules/deck";
export * from "./rules/hand";
export * from "./table/deal-sequence";
export * from "./engine";
export * from "./table/view-queries";
