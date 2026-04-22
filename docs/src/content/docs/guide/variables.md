---
title: Variables
description: Environment variables and secrets
---

Environment variables are injected into your service containers at runtime via Kubernetes Secrets.

## Managing Variables

### Dashboard

Navigate to your service and open the **Variables** tab. You can:

- Add variables with a key-value editor
- Toggle the **Secret** checkbox to mask sensitive values
- Click the eye icon to reveal a secret's value
- Save changes — they take effect on the next deploy

### CLI

```bash
# List variables
bytesail env list -s my-service

# Set a variable
bytesail env set DATABASE_URL=postgres://... -s my-service

# Set a secret
bytesail env set API_KEY=sk-xxx -s my-service --secret

# Get a variable
bytesail env get DATABASE_URL -s my-service

# Delete a variable
bytesail env delete OLD_KEY -s my-service
```

## Secrets

Variables marked as secrets are:

- **Encrypted at rest** in the database
- **Masked** in the UI (shown as `••••••••`)
- **Revealable** on demand via the eye icon or `env get` CLI command
- **Never logged** in deployment logs or API responses

Auto-detection marks variables as secrets when their key contains `password`, `secret`, `key`, or `token`.

## Compose Variables

When deploying from Docker Compose, ByteSail extracts all environment variables from the compose file:

- Variables with literal values are populated automatically
- Variables using `${VAR}` syntax require you to set values in the Variables tab
- Cross-service references (e.g., `postgres://user:pass@db-service:5432`) are automatically resolved with K8s-compatible hostnames

## How Variables Are Deployed

On each deployment, ByteSail:

1. Reads all variables for the service + environment
2. Decrypts any secrets
3. Writes them to a Kubernetes Secret (`<service-slug>-env`)
4. The container loads them via `envFrom` in the pod spec
