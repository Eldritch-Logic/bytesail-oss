---
title: Managed Databases
description: Provisioning and managing databases
---

ByteSail can provision managed database instances that run as services within your project.

## Supported Databases

| Database | Image | Default Port |
|----------|-------|------|
| PostgreSQL | `postgres:16-alpine` | 5432 |
| MySQL | `mysql:8` | 3306 |
| MariaDB | `mariadb:11` | 3306 |
| MongoDB | `mongo:7` | 27017 |
| Redis | `redis:7-alpine` | 6379 |
| KeyDB | `eqalpha/keydb:latest` | 6379 |

## Provisioning a Database

### Dashboard

1. Navigate to your project and click **Databases**
2. Click **Add Database**
3. Select the database type, enter a name, and optionally adjust the storage size (1-100 GB)
4. Click **Create** — ByteSail provisions the database and triggers deployment

### CLI

```bash
bytesail db add
# Interactive prompts for type and name
```

## What Gets Created

When you provision a database, ByteSail:

1. Creates a service with the appropriate Docker image
2. Provisions a Longhorn PersistentVolumeClaim for data storage
3. Sets up environment variables (credentials, database name)
4. Generates a connection URL
5. Automatically deploys the database

## Connecting

Get the connection URL from the dashboard (Databases page) or CLI:

```bash
bytesail db connect my-postgres
# postgresql://user:password@my-postgres:5432/dbname
```

Use this URL in your application's environment variables. Services in the same project can reach databases by their service name (K8s DNS).

## Storage

Database data is stored on Longhorn PersistentVolumeClaims with configurable size. Data persists across container restarts and redeployments.
