FROM oven/bun AS build
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
ENV PORT=${PORT}
ENV PATH="/root/.bun/bin:${PATH}"
EXPOSE ${PORT}

RUN bunx prisma generate

RUN bun run build:docker

COPY docker/app/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
CMD ["./server"]
