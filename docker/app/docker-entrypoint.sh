#!/bin/sh
set -e

if [ -n "${DATABASE_URL:-}" ] && [ -f prisma.config.ts ]; then
  bunx --bun prisma db push
fi

exec "$@"
