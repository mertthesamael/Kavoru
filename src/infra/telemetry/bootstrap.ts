import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { config } from "../../config";
import { BunOtlpTraceExporter } from "./bun-otlp-exporter";

let sdk: NodeSDK | undefined;

export function bootstrapOpenTelemetry() {
  const endpoint = config.env.server.otelExporterOtlpEndpoint;
  if (!endpoint) return;

  sdk = new NodeSDK({
    serviceName: config.env.server.otelServiceName,
    spanProcessors: [
      new BatchSpanProcessor(new BunOtlpTraceExporter(endpoint), {
        scheduledDelayMillis: 500,
      }),
    ],
  });
  sdk.start();
}

export async function shutdownOpenTelemetry() {
  await sdk?.shutdown();
  sdk = undefined;
}
