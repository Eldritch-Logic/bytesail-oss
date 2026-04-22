---
title: Services
description: Managing services within projects
---

A service is a single deployable unit within a project. It maps to a K3s Deployment + Service + optional Ingress.

## Service Types

ByteSail auto-detects service types from Docker images:

| Type | Examples |
|------|----------|
| **app** | Node.js, Python, Go, custom Dockerfiles |
| **database** | PostgreSQL, MySQL, MongoDB |
| **redis** | Redis, KeyDB |
| **worker** | Background job processors |
| **cron** | Scheduled tasks |

## Creating a Service

Services can be created from:

- **Git Repository** — auto-builds with Railpacks on push
- **Docker Image** — pulls from any registry
- **Docker Compose** — imported from a compose file
- **Template** — one-click from the template gallery

## Service Configuration

### Runtime Settings

- **Replicas** — scale horizontally (1-10)
- **CPU/Memory limits** — resource constraints per container
- **Command override** — custom entrypoint
- **Restart policy** — always, on-failure, or never

### Health Checks

Configure an HTTP health check to ensure containers are ready:

- **Path** — e.g., `/health`
- **Port** — the container port to check
- **Interval** — seconds between checks

### Port Detection

ByteSail auto-detects ports from common images:

| Image | Port |
|-------|------|
| PostgreSQL | 5432 |
| MySQL/MariaDB | 3306 |
| Redis/KeyDB | 6379 |
| MongoDB | 27017 |
| Default | 3000 |

## Deployment

Each deploy creates a new deployment record tracking:

- Build logs and duration
- Deploy status (queued → building → deploying → running/failed)
- Commit hash and trigger type
- Rollback capability

```bash
# Deploy via CLI
bytesail up -s my-service

# List recent deployments
bytesail deploy list

# Rollback
bytesail deploy rollback <deployment-id>
```
