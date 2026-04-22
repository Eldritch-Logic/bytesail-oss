---
title: Docker Compose
description: Deploying Docker Compose stacks
---

ByteSail can import Docker Compose files and deploy them as a set of connected services on K3s.

## Deploying a Compose Stack

### Dashboard

1. Navigate to your project and click **New Stack**
2. Name your stack and paste or edit the compose YAML in the built-in editor
3. Click **Save & Deploy**

### CLI

```bash
bytesail compose up -f docker-compose.yml
```

## Supported Features

| Feature | Supported |
|---------|-----------|
| `services` | Yes |
| `image` | Yes |
| `ports` | Yes (host:container mapping) |
| `environment` | Yes (inline and `${VAR}` references) |
| `volumes` (named) | Yes (Longhorn PVCs) |
| `depends_on` | Yes (deploy ordering) |
| `healthcheck` | Yes (HTTP path extraction) |
| `command` | Yes |
| `restart` | Yes |

## What Happens on Import

1. **YAML Parsing** — validates the compose file structure
2. **Service Detection** — auto-detects types (app, database, redis) from image names
3. **Port Detection** — extracts ports from mappings or infers from image (postgres=5432, redis=6379, etc.)
4. **Volume Provisioning** — named volumes become Longhorn PersistentVolumeClaims
5. **Environment Variables** — all variables are extracted and added to the Variables table
6. **Dependency Graph** — services referencing each other via environment variables are linked with edges on the canvas
7. **Deploy Ordering** — databases and caches deploy first (with a wait), then application services

## Variable Resolution

- Literal values (e.g., `DB_NAME=mydb`) are set automatically
- `${VAR}` references require you to set values in the Variables tab
- Service name references in hostnames are replaced with K8s-compatible slugs (e.g., `my_db` becomes `my-db`)

## Limitations

- **Build context** (`build:`) is not supported — use pre-built images
- **Bind mounts** (host paths) are not supported — use named volumes
- **Networks** are ignored — all services in a project share a K8s namespace and can reach each other by service name
- **Profiles** and **extensions** are not parsed

## Managing Stacks

```bash
# Check stack status
bytesail compose status

# Stop all services in the stack
bytesail compose down
```

Deleting a stack from the dashboard also tears down all K8s resources (Deployments, Services, PVCs).
