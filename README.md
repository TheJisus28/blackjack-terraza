# Blackjack Terraza

Real-time multiplayer blackjack in the browser: **solo** practice, **lobby**, and **private tables** with live sync. Stack: [Next.js](https://nextjs.org) (App Router), [React](https://react.dev), [Tailwind CSS](https://tailwindcss.com), [Supabase](https://supabase.com) (Postgres + Realtime broadcast).

## Requirements

- **Node.js** 20+ (LTS recommended)
- **pnpm** (repo uses `pnpm`; `npm` / `yarn` work if you adapt commands)

## Run locally

```bash
pnpm install
cp .env.example .env.local   # then fill in Supabase (see below)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

- **`/`** — landing  
- **`/play`** — solo blackjack (no Supabase needed)  
- **`/lobby`** and **`/table/[id]`** — multiplayer (needs env + database)

## Environment variables

Create **`.env.local`** (gitignored). Copy from [`.env.example`](.env.example).

| Variable | Required for | Description |
| -------- | ------------ | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Lobby, tables, APIs | Project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same | `anon` `public` key (Settings → API) |

The app uses the **anon** key with RLS policies defined in the migration; there is no separate server-only Supabase secret in this repo.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run [`supabase/migration.sql`](supabase/migration.sql) to create `game_tables` and RLS policies.
3. Enable **Realtime** for your project (Dashboard → **Project Settings → Realtime**). Clients subscribe to **broadcast** channels for table updates.
4. Paste **Project URL** and **anon public** key into `.env.local`.

Without these steps, solo play still works; lobby and API routes that touch the database will fail.

## Project layout

Authoritative rules and types live under **`game/simulation/`**; UI under **`game/presentation/`**; Supabase, identity, and shared types under **`shared/`**; thin routes under **`app/`**. Details: [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md).

## Scripts

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Dev server (`next dev`) |
| `pnpm build` | Production build |
| `pnpm start` | Production server |
| `pnpm lint` | ESLint |

## Author

[TheJisus28](https://github.com/TheJisus28)
