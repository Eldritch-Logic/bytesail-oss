---
title: Backup
description: Backing up ByteSail data
---

## What to Back Up

| Data | Location | Method |
|------|----------|--------|
| **ByteSail metadata** | PostgreSQL database | `pg_dump` |
| **Service data** | Longhorn PVCs | Longhorn snapshots or volume backups |
| **K3s state** | `/var/lib/rancher/k3s/server/db/` | File copy (when K3s is stopped) |
| **Secrets** | Kubernetes Secrets | `kubectl get secrets` export |

## Database Backup

The PostgreSQL database stores all ByteSail metadata (projects, services, deployments, variables, users).

```bash
# Get the database password
kubectl get secret postgres-credentials -n bytesail-system \
  -o jsonpath='{.data.password}' | base64 -d

# Run pg_dump from the postgres pod
kubectl exec -n bytesail-system deploy/postgres -- \
  pg_dump -U bytesail bytesail > backup.sql
```

## Restoring

```bash
# Restore the database
kubectl exec -i -n bytesail-system deploy/postgres -- \
  psql -U bytesail bytesail < backup.sql
```

## Longhorn Volumes

Longhorn provides built-in snapshot and backup capabilities. Access the Longhorn UI or use the Longhorn CLI to create volume snapshots for service data (databases, file storage).

## Automated Backups

For production use, set up a cron job on the host:

```bash
# /etc/cron.d/bytesail-backup
0 2 * * * root kubectl exec -n bytesail-system deploy/postgres -- pg_dump -U bytesail bytesail | gzip > /backups/bytesail-$(date +\%Y\%m\%d).sql.gz
```
