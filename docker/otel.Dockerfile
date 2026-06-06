FROM oven/bun:1
WORKDIR /otel

RUN bun init -y && bun add otel-dev

EXPOSE 4318
CMD ["bunx", "otel-dev", "--web", "--port", "4318"]
