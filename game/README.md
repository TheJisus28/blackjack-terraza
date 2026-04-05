# Game code

This folder holds product logic structured like a typical game codebase, separate from the Next.js shell in `app/`.

- **`simulation/`** — Authoritative rules and state transitions (no UI, no network). Safe to run on the server or in tests.
- **`presentation/`** — Scenes and widgets (React). Example: `blackjack/scenes/`, `blackjack/widgets/`, `blackjack/runtime/` (hooks), `blackjack/fx/` (deal-wave / presentation helpers); lobby uses `lobby/widgets/`.

Platform glue (Supabase, broadcast, identity) stays in **`shared/`** at the repo root.
