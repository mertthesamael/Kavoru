    FROM oven/bun AS build
    WORKDIR /app

    RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
    COPY package.json bun.lock ./
    RUN bun install

    COPY ./src ./src
    COPY prisma.config.ts ./

    ARG PORT
    ENV PORT=${PORT}
    EXPOSE ${PORT}

    # generate only needs the schema on disk, not a live database
    RUN if [ -f src/infra/prisma/schemas/schema.prisma ]; then bunx prisma generate; fi
    
    RUN bun run build:docker
    CMD ["./server"]

