---
title: Upgrade
description: Upgrading ByteSail
---

ByteSail checks for updates automatically and can be upgraded from the dashboard or CLI.

## Automatic Update Checks

ByteSail checks GitHub Releases hourly for new versions. When an update is available, a banner appears in the dashboard for admin users.

## Upgrading from the Dashboard

1. When the update banner appears, click **View Release Notes** to review changes
2. Click **Update Now**
3. Confirm the update — ByteSail performs a zero-downtime rolling update via K3s Deployment patch

## Upgrading from the CLI

```bash
# Check for updates
bytesail update check

# Apply the update
bytesail update apply
```

## What Happens During an Upgrade

1. ByteSail pulls the new container image
2. The K3s Deployment is patched with the new image tag
3. K3s performs a rolling update — new pods start before old pods terminate
4. Database migrations run automatically on startup
5. The dashboard reconnects seamlessly

## Rollback

If an update causes issues, you can roll back by patching the deployment image tag:

```bash
kubectl set image deployment/bytesail \
  bytesail=ghcr.io/eldritch-logic/bytesail:<previous-version> \
  -n bytesail-system
```
