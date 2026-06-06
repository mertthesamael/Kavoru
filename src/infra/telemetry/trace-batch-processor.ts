import { SpanKind } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/sdk-trace-base";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";

const MAX_TRACES = 256;
const FLUSH_DELAY_MS = 64;

type TraceBuffer = {
  spans: ReadableSpan[];
  timer?: ReturnType<typeof setTimeout>;
};

export class TraceBatchSpanProcessor implements SpanProcessor {
  private readonly buffers = new Map<string, TraceBuffer>();

  constructor(private readonly exporter: SpanExporter) {}

  onStart(_span: Span, _parentContext: unknown): void {}

  onEnd(span: ReadableSpan): void {
    const traceId = span.spanContext().traceId;

    let buffer = this.buffers.get(traceId);
    if (!buffer) {
      this.evictOldestBuffer();
      buffer = { spans: [] };
      this.buffers.set(traceId, buffer);
    }

    buffer.spans.push(span);

    if (buffer.timer) clearTimeout(buffer.timer);

    const flushNow =
      !span.parentSpanContext &&
      (span.kind === SpanKind.SERVER || span.name === "Root");

    if (flushNow) {
      this.flush(traceId);
      return;
    }

    buffer.timer = setTimeout(() => this.flush(traceId), FLUSH_DELAY_MS);
    buffer.timer.unref?.();
  }

  async forceFlush(): Promise<void> {
    for (const traceId of [...this.buffers.keys()]) {
      this.flush(traceId);
    }
    await this.exporter.flush?.();
  }

  async shutdown(): Promise<void> {
    for (const traceId of [...this.buffers.keys()]) {
      this.flush(traceId);
    }
    await this.exporter.shutdown?.();
  }

  private flush(traceId: string) {
    const buffer = this.buffers.get(traceId);
    if (!buffer?.spans.length) return;

    if (buffer.timer) {
      clearTimeout(buffer.timer);
      buffer.timer = undefined;
    }

    const spans = buffer.spans;
    this.buffers.delete(traceId);

    this.exporter.export(spans, () => {});
  }

  private evictOldestBuffer() {
    if (this.buffers.size < MAX_TRACES) return;
    const oldest = this.buffers.keys().next().value;
    if (oldest) this.flush(oldest);
  }
}
