# ByteSail

A self-hosted Platform-as-a-Service (PaaS) that gives you a Railway/Heroku-like deployment experience on your own infrastructure.

- **Git push to deploy** — connect a GitHub repo and deploy on every push
- **Zero-config builds** — Railpacks auto-detects your language and framework
- **Docker Compose support** — deploy multi-service stacks from compose files
- **Managed databases** — one-click PostgreSQL, MySQL, Redis, MongoDB
- **Observability** — built-in logs, metrics, and alerts
- **Visual project canvas** — Railway-style topology view of your services
- **CLI** — manage your entire instance from the terminal
- **Auto-updates** — new releases are detected and applied with zero downtime

## Tech Stack

| Layer          | Technology                                   |
| -------------- | -------------------------------------------- |
| Frontend       | SvelteKit 2, shadcn-svelte, Tailwind CSS 4   |
| API            | tRPC v11, WebSocket                          |
| Auth           | Better Auth                                  |
| Database       | PostgreSQL 16, Drizzle ORM                   |
| Orchestration  | K3s, Traefik, Longhorn                       |
| Image Building | Railpacks (BuildKit-native)                  |
| CLI            | TypeScript + Commander.js, compiled with Bun |
| Observability  | Grafana Loki, Prometheus, Alloy, Grafana     |

## Project Structure

```
apps/
  web/              # SvelteKit dashboard (port 5173)
  cli/              # CLI tool (compiled to single binary with Bun)

packages/
  api/              # tRPC v11 router definitions (shared between web + CLI)
  auth/             # Better Auth server + SvelteKit client
  db/               # Drizzle ORM schemas, migrations, and seed
  core/             # Business logic (K3s client, build pipeline, monitoring)
  shared/           # Shared types, constants, and error classes

docs/               # Astro/Starlight documentation site
deploy/
  install.sh        # Production install script
  k3s/              # Kubernetes manifests
    postgres.yaml         # PostgreSQL deployment + PVC
    registry.yaml         # Internal OCI container registry
    bytesail.yaml         # ByteSail API + dashboard
    update-checker.yaml   # Hourly update check CronJob
    buildkit-cache.yaml   # Builder cache PVC
    registries.yaml       # K3s registry mirrors config
    cert-manager/         # Let's Encrypt ClusterIssuer
    observability/        # Full monitoring stack (see below)

templates/          # One-click deploy templates (20+ apps)
```

---

## Local Development Setup

This guide gets you from zero to a fully working ByteSail development environment with K3s, the observability stack, and the dashboard.

### Prerequisites

| Tool                                      | Version | Purpose                            |
| ----------------------------------------- | ------- | ---------------------------------- |
| [Node.js](https://nodejs.org/)            | >= 20   | Runtime                            |
| [pnpm](https://pnpm.io/)                  | >= 10   | Package manager                    |
| [PostgreSQL](https://www.postgresql.org/) | 16      | Metadata database                  |
| [Docker](https://www.docker.com/)         | Latest  | Container runtime (for K3s, tests) |
| [Bun](https://bun.sh/)                    | Latest  | CLI compilation (optional)         |

### Step 1: Clone and Install

```bash
git clone https://github.com/Eldritch-Logic/bytesail-oss.git
cd bytesail
pnpm install
```

### Step 2: Set Up PostgreSQL

**Option A** — Docker (recommended for dev):

```bash
docker run -d --name bytesail-postgres \
  -e POSTGRES_DB=bytesail \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 5432:5432 \
  postgres:16-alpine
```

**Option B** — Existing PostgreSQL:

```bash
createdb bytesail
```

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Generate real secrets for the required fields:

```bash
# Generate BETTER_AUTH_SECRET (64 chars)
openssl rand -base64 48 | tr -d '\n/+=' | head -c 64

# Generate ENCRYPTION_KEY (exactly 32 chars)
openssl rand -base64 24 | tr -d '\n/+=' | head -c 32
```

Paste the generated values into `.env`:

```env
# Database
DATABASE_URL=postgresql://postgres@localhost:5432/bytesail

# Auth (paste your generated values)
BETTER_AUTH_SECRET=<your-64-char-secret>
ENCRYPTION_KEY=<your-32-char-key>
BETTER_AUTH_URL=http://localhost:5173

# GitHub OAuth (optional — only needed for GitHub login + repo access)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Dashboard
DASHBOARD_URL=http://localhost:5173
BYTESAIL_VERSION=dev
```

| Variable               | Required | Description                                      |
| ---------------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`         | Yes      | PostgreSQL connection string                     |
| `BETTER_AUTH_SECRET`   | Yes      | 64-char random string for session signing        |
| `ENCRYPTION_KEY`       | Yes      | Exactly 32 characters for AES-256-GCM encryption |
| `BETTER_AUTH_URL`      | Yes      | Base URL for auth callbacks                      |
| `GITHUB_CLIENT_ID`     | No       | GitHub OAuth app client ID                       |
| `GITHUB_CLIENT_SECRET` | No       | GitHub OAuth app client secret                   |
| `DASHBOARD_URL`        | No       | Used for CORS trusted origins                    |
| `BYTESAIL_VERSION`     | No       | Set automatically in production                  |

### Step 4: Push Database Schema

```bash
pnpm --filter @bytesail/db db:push
```

This creates all tables in your local PostgreSQL. Optionally seed demo data:

```bash
pnpm --filter @bytesail/db db:seed
```

### Step 5: Start the Dashboard

```bash
pnpm dev
```

Open **http://localhost:5173**. On first visit you'll be redirected to create an admin account.

At this point you have a working dashboard for UI development. The steps below set up K3s for testing actual deployments.

---

## Setting Up K3s (Local Cluster)

To test deployments, builds, and the full orchestration pipeline, you need a local K3s cluster.

### Install K3s

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server \
    --cluster-cidr=10.0.0.0/8 \
    --service-cidr=10.255.0.0/16 \
    --cluster-dns=10.255.0.10 \
    --write-kubeconfig-mode=644" sh -
```

**Important flags:**

- `--cluster-cidr=10.0.0.0/8` — large pod CIDR so each project namespace has plenty of IPs
- `--service-cidr=10.255.0.0/16` — service IP range
- `--cluster-dns=10.255.0.10` — DNS for in-cluster resolution
- `--write-kubeconfig-mode=644` — makes kubeconfig readable without sudo

### Verify K3s

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

You should see one node in `Ready` state.

### Set Up the ByteSail Namespace

```bash
kubectl create namespace bytesail-system
```

### Deploy PostgreSQL to K3s (optional)

If you want ByteSail's metadata DB running in K3s (like production) instead of your local Docker:

```bash
kubectl apply -f deploy/k3s/postgres.yaml
```

### Deploy the Container Registry

ByteSail pushes built images to an internal registry:

```bash
kubectl apply -f deploy/k3s/registry.yaml
```

The registry runs on port 30500 (NodePort). Configure K3s to trust it:

```bash
sudo mkdir -p /etc/rancher/k3s
sudo cp deploy/k3s/registries.yaml /etc/rancher/k3s/registries.yaml
sudo systemctl restart k3s
```

---

## Deploying the Observability Stack

The monitoring stack gives you logs, metrics, and dashboards locally — the same setup as production.

### Deploy All Components

```bash
# Create the namespace
kubectl create namespace observability

# Deploy in order
kubectl apply -f deploy/k3s/observability/loki.yaml
kubectl apply -f deploy/k3s/observability/node-exporter.yaml
kubectl apply -f deploy/k3s/observability/kube-state-metrics.yaml
kubectl apply -f deploy/k3s/observability/alertmanager.yaml
kubectl apply -f deploy/k3s/observability/prometheus.yaml
kubectl apply -f deploy/k3s/observability/alloy.yaml
kubectl apply -f deploy/k3s/observability/grafana.yaml
```

### Verify Everything Is Running

```bash
kubectl get pods -n observability
```

All pods should reach `Running` within a few minutes. If any are stuck in `CrashLoopBackOff`, check logs:

```bash
kubectl logs -n observability deploy/<name>
```

### Port-Forward Grafana (optional)

To access Grafana dashboards locally:

```bash
kubectl port-forward -n observability svc/grafana 3001:3000
```

Open **http://localhost:3001** — login with `admin` / `bytesail`.

### Port-Forward Loki (for log viewer)

The dashboard queries Loki for service logs. Forward it so the dev server can reach it:

```bash
kubectl port-forward -n observability svc/loki 3100:3100
```

### Port-Forward Prometheus (for metrics)

```bash
kubectl port-forward -n observability svc/prometheus 9090:9090
```

### All Port-Forwards in One Command

For convenience, run all of them in the background:

```bash
kubectl port-forward -n observability svc/loki 3100:3100 &
kubectl port-forward -n observability svc/prometheus 9090:9090 &
kubectl port-forward -n observability svc/grafana 3001:3000 &
```

---

## Setting Up cert-manager (optional)

Only needed if you want to test TLS certificate issuance with real domains:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s
kubectl apply -f deploy/k3s/cert-manager/cluster-issuer.yaml
```

> **Note:** Let's Encrypt HTTP-01 challenges require a publicly accessible domain. For local development, TLS won't work with `.local` or `localhost` domains.

---

## Testing Custom Domains Locally

For testing domain routing without real DNS:

1. Add entries to `/etc/hosts`:

   ```
   127.0.0.1  myapp.bytesail.local
   127.0.0.1  api.bytesail.local
   ```

2. Add domains via the dashboard or CLI — they'll route through Traefik to your services.

3. Access via `http://myapp.bytesail.local` (no TLS for `.local` domains).

---

## Database Tools

```bash
pnpm --filter @bytesail/db db:push      # Push schema changes to database
pnpm --filter @bytesail/db db:migrate   # Run migrations
pnpm --filter @bytesail/db db:generate  # Generate migration from schema diff
pnpm --filter @bytesail/db db:seed      # Seed demo data
pnpm --filter @bytesail/db db:studio    # Open Drizzle Studio (visual DB explorer)
```

**Drizzle Studio** opens at https://local.drizzle.studio and lets you browse tables, run queries, and edit data.

---

## Running Tests

```bash
# Unit + integration tests (Vitest)
pnpm vitest run

# Integration tests only (requires Docker for Testcontainers)
pnpm vitest run packages/db/src/__tests__/integration.test.ts --hookTimeout=120000

# E2E tests (requires running dev server)
npx playwright test

# Lint
pnpm lint

# Type check
pnpm typecheck
```

---

## CLI Development

The CLI is in `apps/cli/` and uses Commander.js:

```bash
# Run CLI commands in dev mode
bun run apps/cli/src/index.ts --help
bun run apps/cli/src/index.ts login --url http://localhost:5173
bun run apps/cli/src/index.ts project list

# Compile to single binary
pnpm --filter @bytesail/cli build
./apps/cli/bytesail --version
```

---

## Docs Site

The documentation site uses Astro + Starlight:

```bash
pnpm --filter @bytesail/docs dev       # Start docs dev server (port 4321)
pnpm --filter @bytesail/docs build     # Build static docs site
```

---

## All Commands

```bash
# Development
pnpm dev                              # Start dashboard dev server
pnpm build                            # Build all packages and apps
pnpm lint                             # Lint with Biome
pnpm typecheck                        # TypeScript type checking

# Database
pnpm --filter @bytesail/db db:push    # Push schema to database
pnpm --filter @bytesail/db db:migrate # Run database migrations
pnpm --filter @bytesail/db db:generate # Generate migration from schema changes
pnpm --filter @bytesail/db db:studio  # Open Drizzle Studio
pnpm --filter @bytesail/db db:seed    # Seed demo data

# Testing
pnpm vitest run                       # Run all tests
npx playwright test                   # Run E2E tests

# Individual packages
pnpm --filter @bytesail/web dev       # Start only the web dashboard
pnpm --filter @bytesail/web build     # Build only the web dashboard
pnpm --filter @bytesail/cli build     # Compile CLI binary
pnpm --filter @bytesail/docs dev      # Start docs dev server
```

---

## Production Deployment

Install ByteSail on any Linux server (2+ cores, 4+ GB RAM, 20+ GB disk):

```bash
curl -fsSL https://raw.githubusercontent.com/Eldritch-Logic/bytesail/main/deploy/install.sh | bash
```

With pre-configured settings:

```bash
curl -fsSL https://raw.githubusercontent.com/Eldritch-Logic/bytesail/main/deploy/install.sh | \
  BYTESAIL_DOMAIN=bytesail.example.com \
  BYTESAIL_ADMIN_EMAIL=admin@example.com \
  bash
```

The installer handles everything: K3s, PostgreSQL, container registry, cert-manager, observability stack, and the ByteSail application.

### Upgrading

```bash
curl -fsSL https://raw.githubusercontent.com/Eldritch-Logic/bytesail/main/deploy/install.sh | \
  BYTESAIL_UPGRADE=true \
  BYTESAIL_VERSION=v1.1.0 \
  bash
```

Upgrades create a database backup, perform a rolling update, and automatically rollback if the new version fails to start.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, PR process, and code style.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

[MIT](LICENSE)
