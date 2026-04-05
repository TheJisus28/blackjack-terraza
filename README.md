# Blackjack Terraza

Multiplayer blackjack in the browser: solo mode, private tables, and real-time play. Built with [Next.js](https://nextjs.org) and [Supabase](https://supabase.com) for sync.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Configure Supabase in `.env.local` if you use multiplayer tables.

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for the **game-style** layout: `game/simulation/`, `game/presentation/`, `shared/`, and `app/`.

## Scripts

| Command   | Description        |
| --------- | ------------------ |
| `pnpm dev`    | Development server |
| `pnpm build`  | Production build   |
| `pnpm start`  | Run production     |
| `pnpm lint`   | ESLint             |

## Author

[TheJisus28](https://github.com/TheJisus28)
