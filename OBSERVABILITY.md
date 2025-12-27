# Observability & Cloud-Native Features

This document describes the observability and cloud-native features implemented in this application.

## 📊 Observability Stack

### 1. Structured Logging (`src/logger.ts`)

**Features:**
- JSON and text log formats
- Log levels: DEBUG, INFO, WARN, ERROR
- Structured metadata support
- Automatic timestamp and service information
- Environment-based configuration

**Usage:**
```typescript
import { logger } from "./logger";

logger.info("User logged in", { userId: 123 });
logger.error("Database connection failed", error, { host: "db.example.com" });
```

**Configuration:**
- `LOG_LEVEL`: Set minimum log level (DEBUG, INFO, WARN, ERROR)
- `LOG_FORMAT`: Choose format (text for dev, json for production)
- `SERVICE_NAME`: Service identifier in logs
- `APP_VERSION`: Version in logs

### 2. Metrics Collection (`src/metrics.ts`)

**Features:**
- Prometheus-compatible metrics
- HTTP request duration histograms
- HTTP request counters
- Error tracking
- System metrics (CPU, memory, uptime)

**Endpoints:**
- `GET /metrics` - Prometheus text format
- `GET /metrics/json` - JSON format for other consumers

**Metrics Exposed:**
- `http_requests_total` - Total HTTP requests (counter)
- `http_request_duration_seconds` - Request duration (histogram)
- `http_errors_total` - Error count (counter)
- `app_uptime_seconds` - Application uptime (gauge)
- `app_info` - Application metadata (gauge)
- `process_cpu_user_seconds_total` - CPU usage (counter)
- `process_resident_memory_bytes` - Memory usage (gauge)
- `process_heap_bytes` - Heap memory (gauge)

### 3. Distributed Tracing (`src/tracing.ts`)

**Features:**
- W3C Trace Context support
- Automatic trace ID generation
- Span ID generation
- Trace context propagation via headers
- Request correlation

**Headers:**
- `traceparent` - W3C Trace Context format
- `x-trace-id` - Custom trace ID header
- `x-span-id` - Custom span ID header

**Usage:**
Tracing is automatically handled by the observability middleware. Trace IDs are included in all log entries.

### 4. Request/Response Middleware (`src/middleware.ts`)

**Features:**
- Automatic request logging
- Response time tracking
- Error logging
- Metrics collection
- Trace context propagation

**What's Logged:**
- Request method and path
- Response status code
- Request duration
- Trace and span IDs
- User agent and IP address
- Error details (if any)

## 🔧 Configuration Management (`src/config.ts`)

Centralized configuration with environment variable support:

**Server:**
- `PORT` - Server port (default: 3005)
- `HOST` - Server host (default: 0.0.0.0)
- `NODE_ENV` - Environment (development/production)

**Service:**
- `SERVICE_NAME` - Service identifier
- `APP_VERSION` - Application version

**Database:**
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name

**Observability:**
- `LOG_LEVEL` - Logging level
- `LOG_FORMAT` - Log format (text/json)
- `ENABLE_METRICS` - Enable metrics collection
- `ENABLE_TRACING` - Enable distributed tracing

**Graceful Shutdown:**
- `SHUTDOWN_TIMEOUT` - Shutdown timeout in ms (default: 10000)

## 🏥 Health Checks

### Endpoints

1. **`GET /health`** - Comprehensive health check
   - Checks application and all dependencies
   - Returns 200 for healthy/degraded, 503 for unhealthy

2. **`GET /health/live`** - Liveness probe
   - Kubernetes liveness probe endpoint
   - Only checks if application is running
   - Returns 200 if alive, 503 if dead

3. **`GET /health/ready`** - Readiness probe
   - Kubernetes readiness probe endpoint
   - Checks application and critical dependencies
   - Returns 200 if ready, 503 if not ready

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.50",
  "checks": {
    "application": {
      "status": "up",
      "responseTime": 1,
      "message": "Application is running"
    },
    "database": {
      "status": "up",
      "responseTime": 15,
      "message": "Database connection available"
    }
  }
}
```

## 🐳 Docker & Kubernetes

### Docker Compose

- Health checks for all services
- Service dependencies
- Environment variable configuration
- Network isolation

### Kubernetes Integration

**Liveness Probe:**
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3005
  initialDelaySeconds: 10
  periodSeconds: 10
```

**Readiness Probe:**
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3005
  initialDelaySeconds: 5
  periodSeconds: 5
```

**Metrics Scraping:**
```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3005"
  prometheus.io/path: "/metrics"
```

## 📈 Monitoring Integration

### Prometheus

The `/metrics` endpoint is Prometheus-compatible. Configure Prometheus to scrape:

```yaml
scrape_configs:
  - job_name: 'elysia-app'
    scrape_interval: 15s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:3005']
```

### Grafana Dashboards

Use the following metrics for dashboards:
- Request rate: `rate(http_requests_total[5m])`
- Error rate: `rate(http_errors_total[5m])`
- P95 latency: `histogram_quantile(0.95, http_request_duration_seconds)`
- Uptime: `app_uptime_seconds`

### Log Aggregation

For production, use JSON log format:
```bash
LOG_FORMAT=json
```

Logs can be ingested by:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Loki
- CloudWatch
- Datadog
- Any JSON log aggregator

## 🔒 Security Considerations

- Health check endpoints don't expose sensitive information
- Metrics endpoint can be secured with authentication middleware
- Logs don't include sensitive data by default
- Trace IDs are safe to expose in headers

## 🚀 Best Practices

1. **Production Logging**: Always use JSON format in production
2. **Log Levels**: Use appropriate log levels (INFO for normal operations, ERROR for failures)
3. **Metrics**: Monitor key metrics (request rate, error rate, latency)
4. **Health Checks**: Configure appropriate intervals for your use case
5. **Tracing**: Use trace IDs to correlate logs across services
6. **Configuration**: Never commit sensitive values, use environment variables

## 📚 Additional Resources

- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [12-Factor App](https://12factor.net/)
- [Kubernetes Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

