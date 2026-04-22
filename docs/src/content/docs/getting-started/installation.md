---
title: Installation
description: Install ByteSail on your server
---

ByteSail runs on a single Linux server and uses K3s for container orchestration.

## Requirements

- **OS**: Linux (Ubuntu 22.04+ or Debian 12+ recommended)
- **CPU**: 2+ cores
- **RAM**: 4 GB minimum
- **Disk**: 20 GB minimum
- **Network**: Public IP with ports 80 and 443 open

## Quick Install

```bash
curl -fsSL https://get.bytesail.dev | bash
```

The installer will:

1. Verify system requirements
2. Install K3s with custom networking (10.0.0.0/8 pod CIDR)
3. Generate secrets for auth, encryption, and the database
4. Deploy PostgreSQL as the metadata store
5. Install cert-manager with Let's Encrypt for automatic TLS
6. Deploy the observability stack (Loki, Prometheus, Grafana, Alloy)
7. Deploy the ByteSail API and dashboard

## Post-Install

Access the dashboard at `http://<your-server-ip>` and create your admin account.

### Set a Base Domain

Point a wildcard DNS record to your server for custom domains and TLS:

```
*.example.com → <server-ip>
```

Then configure the base domain in **Settings > General**.

### Verify the Cluster

```bash
kubectl get pods -A
```

All pods should reach `Running` within a few minutes.
