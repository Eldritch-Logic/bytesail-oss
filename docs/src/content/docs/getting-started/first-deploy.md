---
title: First Deploy
description: Deploy your first application with ByteSail
---

This guide walks you through deploying your first service.

## From the Dashboard

1. Navigate to **Projects** and click **New Project**
2. Give your project a name (e.g., "my-app")
3. On the project canvas, click **Add Service**
4. Choose a source:
   - **Git Repository** — connect a GitHub repo for auto-builds
   - **Docker Image** — use a pre-built image (e.g., `nginx:latest`)
   - **Docker Compose** — import a compose file
   - **Template** — pick from the template gallery
5. Click **Deploy**

ByteSail will build your code with Railpacks (zero-config), push the image to the internal registry, and deploy it to K3s.

## From the CLI

Install the CLI and authenticate:

```bash
# Login to your ByteSail instance
bytesail login --url https://bytesail.example.com

# Create a project and link your directory
bytesail project create my-app
bytesail project link

# Deploy
bytesail up
```

The CLI will detect your project, build it, and stream deployment logs.

## What Happens During a Deploy

1. **Build** — Railpacks analyzes your code, detects the language/framework, and builds a container image. No Dockerfile needed.
2. **Push** — The image is pushed to the internal OCI registry.
3. **Deploy** — ByteSail creates a K3s Deployment, Service, and optionally an Ingress. Environment variables are synced as Kubernetes Secrets.
4. **Health Check** — If configured, ByteSail waits for the health check to pass before marking the deployment as successful.

## Adding a Domain

Once deployed, add a custom domain:

1. Go to the service's **Networking** tab
2. Click **Add Domain** and enter your hostname
3. ByteSail creates a Traefik Ingress and provisions a TLS certificate via Let's Encrypt

Or via CLI:

```bash
bytesail domain add app.example.com -s my-service
```
