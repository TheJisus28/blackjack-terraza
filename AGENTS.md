<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Game layout

Blackjack logic lives under `game/simulation/blackjack/` (rules, pure state; subfolders `model/`, `meta/`, `rules/`, `table/`). UI: `game/presentation/blackjack/scenes/`, `widgets/`, `runtime/` (client hooks), `fx/` (presentation timing). See `docs/PROJECT_STRUCTURE.md` and `game/README.md`.
