# Sequence Arena

A real-time, server-authoritative multiplayer take on the classic five-in-a-row card/chip board game.
Private rooms, 1v1 and 2v2, guest login, reconnection, rematches, persistence and stats.

```
apps/
  web/        Next.js 15 (App Router) + Tailwind v4 + Zustand + Motion + Lucide
  server/     Express + Socket.IO + Zod + Prisma (PostgreSQL)
packages/
  shared/     Shared types, Socket.IO event contracts, Zod schemas, card helpers
  game-engine/ Pure, framework-free rules engine (deck, board, moves, sequences, winner)
```

## Quick start

Requirements: Node 20+, pnpm 9+ (`corepack enable`), Docker (optional, for PostgreSQL).

```bash
pnpm install
cp apps/server/.env.example apps/server/.env   # set JWT_SECRET (see file)
cp apps/web/.env.example apps/web/.env.local

# Optional persistence
docker compose up -d          # PostgreSQL on :5432
pnpm db:deploy                # apply migrations
pnpm db:seed                  # demo users/stats

pnpm dev                      # server :4000 + web :3000
```

Open http://localhost:3000, pick a nickname, create a room, and share the code or invite link.
To play from other devices on your LAN, set `NEXT_PUBLIC_SERVER_URL=http://<your-ip>:4000` in
`apps/web/.env.local` and add `http://<your-ip>:3000` to `CLIENT_ORIGIN` in `apps/server/.env`.

Without `DATABASE_URL` the server runs fully in memory (no stats/history). Without `JWT_SECRET`
(development only) an ephemeral secret is generated and sessions reset on restart.

## Scripts

| Command                                     | Description                                                     |
| ------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                  | Run server (tsx watch) and web (next dev)                       |
| `pnpm build`                                | Build server (tsup → `apps/server/dist`) and web (`next build`) |
| `pnpm start`                                | Run production builds                                           |
| `pnpm test`                                 | Vitest: engine unit tests + server Socket.IO integration tests  |
| `pnpm typecheck`                            | `tsc --noEmit` in every package                                 |
| `pnpm lint`                                 | ESLint (typescript-eslint) across the monorepo                  |
| `pnpm db:migrate` / `db:deploy` / `db:seed` | Prisma migrations (dev / prod) and seed                         |

## Architecture

- **Server-authoritative.** Clients send intents (`game:action`); the server validates with Zod, then with
  the engine (`validateMove`/`applyAction`), and broadcasts the new public state. Client-side legality checks
  are only used for highlighting.
- **No private-data leakage.** `toPublicState` strips the deck order and every hand. Hands are sent only to
  each player's private `user:<id>` channel.
- **Atomic, idempotent moves.** All transitions run synchronously in Node's event loop. Every action carries
  `actionId` (idempotency key, cached per room) and `expectedVersion` (optimistic concurrency → `STALE_STATE`).
  Persistence is queued per room after the transition and never blocks or breaks gameplay.
- **Secure shuffling.** `crypto.getRandomValues` with rejection sampling (unbiased Fisher–Yates).
- **Auth.** `POST /api/auth/guest` issues an HS256 JWT (7 days). Sockets authenticate in the handshake; one
  active socket per user — a newer connection replaces the old one (`session:replaced`), so no duplicate seats.
- **Rate limiting.** HTTP via `express-rate-limit`; sockets via per-connection token buckets (plus a stricter
  chat bucket). Helmet, CORS allow-list, 10 KB body and 16 KB socket payload limits.

### Socket events

Client → server (all acknowledged with `{ ok, data | error, code }`):
`room:create`, `room:join`, `room:leave`, `room:ready`, `room:setTeam`, `room:setMode`, `room:start`,
`room:toLobby`, `game:action`, `game:sync`, `game:rematch`, `chat:send`.

Server → client:
`room:state`, `room:closed`, `game:state`, `game:hand`, `game:event`, `game:over`, `game:rematch`,
`player:disconnected`, `player:reconnected`, `chat:message`, `session:replaced`.

### HTTP API

`GET /api/health` · `POST /api/auth/guest` · `GET /api/auth/me` · `GET /api/rooms/:code` · `GET /api/stats/me`

### Database (Prisma)

`User`, `Room`, `RoomPlayer`, `Game`, `GamePlayer`, `GameMove`, `GameResult`, `UserStats` — see
`apps/server/prisma/schema.prisma` and the initial migration in `apps/server/prisma/migrations`.
Accepted moves (and turn timeouts) are stored with a unique `(gameId, version)`; finished games write a
`GameResult` and update `UserStats` in one transaction.

## Game rules implemented

- 10×10 board, 4 free corners, every non-jack card printed twice (verified by tests). Two 52-card decks, no jokers.
- Hands: 7 cards (1v1), 6 cards (2v2). Seats alternate teams (red, blue, red, blue).
- Normal card → one of its two open matching cells. Two-eyed jacks (♦, ♣) → any open non-corner cell.
  One-eyed jacks (♠, ♥) → remove an opponent chip that is not in a completed sequence.
- Sequences: 5 in a row horizontally, vertically or diagonally; corners count for both teams.
  A new sequence may share at most **one** cell with any existing sequence of the same team.
  One placement can complete two sequences (e.g. filling the middle of nine in a row).
- 2 sequences win in both 1v1 and 2v2.

### Assumptions needing confirmation

1. **Dead cards:** on your turn you may exchange **one** dead card (both cells occupied) for a new card; your
   turn continues.
2. **Empty deck:** the discard pile is reshuffled into a new draw pile.
3. **Turn timer:** 60 s (`TURN_SECONDS`). On expiry the turn is skipped (no card played or drawn).
4. **Disconnect policy:** a seat is reserved for 60 s (`RECONNECT_SECONDS`). If the player does not return,
   their team forfeits and they are removed. Leaving mid-game forfeits immediately.
5. **Lobby:** the host does not need to ready up; everyone else must. Host leaves → host passes to the next
   connected player. A finished room can rematch only if all seats are still filled; otherwise the host
   returns everyone to the lobby.
6. **Stalemate guard:** the game ends in a draw after 1000 turns.
7. The board layout is a widely used community layout; artwork and branding are original.

## Testing

```bash
pnpm test
```

- `packages/game-engine/test` — deck/board integrity, dealing, normal & jack moves, dead cards, all sequence
  directions, corners, overlap rule, winner detection, invalid moves, timeouts, forfeits, rematch reset,
  public-state privacy, and randomized full-game simulations checking card conservation.
- `apps/server/test` — real Socket.IO clients against an in-process server: auth, capacity/team validation,
  2v2 flow, host transfer, hand privacy, idempotent duplicate events, out-of-turn and simultaneous moves,
  turn timeout, win + rematch, forfeit on leave, reconnection with hand restore, reconnect timeout,
  duplicate sessions, and chat rate limiting.

## Deployment

1. Provision PostgreSQL and set `DATABASE_URL`, a strong `JWT_SECRET`, `NODE_ENV=production` and
   `CLIENT_ORIGIN` (your web origin) for the server.
2. `pnpm install --frozen-lockfile && pnpm build`
3. Server: `pnpm db:deploy && node apps/server/dist/index.js` (behind TLS; WebSockets must be allowed).
4. Web: set `NEXT_PUBLIC_SERVER_URL` at build time, then `pnpm --filter @sequence/web start` (or deploy
   `apps/web` to any Next.js host).

**Scaling note:** room state lives in the server process, so run a single instance or use sticky sessions
keyed by room. Horizontal scaling would move room state to Redis (and add `@socket.io/redis-adapter`);
the `RoomManager` is the single seam for that change.
