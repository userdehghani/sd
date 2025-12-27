/**
 * Observability middleware for Elysia
 * Provides request/response logging, metrics, and tracing
 */

import { Elysia } from "elysia";
import { logger } from "./logger";
import { metrics } from "./metrics";
import { tracer, type TraceContext } from "./tracing";

/**
 * Request logging and metrics middleware
 */
interface Store {
  startTime?: number;
  traceContext?: TraceContext;
}

export function observabilityMiddleware() {
  return new Elysia({ name: "observability" })
    .derive(({ request, headers, store }) => {
      const startTime = Date.now();
      const traceContext = tracer.extractFromHeaders(headers as Record<string, string>) || tracer.createContext();
      
      // Store in context
      const storeData = store as Store;
      if (storeData) {
        storeData.startTime = startTime;
        storeData.traceContext = traceContext;
      }

      // Log incoming request
      logger.info("Incoming request", {
        method: request.method,
        path: new URL(request.url).pathname,
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
        userAgent: headers["user-agent"],
        ip: headers["x-forwarded-for"] || headers["x-real-ip"] || "unknown",
      });

      return {
        traceContext,
      };
    })
    .onAfterHandle(({ request, response, store, traceContext }) => {
      const storeData = store as Store;
      const startTime = storeData?.startTime || Date.now();
      const duration = Date.now() - startTime;
      const method = request.method;
      const path = new URL(request.url).pathname;
      const statusCode = (response as any)?.status || 200;

      // Record metrics
      metrics.observeRequestDuration(method, path, statusCode, duration);

      // Log response
      logger.info("Request completed", {
        method,
        path,
        statusCode,
        duration,
        traceId: traceContext?.traceId,
        spanId: traceContext?.spanId,
      });
    })
    .onError(({ error, request, store, traceContext }) => {
      const storeData = store as Store;
      const startTime = storeData?.startTime || Date.now();
      const duration = Date.now() - startTime;
      const method = request.method;
      const path = new URL(request.url).pathname;

      // Record error metrics
      const errorName = error instanceof Error ? error.name : "Unknown";
      metrics.incrementCounter("http_errors_total", {
        method,
        path,
        error: errorName,
      });

      // Log error
      logger.error("Request failed", error, {
        method,
        path,
        duration,
        traceId: traceContext?.traceId,
        spanId: traceContext?.spanId,
      });
    });
}

