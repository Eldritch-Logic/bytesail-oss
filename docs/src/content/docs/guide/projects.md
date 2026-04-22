---
title: Projects
description: Managing projects in ByteSail
---

A project is the top-level container for your services. Each project gets its own Kubernetes namespace (`project-<id-prefix>-<slug>`) for isolation.

## Creating a Project

**Dashboard**: Click **New Project** from the projects page, enter a name, and you'll land on the project canvas.

**CLI**:
```bash
bytesail project create my-app
```

## Project Canvas

The canvas provides a visual overview of all services, their connections, and status. Services appear as draggable nodes with real-time status indicators.

- **Edges** connect services that share environment variables (e.g., a web app referencing a database URL)
- **Groups** let you visually organize related services
- **Right-click** a service or the canvas background for context actions
- Node positions are persisted automatically

## Managing Projects

| Action | Dashboard | CLI |
|--------|-----------|-----|
| List | Projects page | `bytesail project list` |
| Open | Click project card | `bytesail open` |
| Delete | Settings > Delete | `bytesail project delete <name>` |
| Link directory | N/A | `bytesail project link` |

Deleting a project tears down all K3s resources (Deployments, Services, PVCs) in the project namespace.
