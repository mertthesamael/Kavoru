import { NodeSDK } from "@opentelemetry/sdk-node";
import { config } from "../../config";
import { BunOtlpTraceExporter } from "./bun-otlp-exporter";
import { TraceBatchSpanProcessor } from "./trace-batch-processor";

let sdk: NodeSDK | undefined;

export function bootstrapOpenTelemetry() {
  const endpoint = config.env.server.otelExporterOtlpEndpoint;
  if (!endpoint) return;

  const exporter = new BunOtlpTraceExporter(endpoint);

  sdk = new NodeSDK({
    serviceName: config.env.server.otelServiceName,
    spanProcessors: [new TraceBatchSpanProcessor(exporter)],
  });
  sdk.start();
}

export async function shutdownOpenTelemetry() {
  await sdk?.shutdown();
  sdk = undefined;
}
