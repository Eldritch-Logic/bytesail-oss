---
title: Monitoring
description: Logs, metrics, and alerts
---

ByteSail includes a full observability stack for logs, metrics, and alerting.

## Architecture

| Component | Role |
|-----------|------|
| **Grafana Alloy** | Log and metric collection agent (DaemonSet) |
| **Loki** | Log aggregation and querying |
| **Prometheus** | Metrics collection and storage |
| **kube-state-metrics** | Kubernetes object metrics |
| **node-exporter** | Host-level metrics (CPU, memory, disk) |
| **Alertmanager** | Alert routing and notification |
| **Grafana** | Dashboards and visualization |

## Logs

### Dashboard

Navigate to a service and click **Logs** to stream logs in real-time. Features:

- **Live streaming** via WebSocket
- **Search** across log lines
- **Level filtering** (info, warn, error)
- **Time-range selection**
- **Auto-scroll** toggle

### CLI

```bash
# Stream logs
bytesail logs -s my-service

# Show last 200 lines without streaming
bytesail logs -s my-service -t 200 --no-follow
```

### How It Works

Alloy collects logs from all pod stdout/stderr and ships them to Loki. The dashboard queries Loki's API filtered by the service's Kubernetes labels.

## Metrics

Navigate to a service's **Metrics** tab to see:

- **CPU usage** (cores)
- **Memory usage** (MB)
- **Network I/O** (bytes/sec)
- **Restart count**

Metrics are collected by Prometheus from kube-state-metrics and node-exporter, charted with Chart.js.

## System Monitoring

The **Monitoring** page shows cluster-wide health:

- Node count and status
- Total CPU and memory usage
- Storage utilization
- Per-service status overview

## Alerts

Configure notification channels in **Settings > Notifications** to receive alerts for:

- Deployment started/succeeded/failed
- Service crashes and restarts
- Certificate expiring
- Backup completed/failed

Supported channels: **Slack**, **Discord**, **Telegram**, **Email** (SMTP), and **Webhook** (with HMAC signing).

## Grafana

Grafana is available at `/grafana` on your ByteSail instance with pre-configured data sources for Loki and Prometheus.
