# Deployment Guide

## Docker Deployment

### Build Image

```bash
docker build -t myapp:latest .
```

### Run Container

```bash
docker run -d \
  --name myapp \
  -p 3000:3000 \
  --env-file .env \
  myapp:latest
```

## Docker Compose Deployment

```bash
docker-compose up -d
```

This will start:
- Application server
- PostgreSQL database
- Redis cache

## Kubernetes Deployment

### 1. Create ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  PORT: "3000"
  HOST: "0.0.0.0"
  NODE_ENV: "production"
  DATABASE_HOST: "postgres-service"
  DATABASE_PORT: "5432"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
```

### 2. Create Secrets

```bash
kubectl create secret generic myapp-secrets \
  --from-literal=DATABASE_PASSWORD=your-password \
  --from-literal=JWT_SECRET=your-jwt-secret \
  --from-literal=S3_ACCESS_KEY_ID=your-key \
  --from-literal=S3_SECRET_ACCESS_KEY=your-secret \
  --from-literal=EMAIL_API_KEY=your-key
```

### 3. Deploy Application

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: myapp-config
        - secretRef:
            name: myapp-secrets
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 4. Create Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 3000
```

## Environment Variables

Required environment variables for production:

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Database
DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_NAME=myapp
DATABASE_USER=myapp
DATABASE_PASSWORD=<secret>

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=<secret>

# JWT
JWT_SECRET=<secret-min-32-chars>
JWT_EXPIRES_IN=30d

# AWS S3
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<secret>
S3_SECRET_ACCESS_KEY=<secret>
S3_BUCKET_NAME=myapp-avatars
S3_CDN_URL=https://cdn.example.com

# OAuth
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_REDIRECT_URI=https://api.example.com/api/auth/callback/google

APPLE_CLIENT_ID=<your-client-id>
APPLE_CLIENT_SECRET=<secret>
APPLE_REDIRECT_URI=https://api.example.com/api/auth/callback/apple

# PassKey
PASSKEY_RP_NAME=MyApp
PASSKEY_RP_ID=example.com
PASSKEY_ORIGIN=https://example.com

# Email
EMAIL_API_KEY=<secret>
EMAIL_FROM_EMAIL=noreply@example.com
EMAIL_FROM_NAME=MyApp

# SMS
SMS_USERNAME=<your-username>
SMS_PASSWORD=<secret>
SMS_FROM_NUMBER=<your-number>

# Rate Limiting
RATE_LIMIT_CAPACITY=100
RATE_LIMIT_REFILL_RATE=10
```

## Database Migrations

Run migrations before deployment:

```bash
psql $DATABASE_URL -f src/infrastructure/database/migrations/001_create_users_table.sql
psql $DATABASE_URL -f src/infrastructure/database/migrations/002_create_sessions_table.sql
```

## Health Checks

Configure health checks in your infrastructure:

- **Liveness**: `GET /health/live`
- **Readiness**: `GET /health/ready`

## Monitoring

### Prometheus Metrics

Scrape metrics from: `GET /metrics`

Example Prometheus config:

```yaml
scrape_configs:
  - job_name: 'myapp'
    static_configs:
      - targets: ['myapp-service:3000']
    metrics_path: '/metrics'
```

### Logging

Logs are output to stdout in JSON format. Configure log aggregation (e.g., ELK, CloudWatch).

## Scaling

### Horizontal Scaling

The application is stateless and can be horizontally scaled:

```bash
kubectl scale deployment myapp --replicas=5
```

### Vertical Scaling

Adjust resource limits in Kubernetes:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

## Security Checklist

- [ ] Use strong JWT secret (min 32 characters)
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS for production domains
- [ ] Use secure database passwords
- [ ] Enable Redis authentication
- [ ] Configure S3 bucket policies
- [ ] Rotate secrets regularly
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Use IAM roles for AWS services
- [ ] Enable audit logging

## Backup & Recovery

### Database Backup

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Redis Backup

Configure Redis persistence (RDB/AOF) in redis.conf

## Performance Tuning

### PostgreSQL

- Configure connection pool size
- Enable query caching
- Optimize indexes

### Redis

- Configure maxmemory
- Set eviction policy
- Enable persistence

### Application

- Adjust rate limiting
- Configure JWT expiration
- Optimize session TTL

## Troubleshooting

### Application Won't Start

Check logs:
```bash
kubectl logs -f deployment/myapp
```

Common issues:
- Database connection failure
- Redis connection failure
- Missing environment variables

### High Memory Usage

- Check for memory leaks
- Review connection pool sizes
- Monitor Redis memory usage

### Slow Response Times

- Check database query performance
- Review Redis cache hit rate
- Monitor rate limiter performance
