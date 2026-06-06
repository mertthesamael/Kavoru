# Kavoru

Production-ready backend starter built with [ElysiaJS](https://elysiajs.com), [Bun](https://bun.sh), TypeScript, and PostgreSQL (Prisma). Includes JWT auth, OpenAPI docs, OpenTelemetry, Sentry, Kafka, WebSockets, Resend email, cron jobs, and Docker.

Official repo (GitHub template): [github.com/mertthesamael/Kavoru](https://github.com/mertthesamael/Kavoru)

Default port: **3131**

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Bun |
| HTTP framework | Elysia |
| Validation | Elysia `t` schemas |
| Database | PostgreSQL + Prisma 7 |
| Auth | JWT (`jose`) + `@elysiajs/bearer` |
| Observability | OpenTelemetry + Sentry |
| Messaging | Kafka (`kafkajs`) |
| Email | Resend (`resend`) |
| Real-time | WebSocket (Bun / uWebSockets) |
| Scheduled tasks | `@elysiajs/cron` |
| Container | Docker + Docker Compose |

## Quick start

### Prerequisites

- [Bun](https://bun.sh) 1.1+
- PostgreSQL (optional until you use Prisma migrations)
- Docker (optional — Kafka, Jaeger, containerized app)

### Install and run

**Recommended** — scaffold with the CLI (after the [`kavoru`](https://www.npmjs.com/package/kavoru) package is published):

```bash
bunx kavoru my-api
cd my-api
bun run dev
```

Pick only what you need — interactive toggles in the terminal, or flags:

```bash
# Core skeleton (health + OpenAPI + response envelope)
bunx kavoru my-api --minimal

# Specific integrations
bunx kavoru my-api --features auth,prisma,otel,sentry

# Full stack minus Kafka and Docker
bunx kavoru my-api --no-features kafka,docker
```

Or use **[Use this template](https://github.com/mertthesamael/Kavoru/generate)** on GitHub, or clone directly:

```bash
git clone https://github.com/mertthesamael/Kavoru.git
cd Kavoru

bun install
cp .env.example .env
bun run dev
```

The API starts at `http://localhost:3131`. OpenAPI UI: [http://localhost:3131/help](http://localhost:3131/help)

### Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Dev server with hot reload |
| `bun run start` | Prisma pull/generate + run |
| `bun test` | Run tests |
| `bun run build` | Compile standalone binary (Windows) |
| `bun run build:docker` | Compile Linux x64 binary for Docker |
| `bun run otel:view` | Local trace viewer (web UI) |
| `bun run otel:tui` | Local trace viewer (terminal) |
| `bun run sentry:spotlight` | Local Sentry UI |

## Environment variables

Copy `.env.example` to `.env`. All variables are validated in `src/config/env.ts`.

| Variable | Default (dev) | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3131` | HTTP port |
| `DATABASE_URL` | _(unset)_ | PostgreSQL connection string |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP traces; set empty to disable |
| `OTEL_SERVICE_NAME` | `kavoru` | Service name in trace UI |
| `SENTRY_SPOTLIGHT` | `true` in dev | Local Sentry UI; `false` to disable |
| `SENTRY_DSN` | _(unset)_ | Optional sentry.io DSN |
| `SENTRY_TRACES_SAMPLE_RATE` | `1.0` dev / `0.1` prod | Transaction sample rate |
| `KAFKA_ENABLED` | enabled in dev | Set `false` to disable |
| `KAFKA_BROKERS` | `localhost:9094` in dev | Comma-separated broker list |
| `KAFKA_CLIENT_ID` | `kavoru` | Kafka client ID |
| `KAFKA_GROUP_ID` | `kavoru-consumer` | Consumer group ID |
| `KAFKA_TOPIC` | `elysia.events` | Default topic |
| `RESEND_API_KEY` | _(unset)_ | Resend API key |
| `RESEND_FROM` | _(unset)_ | Default sender, e.g. `Acme <onboarding@resend.dev>` |
| `RESEND_ENABLED` | enabled when key set | Set `false` to disable |

## Project structure

```
src/
├── index.ts              # Entry point, graceful shutdown
├── server/index.ts       # HttpServer wrapper
├── config/               # Env loading
├── modules/              # Feature modules (auto-discovered)
│   ├── health/
│   ├── signin/
│   ├── protected/
│   ├── kafka/
│   └── realtime/
├── middleware/           # Auth, response envelope
├── models/schemas/       # Elysia validation schemas
├── infra/                # External integrations
│   ├── auth/
│   ├── kafka/
│   ├── resend/
│   ├── telemetry/
│   └── sentry/
├── schedules/            # Cron jobs
└── __tests__/            # Bun tests
```

New modules are picked up automatically: add `src/modules/<feature>/routes.ts` exporting an `Elysia` instance and restart (or save in dev — file watcher triggers reload).

## Response envelope

All HTTP handlers return a standard JSON envelope (unless they return a raw `Response`):

**Success (status &lt; 400):**

```json
{
  "status": 200,
  "success": true,
  "data": { "...": "..." },
  "timestamp": "2026-06-01T12:00:00.000Z",
  "path": "/healthz"
}
```

**Error (status ≥ 400):**

```json
{
  "status": 404,
  "success": false,
  "error": {
    "code": "404",
    "message": "Not Found"
  },
  "timestamp": "2026-06-01T12:00:00.000Z",
  "path": "/unknown"
}
```

---

## API reference

### Health

```bash
# Liveness check
curl http://localhost:3131/healthz

# Echo JSON body
curl -X POST http://localhost:3131/healthz/echo \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'
```

### Authentication

Sign in returns a JWT. Protected routes require `Authorization: Bearer <token>`.

```bash
# Sign in
curl -X POST http://localhost:3131/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'

# Response data.token — use as Bearer token
TOKEN="<paste-token-here>"

# Protected route
curl http://localhost:3131/protected \
  -H "Authorization: Bearer $TOKEN"
```

The template uses placeholder credential validation (`signin/service.ts`). Replace with real DB lookup and password hashing before production.

### Kafka

Kafka is enabled by default in development when brokers are reachable. Start the broker with Docker:

```bash
docker compose up -d kafka
```

```bash
# Status (enabled flag + last consumed message)
curl http://localhost:3131/kafka/status

# Publish a message
curl -X POST http://localhost:3131/kafka/publish \
  -H "Content-Type: application/json" \
  -d '{"value":"hello from api","key":"optional-key"}'
```

Inside Docker Compose, the app uses `KAFKA_BROKERS=kafka:9092`. On the host, use `localhost:9094` (external listener).

### WebSocket

```bash
# Active connection count
curl http://localhost:3131/realtime/stats
```

Connect with a WebSocket client (browser devtools, [Bun WebSocket](https://bun.sh/docs/api/websockets), etc.):

```
ws://localhost:3131/realtime/ws?room=lobby
```

Send a validated JSON frame:

```json
{"message":"ping"}
```

The server echoes it back to the sender. Clients are tracked per room and cleaned up on disconnect.

### OpenAPI

Interactive API docs: [http://localhost:3131/help](http://localhost:3131/help)

---

## Email (Resend)

Resend is **infra-only** — no HTTP routes. Call it from your feature services:

```typescript
import { isResendEnabled, sendEmail } from "../infra/resend";

if (isResendEnabled()) {
  const { id } = await sendEmail({
    to: user.email,
    subject: "Welcome",
    html: "<p>Welcome aboard!</p>",
  });
}
```

Setup:

1. Create an API key at [resend.com/api-keys](https://resend.com/api-keys)
2. Add to `.env`:

```env
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM=Acme <onboarding@resend.dev>
```

Disabled when `RESEND_API_KEY` is unset or in `NODE_ENV=test`. Verify your domain in the [Resend dashboard](https://resend.com/domains) for production senders.

---

## Observability

### OpenTelemetry

Enabled by default in development. Traces export to OTLP/HTTP.

**Local (no Docker):**

```bash
# Terminal 1
bun run otel:view

# Terminal 2
bun run dev
```

Open [http://localhost:4318](http://localhost:4318), hit any route, and traces appear under `kavoru`.

**Docker (Jaeger):**

```bash
docker compose up -d jaeger
```

Jaeger UI: [http://localhost:16686](http://localhost:16686). Inside compose, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces`.

Disable locally: `OTEL_EXPORTER_OTLP_ENDPOINT=`

### Sentry

**Local (Spotlight — no account required):**

```bash
# Terminal 1
bun run sentry:spotlight

# Terminal 2
bun run dev
```

Open [http://localhost:8969](http://localhost:8969). Trigger a 5xx to see events, e.g. `GET /healthz/error`.

**Cloud:** set `SENTRY_DSN` to also send to sentry.io. Disable Spotlight: `SENTRY_SPOTLIGHT=false`.

---

## Scheduled tasks (cron)

Example jobs live in `src/schedules/index.ts` (daily, monthly, and a 10-second heartbeat). To enable them, uncomment in `src/server/index.ts`:

```typescript
import { schedules } from "../schedules";

// in constructor:
.use(schedules)
```

Jobs use `@elysiajs/cron` with Istanbul/UTC timezones. Keep `run` callbacks thin — delegate to service static methods.

---

## Database (Prisma)

Prisma 7 is configured via `prisma.config.ts`. Schema output: `src/infra/prisma/`.

**Initialize fresh:**

```bash
bunx --bun prisma init --db --output ./src/infra/prisma
```

Set `DATABASE_URL` in `.env`, then:

```bash
bunx --bun prisma migrate dev --name init
bunx prisma generate
bun run seed   # if seed script exists
```

---

## Docker

```bash
docker compose build
docker compose up -d
```

Compose includes:

| Service | Purpose | Ports |
| --- | --- | --- |
| `app` | Compiled Bun binary | `${PORT}` (default 3131) |
| `kafka` | Bitnami Kafka (KRaft) | `9094` (host) |
| `jaeger` | Trace collector + UI | `16686`, `4318` |

Health check hits `GET /healthz`. App waits for Kafka on startup.

**Build standalone binary locally:**

```bash
bun run build          # Windows
bun run build:docker   # Linux x64 (for Docker)
./server               # or bun run start:prod
```

---

## Testing

```bash
bun test
```

Tests use `app.handle(new Request(...))` — no listening server required. Assert the response envelope with `createResponse` from `src/middleware/response.ts`.

Example:

```typescript
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { registerModules } from "../src/modules";
import { createResponse } from "../src/middleware/response";

describe("Health", () => {
  it("returns ok", async () => {
    const app = registerModules(new Elysia());
    const response = await app
      .handle(new Request("http://localhost/healthz"))
      .then((res) => res.json());

    expect(response).toEqual(createResponse("ok", "/healthz", 200));
  });
});
```

---

## Adding a feature module

1. Create `src/modules/<feature>/routes.ts`:

```typescript
import Elysia from "elysia";
import { UserService } from "./service";

export default new Elysia({ name: "users", prefix: "/users", tags: ["Users"] })
  .get("/:id", ({ params: { id } }) => UserService.findById(id));
```

2. Add `service.ts` for business logic and schemas under `src/models/schemas/`.
3. Restart dev server — routes are auto-loaded.

Reference modules: `health/` (simple), `signin/` (auth + service), `protected/` (Bearer middleware), `kafka/`, `realtime/` (WebSocket).

---

## Graceful shutdown

`SIGINT` / `SIGTERM` triggers:

1. HTTP server stop
2. Kafka consumer/producer disconnect
3. Sentry flush

See `src/index.ts`.

---

## License

MIT — see [LICENSE](LICENSE).

## Links

- [Elysia best practices](https://elysiajs.com/essential/best-practice.html)
- [Elysia WebSocket](https://elysiajs.com/patterns/websocket.html)
- [Agent / contributor guide](AGENTS.md)
