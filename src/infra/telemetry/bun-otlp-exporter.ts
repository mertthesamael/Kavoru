import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { JsonTraceSerializer } from "@opentelemetry/otlp-transformer";
import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
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

function isServerRoot(span: ReadableSpan): boolean {
  return (
    !span.parentSpanContext &&
    (span.kind === SpanKind.SERVER || span.name === "Root")
  );
}

function resolveTraceRouteLabels(
  spans: readonly ReadableSpan[],
  cached: ReadonlyMap<string, string>,
): Map<string, string> {
  const labels = new Map<string, string>(cached);

  for (const span of spans) {
    const traceId = span.spanContext().traceId;
    if (labels.has(traceId)) continue;
    const label = httpRouteLabel(span);
    if (label) labels.set(traceId, label);
  }

  return labels;
}

function pickTraceRouteLabel(
  spans: readonly ReadableSpan[],
  traceId: string,
  cached?: string,
): string | undefined {
  if (cached) return cached;

  const serverRoot = spans.find(
    (span) =>
      span.spanContext().traceId === traceId &&
      isServerRoot(span) &&
      httpRouteLabel(span),
  );
  if (serverRoot) return httpRouteLabel(serverRoot);

  for (const span of spans) {
    if (span.spanContext().traceId !== traceId) continue;
    const label = httpRouteLabel(span);
    if (label) return label;
  }

  return undefined;
}

function resolveDisplayName(
  span: ReadableSpan,
  traceRouteLabel?: string,
): string | undefined {
  const ownLabel = httpRouteLabel(span);
  const genericName = GENERIC_SPAN_NAMES.has(span.name);

  if (ownLabel && (genericName || span.name.endsWith("/*"))) {
    return ownLabel;
  }

  if (!traceRouteLabel) return undefined;

  if (span.name.endsWith("/*") || span.name === "Request") {
    return traceRouteLabel;
  }

  if (isOrphanSpan(span) && genericName) {
    return traceRouteLabel;
  }

  if (isServerRoot(span) && (genericName || span.name === "Root")) {
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
  private readonly routeByTraceId = new Map<string, string>();

  constructor(private readonly url: string) {}

  rememberRoute(traceId: string, label: string) {
    this.routeByTraceId.set(traceId, label);
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ) {
    if (spans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    for (const span of spans) {
      const traceId = span.spanContext().traceId;
      const label = httpRouteLabel(span);
      if (label) this.routeByTraceId.set(traceId, label);
    }

    const traceRouteLabels = resolveTraceRouteLabels(
      spans,
      this.routeByTraceId,
    );

    const payload = JsonTraceSerializer.serializeRequest(
      spans.map((span) => {
        const traceId = span.spanContext().traceId;
        const label = pickTraceRouteLabel(
          spans,
          traceId,
          traceRouteLabels.get(traceId),
        );
        return withExportedShape(span, label);
      }),
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
    this.routeByTraceId.clear();
    return Promise.resolve();
  }
}

export const __testing = {
  httpRouteLabel,
  resolveDisplayName,
  resolveTraceRouteLabels,
  pickTraceRouteLabel,
  isOrphanSpan,
  isServerRoot,
};
