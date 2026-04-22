---
title: Domains
description: Custom domain and TLS configuration
---

ByteSail uses Traefik as the ingress controller and cert-manager with Let's Encrypt for automatic TLS certificates.

## Adding a Domain

### Dashboard

1. Open your service and go to the **Networking** tab
2. Click **Add Domain**
3. Enter the hostname and port (auto-detected from the service)
4. TLS is enabled by default

### CLI

```bash
bytesail domain add app.example.com -s my-service
bytesail domain add api.example.com -s my-api --no-tls
```

## DNS Configuration

Point your domain to your ByteSail server:

```
app.example.com → A record → <server-ip>
```

For wildcard subdomains:

```
*.example.com → A record → <server-ip>
```

## TLS Certificates

When TLS is enabled, ByteSail creates a Traefik IngressRoute with a cert-manager annotation. Let's Encrypt issues and renews certificates automatically.

:::note
TLS requires a publicly accessible domain. Local domains (e.g., `.local`, `.test`) will not receive certificates.
:::

## Port Mapping

Each domain maps an external hostname to an internal service port. ByteSail auto-detects the port from the service configuration, but you can override it when adding the domain.

## Managing Domains

```bash
# List domains for a service
bytesail domain list -s my-service

# Remove a domain
bytesail domain remove app.example.com -s my-service
```

Removing a domain deletes the corresponding Traefik Ingress resource.
