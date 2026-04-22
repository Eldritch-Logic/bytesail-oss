---
title: Troubleshooting
description: Common issues and solutions
---

## Pods Not Starting

Check pod status and events:

```bash
kubectl get pods -A
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

Common causes:
- **ImagePullBackOff** — the container image can't be pulled. Check registry access and image name.
- **CrashLoopBackOff** — the container starts and immediately crashes. Check logs for the error.
- **Pending** — not enough resources. Check node capacity with `kubectl describe node`.

## Services Not Reachable

1. Verify the K3s Service exists: `kubectl get svc -n <project-namespace>`
2. Check the Ingress: `kubectl get ingress -n <project-namespace>`
3. Verify Traefik is running: `kubectl get pods -n kube-system | grep traefik`
4. Check DNS resolution from inside the cluster: `kubectl run -it --rm debug --image=alpine -- nslookup <service-name>`

## TLS Certificate Not Issuing

```bash
# Check cert-manager
kubectl get certificates -A
kubectl describe certificate <name> -n <namespace>
kubectl get challenges -A
```

Common causes:
- DNS not pointing to the server
- Port 80 blocked (Let's Encrypt HTTP-01 challenge requires it)
- Using a `.local` or non-public domain

## Logs Not Showing

1. Check Alloy is running: `kubectl get pods -n monitoring | grep alloy`
2. Check Loki is running: `kubectl get pods -n monitoring | grep loki`
3. Verify Alloy has RBAC permissions: `kubectl get clusterrole alloy -o yaml`
4. Check Alloy logs: `kubectl logs -n monitoring deploy/alloy`

## Database Connection Issues

- Services must be in the same project (K8s namespace) to connect by service name
- Check the service name is K8s-compatible (lowercase, no underscores)
- Verify the database pod is running: `kubectl get pods -n <project-namespace>`
- Test connectivity: `kubectl exec -n <namespace> deploy/<app> -- nc -zv <db-service> <port>`

## Dashboard Not Loading

1. Check the ByteSail API pod: `kubectl get pods -n bytesail-system`
2. Check API logs: `kubectl logs -n bytesail-system deploy/bytesail`
3. Verify PostgreSQL is running: `kubectl get pods -n bytesail-system | grep postgres`
4. Check the connection error banner in the dashboard for API connectivity issues

## Resetting Admin Password

If you're locked out, reset via the database:

```bash
kubectl exec -n bytesail-system deploy/postgres -- \
  psql -U bytesail bytesail -c "DELETE FROM session;"
```

Then register a new admin account at the login page.
