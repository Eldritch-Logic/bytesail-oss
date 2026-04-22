---
title: GitHub App Setup
description: Configure a GitHub App for repository access and webhooks
---

ByteSail uses a GitHub App for repository access, webhooks, and commit status reporting.

## Create a GitHub App

1. Go to **GitHub Settings > Developer settings > GitHub Apps > New GitHub App**
2. Fill in the following:

| Field | Value |
|-------|-------|
| GitHub App name | `ByteSail (<your-domain>)` |
| Homepage URL | `https://<your-domain>` |
| Callback URL | `https://<your-domain>/api/auth/github/callback` |
| Webhook URL | `https://<your-domain>/api/v1/webhooks/github` |
| Webhook secret | Generate a random secret and save it |

3. Set the following **permissions**:

### Repository permissions

| Permission | Access |
|-----------|--------|
| Contents | Read-only |
| Metadata | Read-only |
| Commit statuses | Read and write |
| Deployments | Read and write |
| Pull requests | Read-only |

### Organization permissions

None required.

### Account permissions

None required.

4. Subscribe to these **events**:
   - Push
   - Pull request
   - Installation

5. Set **Where can this GitHub App be installed?** to "Any account" (or "Only on this account" for private use).

6. Click **Create GitHub App**.

## Configure ByteSail

After creating the app, you'll need three values:

1. **App ID** — shown on the app's settings page
2. **Client ID** and **Client Secret** — under "OAuth credentials" (generate if needed)
3. **Private key** — click "Generate a private key" and download the `.pem` file

Add these to your `.env` file:

```env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=<base64-encoded contents of the .pem file>
GITHUB_CLIENT_ID=Iv1.abc123
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

To base64-encode the private key:

```bash
base64 -w 0 < your-app-name.private-key.pem
```

## Install the App

1. Go to `https://github.com/apps/<your-app-name>/installations/new`
2. Select the account or organization
3. Choose which repositories to grant access to (or all repositories)
4. Click **Install**

ByteSail will receive the installation event via the webhook and store the installation ID automatically.

## Connect in ByteSail

Once the app is installed, go to **Settings > Git** in the ByteSail dashboard and click **Connect GitHub**. This will link your GitHub App installation to your ByteSail account.
