# Cloud-Native Elysia Application

A production-ready, cloud-native application built with Elysia and Bun runtime, featuring comprehensive observability, health checks, and cloud-native best practices.

## Features

- ✅ **Health Checks** - Kubernetes-ready liveness and readiness probes
- ✅ **Structured Logging** - JSON logging for log aggregation systems
- ✅ **Metrics** - Prometheus-compatible metrics endpoint
- ✅ **Distributed Tracing** - W3C Trace Context support
- ✅ **Graceful Shutdown** - Proper resource cleanup on termination
- ✅ **Configuration Management** - Environment-based configuration
- ✅ **OpenAPI Documentation** - Auto-generated API documentation

## Getting Started

### Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

The server will be available at `http://localhost:3005`

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build and run standalone
docker build -t elysia-app .
docker run -p 3005:3005 elysia-app
```

## API Endpoints

### Application
- `GET /` - Root endpoint with service information
- `GET /openapi` - OpenAPI/Swagger documentation

### Health Checks
- `GET /health` - Comprehensive health check (all dependencies)
- `GET /health/live` - Liveness probe (Kubernetes)
- `GET /health/ready` - Readiness probe (Kubernetes)

### Observability
- `GET /metrics` - Prometheus metrics (text format)
- `GET /metrics/json` - Metrics in JSON format

## Configuration

The application uses environment variables for configuration. Key variables:

```bash
# Server
PORT=3005
HOST=0.0.0.0
NODE_ENV=development

# Service
SERVICE_NAME=elysia-app
APP_VERSION=1.0.50

# Database
DB_HOST=localhost
DB_PORT=5432

# Observability
LOG_LEVEL=INFO          # DEBUG, INFO, WARN, ERROR
LOG_FORMAT=text         # text or json
ENABLE_METRICS=true
ENABLE_TRACING=true
```

See `docker-compose.yml` for all available configuration options.

## Observability

### Logging

Structured logging with support for JSON and text formats:

- **Development**: Text format with colored output
- **Production**: JSON format for log aggregation (ELK, Loki, etc.)

Log levels: `DEBUG`, `INFO`, `WARN`, `ERROR`

### Metrics

Prometheus-compatible metrics available at `/metrics`:

- HTTP request duration (histogram)
- HTTP request count (counter)
- HTTP errors (counter)
- Application uptime
- Memory usage
- CPU usage

### Tracing

Distributed tracing with W3C Trace Context support:

- Automatic trace ID generation
- Request correlation via trace headers
- Support for traceparent header propagation

## Kubernetes Deployment

Example Kubernetes configuration:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: elysia-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: elysia-app:latest
        ports:
        - containerPort: 3005
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3005
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3005
          initialDelaySeconds: 5
          periodSeconds: 5
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_FORMAT
          value: "json"
```

## Cloud-Native Features

✅ **Health Checks** - Liveness and readiness probes  
✅ **Graceful Shutdown** - SIGTERM/SIGINT handling  
✅ **Configuration** - 12-factor app configuration  
✅ **Observability** - Logging, metrics, tracing  
✅ **Stateless Design** - Ready for horizontal scaling  
✅ **Resource Limits** - Configurable timeouts and limits  

## Development

```bash
# Development with hot reload
bun run dev

# Build for production
bun run build

# Start production build
bun run start
```

## License

MIT