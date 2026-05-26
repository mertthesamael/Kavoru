import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { JsonTraceSerializer } from "@opentelemetry/otlp-transformer";
import { SpanStatusCode } from "@opentelemetry/api";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

function withExportedShape(span: ReadableSpan): ReadableSpan {
  const path = span.attributes["url.path"];
  const method = span.attributes["http.request.method"];
  const status = span.attributes["http.response.status_code"];
  const shouldRename =
    typeof path === "string" &&
    (span.name.endsWith("/*") || span.name === "Request");
  const shouldMarkError = typeof status === "number" && status >= 400;

  if (!shouldRename && !shouldMarkError) return span;

  const displayName =
    shouldRename && typeof path === "string"
      ? typeof method === "string"
        ? `${method} ${path}`
        : path
      : span.name;

  return new Proxy(span, {
    get(target, prop, receiver) {
      if (prop === "name" && shouldRename) return displayName;
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

    const payload = JsonTraceSerializer.serializeRequest(
      spans.map(withExportedShape),
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
          resultCallback({
            code: ExportResultCode.FAILED,
            error: new Error(`OTLP export failed: ${response.status}`),
          });
          return;
        }

        resultCallback({ code: ExportResultCode.SUCCESS });
      })
      .catch((error: unknown) => {
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
