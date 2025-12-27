/**
 * Distributed tracing support
 * Generates trace IDs and span IDs for request correlation
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

class Tracer {
  /**
   * Generate a new trace ID (W3C Trace Context format compatible)
   */
  generateTraceId(): string {
    return this.generateId(32);
  }

  /**
   * Generate a new span ID
   */
  generateSpanId(): string {
    return this.generateId(16);
  }

  /**
   * Create a new trace context
   */
  createContext(parentContext?: TraceContext): TraceContext {
    return {
      traceId: parentContext?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: parentContext?.spanId,
      baggage: parentContext?.baggage || {},
    };
  }

  /**
   * Extract trace context from headers (W3C Trace Context)
   */
  extractFromHeaders(headers: Record<string, string | undefined>): TraceContext | null {
    const traceparent = headers["traceparent"] || headers["Traceparent"];
    if (!traceparent) {
      return null;
    }

    // Parse W3C traceparent format: version-trace_id-parent_id-trace_flags
    const parts = traceparent.split("-");
    if (parts.length !== 4) {
      return null;
    }

    return {
      traceId: parts[1],
      spanId: parts[2],
      baggage: {},
    };
  }

  /**
   * Inject trace context into headers
   */
  injectToHeaders(context: TraceContext): Record<string, string> {
    // W3C Trace Context format
    const traceparent = `00-${context.traceId}-${context.spanId}-01`;
    return {
      traceparent,
      "x-trace-id": context.traceId,
      "x-span-id": context.spanId,
    };
  }

  private generateId(length: number): string {
    const chars = "0123456789abcdef";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}

export const tracer = new Tracer();

