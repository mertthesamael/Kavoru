import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { JsonTraceSerializer } from "@opentelemetry/otlp-transformer";
import { SpanStatusCode } from "@opentelemetry/api";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

const GENERIC_SPAN_NAMES = new Set([
  "Root",
  "anonymous",
  "Request",
  "Handle",
]);

function httpRouteLabel(span: ReadableSpan): string | undefined {
  const method = span.attributes["http.request.method"];
  const route = span.attributes["http.route"];
  const path = span.attributes["url.path"];

  if (typeof method !== "string") return undefined;
  if (typeof route === "string") return `${method} ${route}`;
  if (typeof path === "string") return `${method} ${path}`;
  return undefined;
}

function isOrphanSpan(span: ReadableSpan): boolean {
  return span.parentSpanContext === undefined;
}

function resolveTraceRouteLabels(
  spans: readonly ReadableSpan[],
): Map<string, string> {
  const byTrace = new Map<string, ReadableSpan[]>();

  for (const span of spans) {
    const traceId = span.spanContext().traceId;
    const group = byTrace.get(traceId);
    if (group) group.push(span);
    else byTrace.set(traceId, [span]);
  }

  const labels = new Map<string, string>();
  for (const [traceId, traceSpans] of byTrace) {
    const label = traceSpans.map(httpRouteLabel).find(Boolean);
    if (label) labels.set(traceId, label);
  }

  return labels;
}

function resolveDisplayName(
  span: ReadableSpan,
  traceRouteLabel?: string,
): string | undefined {
  const ownLabel = httpRouteLabel(span);
  const genericName = GENERIC_SPAN_NAMES.has(span.name);

  if (typeof span.attributes["url.path"] === "string") {
    if (span.name.endsWith("/*") || span.name === "Request") {
      return ownLabel ?? traceRouteLabel;
    }
    if (genericName) return ownLabel ?? traceRouteLabel;
  }

  if (
    isOrphanSpan(span) &&
    traceRouteLabel &&
    (genericName || span.name === "Handle")
  ) {
    return traceRouteLabel;
  }

  return undefined;
}

function withExportedShape(
  span: ReadableSpan,
  traceRouteLabel?: string,
): ReadableSpan {
  const status = span.attributes["http.response.status_code"];
  const displayName = resolveDisplayName(span, traceRouteLabel);
  const shouldMarkError = typeof status === "number" && status >= 400;

  if (!displayName && !shouldMarkError) return span;

  return new Proxy(span, {
    get(target, prop, receiver) {
      if (prop === "name" && displayName) return displayName;
      if (prop === "status" && shouldMarkError) {
        return {
          code: SpanStatusCode.ERROR,
          message: `HTTP ${status}`,
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export class BunOtlpTraceExporter implements SpanExporter {
  constructor(private readonly url: string) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ) {
    if (spans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    const traceRouteLabels = resolveTraceRouteLabels(spans);
    const payload = JsonTraceSerializer.serializeRequest(
      spans.map((span) =>
        withExportedShape(
          span,
          traceRouteLabels.get(span.spanContext().traceId),
        ),
      ),
    );
    if (!payload) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    void fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(payload),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(
            `[OTEL] export failed: ${response.status} ${response.statusText} → ${this.url}`,
          );
          resultCallback({
            code: ExportResultCode.FAILED,
            error: new Error(`OTLP export failed: ${response.status}`),
          });
          return;
        }

        resultCallback({ code: ExportResultCode.SUCCESS });
      })
      .catch((error: unknown) => {
        console.error(`[OTEL] export error → ${this.url}`, error);
        resultCallback({
          code: ExportResultCode.FAILED,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }

  shutdown() {
    return Promise.resolve();
  }
}

export const __testing = {
  httpRouteLabel,
  resolveDisplayName,
  resolveTraceRouteLabels,
  isOrphanSpan,
};
