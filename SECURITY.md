# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ByteSail, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email **security@eldritchlogic.com** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

We will acknowledge your report within **48 hours** and aim to provide a fix within **7 days** for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Previous minor | Security fixes only |
| Older versions | No |

## Security Measures

ByteSail implements the following security controls:

- **Authentication**: Better Auth with session cookies and API key support
- **Authorization**: Role-based access (owner, admin, member) via tRPC middleware chain
- **Encryption**: AES-256-GCM for secrets at rest
- **Webhook verification**: HMAC-SHA256 signature validation for GitHub webhooks
- **Rate limiting**: 5 login attempts/min, 100 API requests/min
- **CSRF protection**: SameSite cookies and trusted origin validation
- **Audit logging**: All mutations recorded with user, IP, and user agent

## Scope

The following are in scope for security reports:

- Authentication and authorization bypasses
- Secret leakage in API responses or logs
- SQL injection, XSS, or CSRF vulnerabilities
- Privilege escalation
- Insecure default configurations
- Container escape or K8s privilege issues

Out of scope:

- Denial of service (unless trivially exploitable)
- Issues in third-party dependencies (report upstream)
- Social engineering
- Physical access attacks
