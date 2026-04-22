---
title: Git Integration
description: GitHub App setup and auto-deploy
---

ByteSail integrates with GitHub via a GitHub App for repository access, webhooks, and commit status reporting.

## Setting Up the GitHub App

See the [GitHub App Setup](/features/github-app-setup/) guide for step-by-step instructions on creating and installing the app.

Once configured:

1. Go to **Settings > Git** in the dashboard
2. Enter your GitHub App credentials (App ID, private key, webhook secret)
3. Install the app on your GitHub account or organization

## Auto-Deploy

When a GitHub App is configured and a service is connected to a repository:

- **Push to the default branch** triggers an automatic deployment
- **Pull requests** can trigger preview deployments (if enabled)
- **Commit status** is reported back to GitHub (pending, success, failure)

## How It Works

1. GitHub sends a webhook to ByteSail on push events
2. ByteSail verifies the webhook signature
3. If the push matches a connected service's repo and branch, a deployment is triggered
4. The build pipeline clones the repo (using the GitHub App's installation token for private repos), builds with Railpacks, and deploys

## Build Pipeline

ByteSail uses **Railpacks** for zero-config builds:

- Detects language and framework automatically
- Generates an optimized Dockerfile internally
- Builds via BuildKit and pushes to the internal registry
- Falls back to a `Dockerfile` in the repo root if present
