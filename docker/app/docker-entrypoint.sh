#!/bin/sh
set -e

if [ -f /app/bin/kavoru.js ] && [ -f /app/scripts/link-cli.ts ]; then
  bun /app/scripts/link-cli.ts
fi

export PATH="/root/.bun/bin:${PATH}"

if [ -n "${DATABASE_URL:-}" ] && [ -f prisma.config.ts ]; then
  bunx --bun prisma db push
fi

exec "$@"
