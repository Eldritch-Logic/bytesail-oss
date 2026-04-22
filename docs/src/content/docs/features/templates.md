---
title: Templates
description: Using and creating one-click templates
---

Templates provide one-click deployment of popular applications and databases.

## Using Templates

1. Navigate to the **Templates** page
2. Browse or search the gallery by category
3. Click **Deploy** on a template
4. Choose an existing project or create a new one
5. Fill in any configuration fields (passwords, database names, etc.)
6. Click **Deploy** — ByteSail creates all services and triggers deployment

## Available Templates

Templates are organized by category:

| Category | Templates |
|----------|-----------|
| **Databases** | PostgreSQL, MySQL, MariaDB, MongoDB, Redis, KeyDB |
| **CMS** | WordPress, Ghost, Strapi, Directus |
| **Analytics** | Plausible, Umami, PostHog |
| **Automation** | n8n |
| **Storage** | MinIO |
| **Monitoring** | Uptime Kuma |
| **Development** | Gitea, NocoDB |
| **Communication** | Listmonk |
| **Security** | Vaultwarden |

## Template Variables

Templates support dynamic variables with defaults and auto-generation:

| Syntax | Description |
|--------|-------------|
| `{{VAR\|default:value}}` | Uses `value` if not provided |
| `{{VAR\|generate:password:24}}` | Generates a 24-char random password |
| `{{VAR\|generate:hex:32}}` | Generates a 32-char hex string |
| `{{VAR\|generate:uuid}}` | Generates a UUID |

## Creating Custom Templates

Templates are JSON files in the `templates/` directory. Each template defines:

```json
{
  "slug": "my-app",
  "name": "My App",
  "description": "Description of the app",
  "icon": "🚀",
  "category": "development",
  "tags": ["web", "api"],
  "services": [
    {
      "name": "app",
      "image": "myapp:latest",
      "port": 3000,
      "environment": {
        "DATABASE_URL": "postgres://{{DB_USER|default:app}}:{{DB_PASS|generate:password:24}}@db:5432/{{DB_NAME|default:myapp}}"
      }
    },
    {
      "name": "db",
      "image": "postgres:16-alpine",
      "port": 5432,
      "volumes": [{ "name": "db-data", "mountPath": "/var/lib/postgresql/data" }],
      "environment": {
        "POSTGRES_USER": "{{DB_USER|default:app}}",
        "POSTGRES_PASSWORD": "{{DB_PASS|generate:password:24}}",
        "POSTGRES_DB": "{{DB_NAME|default:myapp}}"
      }
    }
  ],
  "form": [
    { "key": "DB_USER", "label": "Database User", "type": "text", "default": "app" },
    { "key": "DB_NAME", "label": "Database Name", "type": "text", "default": "myapp" }
  ]
}
```

Add the template to `templates/registry.json` to make it appear in the gallery.
