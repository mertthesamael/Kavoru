import { opentelemetry } from "@elysiajs/opentelemetry";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import type { Elysia } from "elysia";
import { config } from "../../config";
import { BunOtlpTraceExporter } from "./bun-otlp-exporter";

export function withOpenTelemetry(app: Elysia) {
  const endpoint = config.env.server.otelExporterOtlpEndpoint;
  if (!endpoint) return app;

  const exporter = new BunOtlpTraceExporter(endpoint);
  const spanProcessor = new BatchSpanProcessor(exporter, {
    scheduledDelayMillis: config.env.env === "development" ? 500 : 5000,
  });

  return app.use(
    opentelemetry({
      serviceName: config.env.server.otelServiceName,
      spanProcessors: [spanProcessor],
    }),
  );
}
