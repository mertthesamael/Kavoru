import { describe, expect, it } from "bun:test";
import { SpanKind } from "@opentelemetry/api";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { __testing } from "../src/infra/telemetry/bun-otlp-exporter";

function mockSpan(partial: Partial<ReadableSpan> & Pick<ReadableSpan, "name">) {
  return {
    kind: 1,
    startTime: [0, 0],
    endTime: [0, 1],
    status: { code: 0 },
    ended: true,
    resource: {} as ReadableSpan["resource"],
    instrumentationScope: {} as ReadableSpan["instrumentationScope"],
    spanContext: () => ({
      traceId: "trace-1",
      spanId: partial.name,
      traceFlags: 1,
    }),
    attributes: {},
    links: [],
    events: [],
    duration: [0, 1],
    ...partial,
  } as ReadableSpan;
}

describe("bun-otlp-exporter", () => {
  it("renames orphan anonymous spans using the trace route label", () => {
    const routeSpan = mockSpan({
      name: "GET /help",
      attributes: {
        "http.request.method": "GET",
        "url.path": "/help",
        "http.route": "/help",
      },
      parentSpanContext: { traceId: "trace-1", spanId: "parent", traceFlags: 1 },
    });
    const orphan = mockSpan({
      name: "anonymous",
      attributes: {},
      parentSpanContext: undefined,
    });

    const labels = __testing.resolveTraceRouteLabels([routeSpan, orphan]);
    const display = __testing.resolveDisplayName(orphan, labels.get("trace-1"));

    expect(display).toBe("GET /help");
  });

  it("renames the server root span using the trace route label", () => {
    const root = mockSpan({
      name: "Root",
      kind: SpanKind.SERVER,
      attributes: {
        "http.request.method": "GET",
        "url.path": "/healthz/",
        "http.route": "/healthz/",
      },
      parentSpanContext: undefined,
    });

    expect(
      __testing.resolveDisplayName(root, __testing.pickTraceRouteLabel([root], "trace-1")),
    ).toBe("GET /healthz/");
  });

  it("drops sentry spans from export", () => {
    const sentry = mockSpan({
      name: "anonymous",
      attributes: {
        "sentry.op": "middleware.elysia",
        "sentry.origin": "auto.http.elysia",
      },
    });
    expect(__testing.isSentrySpan(sentry)).toBe(true);
  });

  it("renames Request spans to method and path", () => {
    const span = mockSpan({
      name: "Request",
      attributes: {
        "http.request.method": "GET",
        "url.path": "/healthz/",
      },
    });

    expect(__testing.resolveDisplayName(span, "GET /healthz/")).toBe(
      "GET /healthz/",
    );
  });
});
