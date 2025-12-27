/**
 * Prometheus-compatible metrics collection
 * Provides standard metrics for cloud-native monitoring
 */

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Map<string, MetricValue[]> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private startTime: number = Date.now();

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels?: Record<string, string>, value: number = 1) {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Record a gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const metrics = this.metrics.get(name)!;
    const existing = metrics.findIndex((m) => this.labelsMatch(m.labels, labels));
    if (existing >= 0) {
      metrics[existing] = { value, labels };
    } else {
      metrics.push({ value, labels });
    }
  }

  /**
   * Record a histogram value (for response times, etc.)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
  }

  /**
   * Observe request duration
   */
  observeRequestDuration(method: string, path: string, statusCode: number, duration: number) {
    this.recordHistogram("http_request_duration_seconds", duration / 1000, {
      method,
      path,
      status: statusCode.toString(),
    });
    this.incrementCounter("http_requests_total", {
      method,
      path,
      status: statusCode.toString(),
    });
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return `${name}{${labelStr}}`;
  }

  private labelsMatch(a?: Record<string, string>, b?: Record<string, string>): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (Object.keys(a).length !== Object.keys(b).length) return false;
    return Object.keys(a).every((k) => a[k] === b[k]);
  }

  /**
   * Generate Prometheus metrics format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    // HTTP request metrics
    lines.push("# HELP http_requests_total Total number of HTTP requests");
    lines.push("# TYPE http_requests_total counter");
    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith("http_requests_total")) {
        lines.push(`${key} ${value}`);
      }
    }

    lines.push("\n# HELP http_request_duration_seconds HTTP request duration in seconds");
    lines.push("# TYPE http_request_duration_seconds histogram");
    for (const [key, values] of this.histograms.entries()) {
      if (key.startsWith("http_request_duration_seconds")) {
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const count = values.length;
          const avg = sum / count;
          const sorted = [...values].sort((a, b) => a - b);
          const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
          const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
          const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

          const baseKey = key.replace(/\{[^}]+\}/, "");
          const labels = key.match(/\{([^}]+)\}/)?.[1] || "";

          lines.push(`${baseKey}_sum{${labels}} ${sum}`);
          lines.push(`${baseKey}_count{${labels}} ${count}`);
          lines.push(`${baseKey}_avg{${labels}} ${avg}`);
          lines.push(`${baseKey}_p50{${labels}} ${p50}`);
          lines.push(`${baseKey}_p95{${labels}} ${p95}`);
          lines.push(`${baseKey}_p99{${labels}} ${p99}`);
        }
      }
    }

    // Application metrics
    lines.push("\n# HELP app_uptime_seconds Application uptime in seconds");
    lines.push("# TYPE app_uptime_seconds gauge");
    lines.push(`app_uptime_seconds ${Math.floor((Date.now() - this.startTime) / 1000)}`);

    lines.push("\n# HELP app_info Application information");
    lines.push("# TYPE app_info gauge");
    lines.push(
      `app_info{version="${process.env.APP_VERSION || "1.0.50"}",service="${process.env.SERVICE_NAME || "elysia-app"}"} 1`
    );

    // Process metrics
    lines.push("\n# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds");
    lines.push("# TYPE process_cpu_user_seconds_total counter");
    const cpuUsage = process.cpuUsage();
    lines.push(`process_cpu_user_seconds_total ${cpuUsage.user / 1_000_000}`);

    lines.push("\n# HELP process_resident_memory_bytes Resident memory size in bytes");
    lines.push("# TYPE process_resident_memory_bytes gauge");
    lines.push(`process_resident_memory_bytes ${process.memoryUsage().rss}`);

    lines.push("\n# HELP process_heap_bytes Heap memory size in bytes");
    lines.push("# TYPE process_heap_bytes gauge");
    lines.push(`process_heap_bytes ${process.memoryUsage().heapUsed}`);

    return lines.join("\n");
  }

  /**
   * Get metrics as JSON (for non-Prometheus consumers)
   */
  toJSON() {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [
          k,
          {
            count: v.length,
            sum: v.reduce((a, b) => a + b, 0),
            avg: v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0,
            min: v.length > 0 ? Math.min(...v) : 0,
            max: v.length > 0 ? Math.max(...v) : 0,
          },
        ])
      ),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };
  }
}

export const metrics = new MetricsCollector();

