FROM oven/bun:1.3.14 AS build
WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
COPY bin ./bin
COPY scripts/link-cli.ts ./scripts/link-cli.ts
RUN bun install

COPY ./src ./src
COPY ./scripts ./scripts
COPY prisma.config.ts ./

ARG PORT
ARG TARGETARCH
ENV PORT=${PORT}
ENV PATH="/root/.bun/bin:${PATH}"
EXPOSE ${PORT}

RUN bunx prisma generate

RUN bun run routes:registry \
  && DOCKER_ARCH="${TARGETARCH:-$(uname -m)}" \
  && case "$DOCKER_ARCH" in \
    amd64|x86_64) BUN_COMPILE_TARGET="bun-linux-x64" ;; \
    arm64|aarch64) BUN_COMPILE_TARGET="bun-linux-arm64" ;; \
    *) echo "Unsupported Docker architecture: $DOCKER_ARCH" >&2; exit 1 ;; \
  esac \
  && bun build --compile --env=disable --minify-whitespace --minify-syntax --target="$BUN_COMPILE_TARGET" --outfile server ./src/index.ts

COPY docker/app/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
CMD ["./server"]
