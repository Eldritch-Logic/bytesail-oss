---
title: Requirements
description: System requirements for self-hosting ByteSail
---

## Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 20 GB | 50+ GB SSD |

Storage scales with the number of services and container images. Longhorn uses the host disk for persistent volumes.

## Software

- **Linux** — Ubuntu 22.04+, Debian 12+, or any systemd-based distro
- **Root access** — the installer needs to install K3s and configure the system
- No Docker required — K3s uses containerd

## Network

- **Ports 80 and 443** — open for HTTP/HTTPS traffic (Traefik ingress)
- **Port 6443** — K3s API server (only needed for multi-node clusters)
- **Outbound HTTPS** — required for Let's Encrypt, GitHub webhooks, and pulling container images

## DNS

For custom domains and TLS:

- An **A record** pointing your domain to the server IP
- Optionally a **wildcard A record** (`*.example.com`) for auto-generated subdomains
