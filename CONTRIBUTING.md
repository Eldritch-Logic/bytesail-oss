# Contributing to ByteSail

Thanks for your interest in contributing to ByteSail! This document covers everything you need to get started.

## Development Setup

### Prerequisites

- **Node.js** 20+
- **pnpm** 10+
- **PostgreSQL** 16 (local instance on `localhost:5432`)
- **Docker** (for Testcontainers integration tests)
- **Bun** (for CLI compilation)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/Eldritch-Logic/bytesail.git
cd bytesail

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Push the database schema
pnpm --filter @bytesail/db db:push

# Seed demo data (optional)
pnpm --filter @bytesail/db db:seed

# Start the dev server
pnpm dev
```

The dashboard will be available at `http://localhost:5173`.

### Monorepo Structure

```
apps/
  web/          # SvelteKit dashboard
  cli/          # CLI tool (compiled with Bun)

packages/
  api/          # tRPC router definitions
  auth/         # Better Auth configuration
  db/           # Drizzle ORM schemas + migrations
  core/         # Business logic (K3s, builds, monitoring)
  shared/       # Shared types and constants

docs/           # Astro/Starlight documentation site
deploy/         # Installation and K3s manifests
templates/      # One-click deploy templates
```

### Common Commands

```bash
pnpm dev                               # Start dev server
pnpm build                             # Build all packages
pnpm lint                              # Lint with Biome
pnpm typecheck                         # TypeScript check
pnpm vitest run                        # Run unit + integration tests
npx playwright test                    # Run E2E tests (needs running server)
pnpm --filter @bytesail/db db:generate # Generate migration from schema changes
pnpm --filter @bytesail/db db:push     # Push schema to database
pnpm --filter @bytesail/db db:studio   # Open Drizzle Studio
pnpm --filter @bytesail/docs dev       # Start docs dev server
```

## Pull Request Guidelines

### Before Submitting

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/my-feature main
   ```

2. **Run the full check suite** before pushing:
   ```bash
   pnpm build && pnpm lint && pnpm vitest run
   ```

3. **Keep PRs focused** — one feature or fix per PR. If your change touches multiple areas, consider splitting it.

### PR Format

- **Title**: short, imperative mood (e.g., "Add volume resize support")
- **Description**: explain *what* and *why*, not just *how*
- **Link related issues** if applicable

### Commit Messages

Use conventional commit style:

```
feat: add volume resize support
fix: resolve port detection for MariaDB
docs: update CLI reference with new commands
chore: upgrade Drizzle to v0.45
security: add rate limiting to auth endpoints
perf: lazy-load chart.js on metrics page
```

## Code Style

- **Formatter/Linter**: [Biome](https://biomejs.dev/) — runs automatically via pre-commit hook
- **Language**: TypeScript everywhere (strict mode)
- **Frontend**: Svelte 5 runes (`$state`, `$derived`, `$effect`), shadcn-svelte components, Tailwind CSS 4
- **API**: tRPC v11 with Zod input validation
- **Database**: Drizzle ORM — always generate migrations for schema changes
- **Imports**: Use workspace package aliases (`@bytesail/core`, `@bytesail/db`, etc.)

### Key Conventions

- Use `orgProcedure` for routes that access project/service data (ensures organization context)
- Use `adminProcedure` for settings and system-level mutations
- Keep pure utility functions separate from router files (e.g., `compose-utils.ts`) for testability
- Secrets must be encrypted at rest via `encrypt()`/`decrypt()` from `@bytesail/core/utils/crypto`
- K3s namespace format: `project-<id-prefix>-<slug>`

## Testing

- **Unit tests**: Vitest, colocated in `__tests__/` directories
- **Integration tests**: Vitest + Testcontainers (PostgreSQL)
- **E2E tests**: Playwright (requires running dev server)

Write tests for new utility functions and business logic. Router tests should use the extracted utility modules to avoid database import side effects.

## Need Help?

- Open an issue for bugs or feature requests
- Check existing issues before creating a new one
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)
