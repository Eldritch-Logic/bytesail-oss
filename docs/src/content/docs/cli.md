---
title: CLI Reference
description: ByteSail CLI commands and usage
---

The ByteSail CLI lets you manage projects, services, and deployments from the terminal.

## Installation

The CLI is compiled as a single binary:

```bash
curl -fsSL https://get.bytesail.dev/cli | bash
```

## Global Options

| Flag | Description |
|------|-------------|
| `--json` | Output in JSON format |
| `--yes` | Skip confirmation prompts |

## Authentication

```bash
# Browser-based login
bytesail login --url https://bytesail.example.com

# Token-based login
bytesail login --token bs_xxx --url https://bytesail.example.com

# Show current user
bytesail whoami

# Logout
bytesail logout
```

## Projects

```bash
bytesail project list                 # List all projects
bytesail project create <name>        # Create a project
bytesail project link [id]            # Link current directory to a project
bytesail project unlink               # Unlink current directory
bytesail project open                 # Open project in browser
bytesail project delete <name>        # Delete a project
```

## Services

```bash
bytesail service list                 # List services in linked project
bytesail service info <name>          # Show service details
bytesail service restart <name>       # Restart a service
bytesail service scale <name> -r 3    # Scale to 3 replicas
bytesail service delete <name>        # Delete a service
```

## Deployments

```bash
bytesail up                           # Deploy (interactive service selection)
bytesail up -s my-service             # Deploy a specific service
bytesail up -s my-service -d          # Deploy and detach
bytesail deploy list                  # List recent deployments
bytesail deploy info <id>             # Show deployment details
bytesail deploy rollback <id>         # Rollback to a deployment
bytesail deploy cancel <id>           # Cancel in-progress deployment
```

## Environment Variables

```bash
bytesail env list -s my-service                    # List variables
bytesail env set KEY=value -s my-service            # Set a variable
bytesail env set SECRET=xxx -s my-service --secret  # Set a secret
bytesail env get KEY -s my-service                  # Get a variable
bytesail env delete KEY -s my-service               # Delete a variable
```

## Logs

```bash
bytesail logs -s my-service           # Stream logs
bytesail logs -s my-service -t 200    # Last 200 lines
bytesail logs -s my-service --no-follow  # No streaming
```

## Domains

```bash
bytesail domain list -s my-service            # List domains
bytesail domain add app.example.com -s my-svc # Add a domain
bytesail domain remove app.example.com -s svc # Remove a domain
```

## Databases

```bash
bytesail db add                       # Add a database (interactive)
bytesail db list                      # List databases
bytesail db connect <name>            # Get connection URL
```

## Docker Compose

```bash
bytesail compose up                   # Deploy compose stack
bytesail compose up -f custom.yml     # Deploy from custom file
bytesail compose status               # Show stack status
bytesail compose down                 # Stop all services
```

## Other Commands

```bash
bytesail status                       # System and project overview
bytesail open [service]               # Open dashboard in browser
bytesail run <cmd> -s my-service      # Run command with service env vars
bytesail shell <service>              # Shell into a container
bytesail completion bash|zsh|fish     # Generate shell completions
bytesail update check                 # Check for CLI updates
bytesail update apply                 # Apply available update
```
