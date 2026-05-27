# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project overview

Production-ready **ElysiaJS** backend template using **Bun**, **TypeScript**, **Prisma**, and **Docker**.

- Entry point: `src/index.ts` → `HttpServer` in `src/server/index.ts`
- Module registration: `src/modules/index.ts` (auto-discovers `src/modules/*/routes.ts`)
- Scheduled jobs: `src/schedules/index.ts` (`@elysiajs/cron`, mounted in `HttpServer`)
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
| Observability | OpenTelemetry via `@elysiajs/opentelemetry` (`src/infra/telemetry/`) |
| Scheduled tasks | `@elysiajs/cron` (`src/schedules/`) |
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

# OpenTelemetry (local trace viewer, no Docker required)
bun run otel:view   # Web UI at http://localhost:4318
bun run otel:tui    # Terminal UI

# Tests
bun test
```

Copy `.env.example` to `.env` before running. Required env vars are validated in `src/config/env.ts`.

In development, OTEL is enabled by default (`http://localhost:4318/v1/traces`) unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set to empty.

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
├── infra/                # External integrations (auth, prisma, telemetry, etc.)
│   └── telemetry/        # OpenTelemetry wiring + Bun OTLP exporter
├── schedules/            # Cron jobs (@elysiajs/cron)
│   └── index.ts          # All scheduled tasks (export `schedules`)
├── common/               # Shared utilities (logger)
├── constants/            # Shared constants (e.g. JWT)
└── __tests__/            # Bun test files (*.test.ts)
```

### Request flow

1. `HttpServer` creates a root Elysia app and calls `registerModules`.
2. `registerModules` applies global plugins in order: **OpenTelemetry first**, then OpenAPI, CORS, response envelope.
3. Every `src/modules/*/routes.ts` export that is an `Elysia` instance is mounted automatically.
4. A catch-all `app.all("/*")` at the end returns **404** for unknown paths (also enables full OTEL traces for not-found requests).
5. `responseMiddleware` wraps handler return values in a standard envelope unless the value is already an envelope or a raw `Response`.

Register new global plugins **after** `withOpenTelemetry` so they are included in trace spans (root span name, route attributes, lifecycle children). Do not register routes before OTEL — unmatched routes used to produce broken traces.

### Layer responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Controller | `modules/<feature>/routes.ts` | HTTP routing, validation hooks, thin handlers |
| Service | `modules/<feature>/service.ts` or `infra/` | Business logic, decoupled from Elysia `Context` |
| Model | `models/schemas/` | Single source of truth for types + runtime validation |
| Middleware | `middleware/` | Cross-cutting Elysia plugins (auth, response) |
| Telemetry | `infra/telemetry/` | OpenTelemetry SDK + Bun-compatible OTLP export |
| Schedules | `schedules/` | Background cron jobs (not HTTP routes) |

`HttpServer` mounts plugins as: `registerModules` → `schedules` (see `src/server/index.ts`). Cron runs for the lifetime of the process while the server is listening.

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
- Wire schemas into routes via `body`, `query`, `params`, etc.
- Do **not** use route-level `response` schemas on handlers that return plain data — `responseMiddleware` wraps output in the global envelope and Elysia will validate against the wrong shape. Use `responseSchema` in OpenAPI/docs only if needed.
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

Handlers should return plain data. The global `responseMiddleware` wraps responses based on HTTP status:

**Success (status below 400):**

```json
{
  "status": 200,
  "success": true,
  "data": { "...": "..." },
  "timestamp": "ISO-8601",
  "path": "/route"
}
```

**Error (status 400 and above):**

```json
{
  "status": 404,
  "success": false,
  "error": {
    "code": "404",
    "message": "Not Found"
  },
  "timestamp": "ISO-8601",
  "path": "/unknown"
}
```

- `success` always reflects the HTTP status (`true` when status is below 400).
- Prefer throwing `status()` from `src/models/errors/http-error.ts` in services; the envelope is applied by middleware.
- Return a raw `Response` only when bypassing the envelope is intentional.

### Environment variables

Add new variables in `src/config/env.ts`:

1. Extend `envSchema` with Elysia `t.*` types and defaults.
2. Map parsed values into the returned config object.
3. Update `.env.example`.

Use `format: "uri"` (not `"url"`) for endpoint-style values that include paths (e.g. OTLP URLs).

| Variable | Default (dev) | Description |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP/HTTP traces endpoint; set empty to disable |
| `OTEL_SERVICE_NAME` | `elysia-template` | Service name in trace UI |

### OpenTelemetry

- Wired in `src/infra/telemetry/index.ts` via `@elysiajs/opentelemetry`.
- Uses `BunOtlpTraceExporter` (`src/infra/telemetry/bun-otlp-exporter.ts`) because the default Node OTLP HTTP exporter can hang under Bun.
- At export time, `BunOtlpTraceExporter` normalizes spans for otel-dev:
  - Renames `GET /*` / orphan `Request` spans to `GET /actual-path` using `url.path`.
  - Marks span status **ERROR** when `http.response.status_code >= 400` (the Elysia OTEL plugin only marks 5xx as errors).
- Spans are created automatically per request (Root, Request, Parse, Handle, etc.) by the Elysia OTEL plugin — do **not** add custom request-logging middleware.
- Unknown paths: catch-all in `src/modules/index.ts` ensures 404s get a full span tree; exporter fixes display name and error status.
- Local viewing: `bun run otel:view` (terminal 1) + `bun run dev` (terminal 2). Traces appear under `OTEL_SERVICE_NAME` within ~1s in dev.
- otel-dev shows the **service name** (`elysia-template`) on every trace — that is normal. Span title uses the route (e.g. `GET /healthz/`).
- Visiting `/help` also traces `GET /help/json` (OpenAPI spec fetch). URL hash fragments (e.g. `#tag/authentication`) are client-only and never appear in spans.
- Docker alternative: Jaeger in `docker-compose.yaml` (UI at http://localhost:16686). Use `http://jaeger:4318/v1/traces` when the app runs inside compose.

Do **not** use `@opentelemetry/exporter-trace-otlp-http` directly — use `BunOtlpTraceExporter`. Do **not** add lifecycle plugins to patch span names/status; fix export shaping in `bun-otlp-exporter.ts` instead.

### Logging

Use `logger` from `src/common/logger.ts`. Do not add ad-hoc `console.log` in production paths.

### Scheduled tasks (cron)

All cron jobs live in `src/schedules/index.ts` and are registered on the root app via `.use(schedules)` in `src/server/index.ts`.

Use `@elysiajs/cron` — each job is a separate `.use(cron({ ... }))` on the exported `schedules` Elysia instance:

```typescript
import Elysia from "elysia";
import { cron, Patterns } from "@elysiajs/cron";
import { logger } from "../common/logger";
import { SomeService } from "../modules/foo/service";

export const schedules = new Elysia()
  .use(
    cron({
      name: "My Job",
      pattern: Patterns.everyDayAt("03:00"),
      timezone: "Europe/Istanbul",
      run: () => {
        void SomeService.runDailyTask();
      },
    }),
  );
```

**Built-in examples (template):**

| Name | Pattern | Timezone | Notes |
| --- | --- | --- | --- |
| Daily Schedule | `Patterns.everyDayAt("00:00")` | `Europe/Istanbul` | Once per day at midnight |
| Spesific Day Schedule | `Patterns.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT` | `UTC` | First day of month |
| Cron Example | `*/10 * * * * *` | (server default) | Every 10 seconds — dev heartbeat only |

**Conventions:**

- Keep `run` thin: call a **service** static method; do not put business logic inline in `schedules/index.ts`.
- Use `Patterns.*` helpers when possible; use a cron string for custom schedules (6-field with seconds: `second minute hour day month weekday`).
- Set `timezone` explicitly for calendar-based jobs (daily/monthly).
- Give each job a unique `name` (used by the cron plugin for identification).
- Use `logger` for job start/finish or errors; avoid `console.log`.
- Cron jobs are **not** HTTP requests — they do not appear in route traces unless you instrument them manually.
- Avoid sub-second or very frequent crons in production unless required (the template heartbeat runs every 10s for demonstration).

Do **not** add cron definitions inside feature `routes.ts` files — keep them centralized in `src/schedules/`.

## Testing

Tests use **Bun's built-in test runner** (`bun:test`). Files live in `__tests__/` with the `*.test.ts` suffix.

```bash
bun test
```

### Conventions

- Test HTTP behavior with `app.handle(new Request(...))` — no need to start a listening server.
- Build the app with `registerModules(new Elysia())` for route + middleware integration tests.
- Assert the **API envelope** using `createResponse` from `src/middleware/response.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { registerModules } from "../src/modules";
import { createResponse } from "../src/middleware/response";

describe("My Feature", () => {
  it("returns success envelope", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(new Request("http://localhost/my-route"))
      .then((res) => res.json());

    expect(response).toEqual(createResponse({ id: 1 }, "/my-route", 200));
  });
});
```

- Always pass **`statusCode`** as the third argument to `createResponse` (required).
- For **POST/PUT/PATCH** with JSON bodies, set `Content-Type: application/json` on the `Request`.
- Prefer testing services in isolation (static methods) when logic does not need HTTP/Elysia context.
- Add tests when changing routes, response envelope behavior, or auth flows.

### Current coverage (`__tests__/controller.test.ts`)

| Test | What it verifies |
| --- | --- |
| GET `/healthz` | 200 success envelope |
| GET unknown path | 404 error envelope (`success: false`) |
| POST `/healthz/echo` | JSON body parsing + success envelope with `data` |

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
- Cron timers are tied to the server process — they stop when `HttpServer.stop()` runs (see graceful shutdown in `src/index.ts`).

## Boundaries

Do **not**:

- Commit `.env` or secrets.
- Pass entire Elysia `Context` into service/controller classes.
- Add duplicate TypeScript interfaces alongside Elysia schemas.
- Modify unrelated files when fixing a scoped issue.
- Create commits or pull requests unless explicitly asked.
- Use `npm`/`pnpm`/`yarn` — this project uses **Bun**.
- Add custom telemetry/logging middleware for tracing — use OTEL spans instead.

Do:

- Match existing import style (`import Elysia from "elysia"` vs named imports — follow the nearest module).
- Keep diffs minimal and focused.
- Add env vars through `src/config/env.ts`, not raw `process.env` reads scattered in code.

## Verification

After making changes:

1. Run tests: `bun test`.
2. Ensure TypeScript compiles: `bun run dev` (or `bun run src/index.ts`) starts without errors.
3. Hit affected endpoints (default base URL: `http://localhost:3131`).
4. Check OpenAPI at `/help` when adding or changing routes.
5. For telemetry changes: run `bun run otel:view`, hit a route, confirm trace name/status in the UI (4xx should show **ERROR**, not OK).
6. For error responses: confirm `success: false` and an `error` object when status is 400 or above.
7. For Prisma changes: run `bunx prisma generate` and verify migrations apply.

## Current endpoints (reference)

| Method | Path | Module | Notes |
| --- | --- | --- | --- |
| GET | `/healthz` | health | Liveness check |
| POST | `/healthz/echo` | health | Echo body |
| POST | `/signin` | signin | Returns JWT |
| GET | `/protected` | protected | Requires Bearer token |
| GET | `/help` | — | OpenAPI UI (also traces `GET /help/json`) |
| * | `/*` (unmatched) | — | Returns 404 JSON envelope |

## Useful references

- [Elysia best practices](https://elysiajs.com/essential/best-practice.html)
- Human-oriented setup docs: `README.md`
- Canonical patterns: `src/modules/signin/`, `src/middleware/response.ts`, `src/config/env.ts`, `src/infra/telemetry/`, `src/schedules/index.ts`, `__tests__/controller.test.ts`
- Cron plugin: [@elysiajs/cron](https://elysiajs.com/plugins/cron.html)
