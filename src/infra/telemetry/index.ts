import { opentelemetry } from "@elysiajs/opentelemetry";
import type { Elysia } from "elysia";
import { config } from "../../config";

export { bootstrapOpenTelemetry, shutdownOpenTelemetry } from "./bootstrap";

export function withOpenTelemetry(app: Elysia) {
  const endpoint = config.env.server.otelExporterOtlpEndpoint;
  if (!endpoint) {
    console.warn("[OTEL] tracing disabled — OTEL_EXPORTER_OTLP_ENDPOINT is unset");
    return app;
  }

  return app.use(
    opentelemetry({
      serviceName: config.env.server.otelServiceName,
    }),
  );
}
