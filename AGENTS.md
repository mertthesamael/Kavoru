# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project overview

Production-ready **ElysiaJS** backend template using **Bun**, **TypeScript**, **Prisma**, and **Docker**.

- Entry point: `src/index.ts` → `HttpServer` in `src/server/index.ts`
- Module registration: `src/modules/index.ts` (auto-discovers `src/modules/*/routes.ts`)
- API docs: OpenAPI UI at `/help`
- Default port: `3131`

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime / package manager | Bun |
| HTTP framework | Elysia (latest) |
| Validation | Elysia `t` schemas (`src/models/schemas/`) |
| Database | PostgreSQL via Prisma 7 (`prisma.config.ts`) |
| Auth | JWT (`jose`) + `@elysiajs/bearer` |
| Observability | Optional OpenTelemetry + request tracing middleware |
| Container | Docker (`Dockerfile`, `docker-compose.yaml`) |

Follow [Elysia best practices](https://elysiajs.com/essential/best-practice.html) when adding or refactoring features.

## Commands

```bash
# Install
bun install

# Dev server (hot reload)
bun run dev

# Run directly
bun run start

# Compile binary (Windows)
bun run build

# Compile binary (Linux x64, for Docker)
bun run build:docker

# Prisma
bunx prisma generate
bunx --bun prisma migrate dev --name <name>
bunx prisma db pull

# Docker
docker compose build
docker compose up -d
```

Copy `.env.example` to `.env` before running. Required env vars are validated in `src/config/env.ts`.

## Architecture

Feature-based layout. Each feature lives under `src/modules/<feature>/`.

```
src/
├── index.ts              # Process entry, graceful shutdown
├── server/index.ts       # HttpServer wrapper around Elysia
├── config/               # Env loading + app config
├── modules/              # Feature modules (auto-loaded)
│   ├── index.ts          # Global plugins + route discovery
│   ├── health/
│   │   ├── routes.ts     # Elysia controller
│   │   └── service.ts    # Business logic
│   ├── signin/
│   └── protected/
├── middleware/           # Global / reusable Elysia plugins
├── models/
│   ├── schemas/          # Request/response validation (Elysia t.*)
│   └── errors/           # AppError + HTTP error helpers
├── infra/                # External integrations (auth, prisma, etc.)
├── common/               # Shared utilities (logger)
└── constants/            # Shared constants
```

### Request flow

1. `HttpServer` creates a root Elysia app and calls `registerModules`.
2. `registerModules` applies global middleware: OpenAPI, CORS, optional telemetry, response envelope.
3. Every `src/modules/*/routes.ts` export that is an `Elysia` instance is mounted automatically.
4. `responseMiddleware` wraps handler return values in a standard envelope unless the value is already an envelope or a raw `Response`.

### Layer responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Controller | `modules/<feature>/routes.ts` | HTTP routing, validation hooks, thin handlers |
| Service | `modules/<feature>/service.ts` or `infra/` | Business logic, decoupled from Elysia `Context` |
| Model | `models/schemas/` | Single source of truth for types + runtime validation |
| Middleware | `middleware/` | Cross-cutting Elysia plugins (auth, response, telemetry) |

## Coding conventions

### Controllers (`routes.ts`)

- One Elysia instance per module; treat it as the controller.
- Export as `default` or a named export — both work with the module loader.
- Set `name`, `prefix`, and OpenAPI `tags`.
- Keep handlers thin: destructure context, call a service, return data.
- Do **not** pass the full Elysia `Context` into services.

```typescript
// src/modules/users/routes.ts
import Elysia from "elysia";
import { userSchema } from "../../models/schemas/user";
import { UserService } from "./service";

export default new Elysia({ name: "users", prefix: "/users", tags: ["Users"] })
  .get("/:id", ({ params: { id } }) => UserService.findById(id));
```

### Services

- Use `abstract class` with `static` methods when no instance state is needed.
- Keep services free of HTTP/Elysia imports when possible.
- Throw HTTP errors with Elysia `status()` helpers from `src/models/errors/http-error.ts`.
- Use `AppError` for startup/config failures (see `src/config/env.ts`).

```typescript
import { status } from "elysia";

export abstract class UserService {
  static async findById(id: string) {
    const user = await lookupUser(id);
    if (!user) throw status(404, "User not found");
    return user;
  }
}
```

### Schemas

- Define validation in `src/models/schemas/` using Elysia `t.*`.
- Derive TypeScript types with `Static<typeof schema>` or `typeof schema.static`.
- Wire schemas into routes via `body`, `response`, `query`, etc.
- Do not duplicate interfaces separately from validation schemas.

### Middleware

- Implement as named Elysia plugins: `new Elysia({ name: "..." })`.
- Use `.as("scoped")` for request-scoped plugins (see `responseMiddleware`, `authMiddleware`).
- Give plugins a stable `name` so Elysia can deduplicate them.

### Auth

- Public routes: no auth middleware.
- Protected routes: `.use(authMiddleware)` then read `{ user }` from context.
- Token validation lives in `src/infra/auth/service.ts`.

### Responses

Handlers should return plain data. The global `responseMiddleware` adds:

```json
{
  "success": true,
  "data": { "...": "..." },
  "timestamp": "ISO-8601",
  "path": "/route"
}
```

Return a raw `Response` only when bypassing the envelope is intentional.

### Environment variables

Add new variables in `src/config/env.ts`:

1. Extend `envSchema` with Elysia `t.*` types and defaults.
2. Map parsed values into the returned config object.
3. Update `.env.example`.

### Logging

Use `logger` from `src/common/logger.ts`. Do not add ad-hoc `console.log` in production paths.

## Adding a new module

1. Create `src/modules/<feature>/routes.ts` exporting an `Elysia` instance.
2. Add `service.ts` for business logic when handlers grow beyond trivial logic.
3. Add schemas under `src/models/schemas/<feature>.ts`.
4. Restart dev server — new `routes.ts` files are picked up automatically in development.

Reference implementations:

- Simple module: `src/modules/health/`
- Auth + service: `src/modules/signin/`
- Protected routes: `src/modules/protected/`

## Prisma

- Config: `prisma.config.ts`
- Schema / migrations / client: `src/infra/prisma/` (gitignored until initialized)
- Initialize fresh: `bunx --bun prisma init --db --output ./src/infra/prisma`
- Set `DATABASE_URL` in `.env` before migrations or `db pull`

## Memory and lifecycle

- Avoid long-lived references to request-scoped data on module-level singletons.
- Close watchers, timers, and server handles on shutdown (see `src/index.ts`).
- In dev, the module file watcher calls `watcher.unref()` and closes itself after detecting a new route file — follow this pattern for new background resources.
- Prefer stateless static services over accumulating instance caches unless eviction is explicit.

## Boundaries

Do **not**:

- Commit `.env` or secrets.
- Pass entire Elysia `Context` into service/controller classes.
- Add duplicate TypeScript interfaces alongside Elysia schemas.
- Modify unrelated files when fixing a scoped issue.
- Create commits or pull requests unless explicitly asked.
- Use `npm`/`pnpm`/`yarn` — this project uses **Bun**.

Do:

- Match existing import style (`import Elysia from "elysia"` vs named imports — follow the nearest module).
- Keep diffs minimal and focused.
- Add env vars through `src/config/env.ts`, not raw `process.env` reads scattered in code.

## Verification

After making changes:

1. Ensure TypeScript compiles: `bun run dev` (or `bun run src/index.ts`) starts without errors.
2. Hit affected endpoints (default base URL: `http://localhost:3131`).
3. Check OpenAPI at `/help` when adding or changing routes.
4. For Prisma changes: run `bunx prisma generate` and verify migrations apply.

There is no test suite yet (`bun test` is a placeholder). Manual endpoint checks and startup verification are the current quality gates.

## Current endpoints (reference)

| Method | Path | Module | Notes |
| --- | --- | --- | --- |
| GET | `/healthz` | health | Liveness check |
| POST | `/healthz/echo` | health | Echo body |
| POST | `/signin` | signin | Returns JWT |
| GET | `/protected` | protected | Requires Bearer token |
| GET | `/help` | — | OpenAPI UI |

## Useful references

- [Elysia best practices](https://elysiajs.com/essential/best-practice.html)
- Human-oriented setup docs: `README.md`
- Canonical patterns: `src/modules/signin/`, `src/middleware/response.ts`, `src/config/env.ts`
