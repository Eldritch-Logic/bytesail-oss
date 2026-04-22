---
title: API Reference
description: ByteSail API documentation
---

ByteSail exposes a **tRPC v11** API at `/api/trpc`. All dashboard and CLI operations use this API.

## Authentication

API requests require one of:

- **Session cookie** — set by the dashboard after login
- **Bearer token** — API key in the `Authorization: Bearer <key>` header
- **API key header** — `x-api-key: <key>` header

### Creating an API Key

1. Go to **Settings > API Keys** in the dashboard
2. Click **Create API Key**
3. Configure name, expiration, permissions, and rate limits
4. Copy the key — it's only shown once

## API Routers

| Router | Prefix | Description |
|--------|--------|-------------|
| `project` | `project.*` | Project CRUD |
| `service` | `service.*` | Service management |
| `deployment` | `deployment.*` | Deployment triggers and history |
| `variable` | `variable.*` | Environment variables |
| `domain` | `domain.*` | Domain management |
| `compose` | `compose.*` | Docker Compose stacks |
| `database` | `database.*` | Managed databases |
| `template` | `template.*` | Template gallery and deploy |
| `monitoring` | `monitoring.*` | Logs and metrics |
| `notification` | `notification.*` | Notification channels |
| `settings` | `settings.*` | System settings and audit logs |
| `apikey` | `apikey.*` | API key management |
| `volume` | `volume.*` | Storage volumes |
| `git` | `git.*` | Git provider configuration |
| `environment` | `environment.*` | Environment management |

## Authorization Levels

| Procedure | Access |
|-----------|--------|
| `protectedProcedure` | Any authenticated user |
| `orgProcedure` | User with an active organization |
| `adminProcedure` | Organization owner or admin |
| `bearerProcedure` | API key (Bearer token) |

## Example: tRPC Client

```typescript
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@bytesail/api";

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "https://bytesail.example.com/api/trpc",
      headers: { "x-api-key": "bs_your_api_key" },
    }),
  ],
});

const projects = await client.project.list.query();
```
