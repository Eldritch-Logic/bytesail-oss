#!/usr/bin/env bash
set -euo pipefail

BYTESAIL_VERSION="${BYTESAIL_VERSION:-latest}"
BYTESAIL_DOMAIN="${BYTESAIL_DOMAIN:-}"
BYTESAIL_UPGRADE="${BYTESAIL_UPGRADE:-false}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="/var/lib/bytesail/backups"

# --- Colors & formatting ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()     { echo -e "${GREEN}  [OK]${NC}    $1"; }
info()    { echo -e "${BLUE}  [..]${NC}    $1"; }
warn()    { echo -e "${YELLOW}  [!!]${NC}    $1"; }
error()   { echo -e "${RED}  [ERR]${NC}   $1" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}── $1${NC}\n"; }
substep() { echo -e "  ${DIM}→${NC} $1"; }

wait_for_pod() {
    local label="$1"
    local namespace="$2"
    local name="$3"
    local timeout="${4:-120}"

    local elapsed=0
    while [[ $elapsed -lt $timeout ]]; do
        local status
        status=$(kubectl get pods -l "$label" -n "$namespace" -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Pending")
        local ready
        ready=$(kubectl get pods -l "$label" -n "$namespace" -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")

        if [[ "$ready" == "True" ]]; then
            log "${name} is ready"
            return 0
        fi

        substep "${name}: ${status}... (${elapsed}s)"
        sleep 5
        elapsed=$((elapsed + 5))
    done

    warn "${name} did not become ready within ${timeout}s"
    return 1
}

# --- Banner ---
print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ____        _       ____        _ _ "
    echo " | __ ) _   _| |_ ___/ ___|  __ _(_) |"
    echo " |  _ \\| | | | __/ _ \\___ \\ / _\` | | |"
    echo " | |_) | |_| | ||  __/___) | (_| | | |"
    echo " |____/ \\__, |\\__\\___|____/ \\__,_|_|_|"
    echo "        |___/                          "
    echo -e "${NC}"
    if [[ "$BYTESAIL_UPGRADE" == "true" ]]; then
        echo -e "  ${DIM}Upgrading to ${BYTESAIL_VERSION}${NC}"
    else
        echo -e "  ${DIM}Self-hosted PaaS installer (${BYTESAIL_VERSION})${NC}"
    fi
    echo ""
}

# --- Interactive prompts ---
prompt_configuration() {
    if [[ "$BYTESAIL_UPGRADE" == "true" ]]; then
        return
    fi

    # Domain
    if [[ -z "$BYTESAIL_DOMAIN" ]]; then
        echo -e "  ${BOLD}Domain Configuration${NC}"
        echo -e "  ${DIM}Enter the domain for your ByteSail instance.${NC}"
        echo -e "  ${DIM}Leave blank to use the server IP address.${NC}"
        echo ""
        read -rp "  Domain (e.g., bytesail.example.com): " BYTESAIL_DOMAIN
        echo ""
    fi
}

# --- System requirements ---
check_requirements() {
    step "Checking system requirements"

    # OS
    if [[ "$(uname -s)" != "Linux" ]]; then
        error "ByteSail requires Linux. Detected: $(uname -s)"
    fi
    substep "OS: Linux $(uname -r)"

    # CPU
    local cpu_cores
    cpu_cores=$(nproc)
    if [[ "$cpu_cores" -lt 2 ]]; then
        error "At least 2 CPU cores required. Detected: $cpu_cores"
    fi
    substep "CPU: ${cpu_cores} cores"

    # RAM
    local mem_kb
    mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local mem_gb=$((mem_kb / 1024 / 1024))
    if [[ "$mem_gb" -lt 3 ]]; then
        error "At least 4 GB RAM required. Detected: ${mem_gb} GB"
    fi
    substep "RAM: ${mem_gb} GB"

    # Disk
    local disk_gb
    disk_gb=$(df / --output=avail -BG | tail -1 | tr -d 'G ')
    if [[ "$disk_gb" -lt 20 ]]; then
        error "At least 20 GB disk space required. Detected: ${disk_gb} GB"
    fi
    substep "Disk: ${disk_gb} GB available"

    # Tools
    for cmd in curl openssl; do
        if ! command -v "$cmd" &>/dev/null; then
            error "Required command not found: $cmd"
        fi
    done

    log "All system requirements met"
}

# --- Pre-upgrade backup ---
backup_before_upgrade() {
    if [[ "$BYTESAIL_UPGRADE" != "true" ]]; then
        return
    fi

    step "Creating pre-upgrade backup"

    mkdir -p "$BACKUP_DIR"
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="${BACKUP_DIR}/pre-upgrade-${timestamp}.sql.gz"

    # Save current image for rollback
    local current_image
    current_image=$(kubectl get deployment bytesail -n bytesail-system -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "unknown")
    echo "$current_image" > "${BACKUP_DIR}/previous-image.txt"
    substep "Current image: ${current_image}"

    # Database backup
    if kubectl get pod -l app=postgres -n bytesail-system -o name &>/dev/null; then
        info "Backing up database..."
        kubectl exec -n bytesail-system deploy/postgres -- \
            pg_dump -U bytesail bytesail 2>/dev/null | gzip > "$backup_file" || {
            warn "Database backup failed, continuing without backup"
            return
        }
        local size
        size=$(du -h "$backup_file" | awk '{print $1}')
        log "Database backed up (${size}) → ${backup_file}"
    else
        warn "PostgreSQL pod not found, skipping database backup"
    fi
}

# --- Rollback on failure ---
rollback() {
    local previous_image_file="${BACKUP_DIR}/previous-image.txt"

    if [[ ! -f "$previous_image_file" ]]; then
        error "No previous image recorded. Restore from backup manually."
    fi

    local previous_image
    previous_image=$(cat "$previous_image_file")

    if [[ "$previous_image" == "unknown" ]]; then
        error "Previous image unknown. Restore from backup manually."
    fi

    warn "Rolling back to: ${previous_image}"
    kubectl set image deployment/bytesail bytesail="$previous_image" -n bytesail-system || {
        error "Rollback failed. Manual intervention required."
    }

    kubectl rollout status deployment/bytesail -n bytesail-system --timeout=120s || {
        error "Rollback did not stabilize."
    }

    log "Rollback completed"
}

# --- Install K3s ---
install_k3s() {
    step "Installing K3s"

    if command -v k3s &>/dev/null; then
        local k3s_version
        k3s_version=$(k3s --version 2>/dev/null | head -1 | awk '{print $3}' || echo "unknown")
        log "K3s already installed (${k3s_version}), skipping"
        return
    fi

    info "Downloading and installing K3s..."
    curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server \
        --cluster-cidr=10.0.0.0/8 \
        --service-cidr=10.255.0.0/16 \
        --cluster-dns=10.255.0.10 \
        --write-kubeconfig-mode=644" sh -

    info "Waiting for K3s API server..."
    local retries=30
    until kubectl get nodes &>/dev/null; do
        retries=$((retries - 1))
        if [[ "$retries" -le 0 ]]; then
            error "K3s failed to start within 60 seconds"
        fi
        sleep 2
    done

    # Wait for node ready
    info "Waiting for node to be ready..."
    kubectl wait --for=condition=ready node --all --timeout=120s 2>/dev/null || true

    local node_name
    node_name=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
    local node_version
    node_version=$(kubectl get nodes -o jsonpath='{.items[0].status.nodeInfo.kubeletVersion}')
    log "Node ${node_name} is ready (${node_version})"

    substep "Cluster CIDR: 10.0.0.0/8"
    substep "Service CIDR: 10.255.0.0/16"
    substep "DNS: 10.255.0.10"
}

# --- Generate secrets ---
generate_secret() {
    openssl rand -base64 "$1" | tr -d '\n/+=' | head -c "$1"
}

# --- Configure instance ---
configure_instance() {
    step "Configuring ByteSail instance"

    kubectl create namespace bytesail-system --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1

    # Only create secrets on fresh install
    if ! kubectl get secret postgres-credentials -n bytesail-system &>/dev/null; then
        local pg_password
        pg_password=$(generate_secret 24)
        local auth_secret
        auth_secret=$(generate_secret 64)
        local encryption_key
        encryption_key=$(generate_secret 32)

        info "Generating cryptographic secrets..."
        substep "Auth secret:    ${auth_secret:0:8}...  (64 chars)"
        substep "Encryption key: ${encryption_key:0:8}...  (32 chars)"
        substep "DB password:    ${pg_password:0:4}...  (24 chars)"

        local dashboard_url="http://localhost"
        if [[ -n "$BYTESAIL_DOMAIN" ]]; then
            dashboard_url="https://${BYTESAIL_DOMAIN}"
        fi

        kubectl create secret generic postgres-credentials \
            --namespace bytesail-system \
            --from-literal=POSTGRES_DB=bytesail \
            --from-literal=POSTGRES_USER=bytesail \
            --from-literal=POSTGRES_PASSWORD="${pg_password}" \
            --dry-run=client -o yaml | kubectl apply -f - >/dev/null

        kubectl create secret generic bytesail-env \
            --namespace bytesail-system \
            --from-literal=DATABASE_URL="postgresql://bytesail:${pg_password}@postgres.bytesail-system:5432/bytesail" \
            --from-literal=BETTER_AUTH_SECRET="${auth_secret}" \
            --from-literal=ENCRYPTION_KEY="${encryption_key}" \
            --from-literal=BYTESAIL_VERSION="${BYTESAIL_VERSION}" \
            --from-literal=DASHBOARD_URL="${dashboard_url}" \
            --from-literal=BASE_DOMAIN="${BYTESAIL_DOMAIN}" \
            --from-literal=BETTER_AUTH_URL="${dashboard_url}" \
            --from-literal=REGISTRY_URL="registry.bytesail-system.svc.cluster.local:5000" \
            --dry-run=client -o yaml | kubectl apply -f - >/dev/null

        log "Secrets generated and stored"
    else
        log "Existing secrets preserved"
        if [[ "$BYTESAIL_UPGRADE" == "true" ]]; then
            kubectl patch secret bytesail-env -n bytesail-system \
                --type='json' \
                -p="[{\"op\":\"replace\",\"path\":\"/data/BYTESAIL_VERSION\",\"value\":\"$(echo -n "$BYTESAIL_VERSION" | base64)\"}]" 2>/dev/null || true
            substep "Version updated to ${BYTESAIL_VERSION}"
        fi
    fi
}

# --- Deploy PostgreSQL ---
deploy_postgres() {
    step "Deploying PostgreSQL"

    kubectl apply -f "${SCRIPT_DIR}/k3s/postgres.yaml" >/dev/null
    info "PostgreSQL StatefulSet applied"

    wait_for_pod "app=postgres" "bytesail-system" "PostgreSQL" 120

    local pg_version
    pg_version=$(kubectl exec -n bytesail-system deploy/postgres -- postgres --version 2>/dev/null | head -1 || echo "")
    if [[ -n "$pg_version" ]]; then
        substep "${pg_version}"
    fi
}

# --- Deploy container registry ---
deploy_registry() {
    step "Deploying container registry"

    kubectl apply -f "${SCRIPT_DIR}/k3s/registry.yaml" >/dev/null
    info "Registry deployment applied"

    wait_for_pod "app=registry" "bytesail-system" "Container registry" 60

    substep "Registry available at localhost:30500 (NodePort)"

    # Configure K3s to use the internal registry
    if [[ -f "${SCRIPT_DIR}/k3s/registries.yaml" ]]; then
        if [[ ! -f /etc/rancher/k3s/registries.yaml ]]; then
            cp "${SCRIPT_DIR}/k3s/registries.yaml" /etc/rancher/k3s/registries.yaml 2>/dev/null || true
            systemctl restart k3s 2>/dev/null || true
            substep "K3s registry mirror configured"
        fi
    fi
}

# --- Deploy ByteSail ---
deploy_bytesail() {
    step "Deploying ByteSail"

    # Apply manifest (with version substitution if needed)
    if [[ "$BYTESAIL_VERSION" != "latest" ]]; then
        sed "s|ghcr.io/eldritch-logic/bytesail:latest|ghcr.io/eldritch-logic/bytesail:${BYTESAIL_VERSION}|g" \
            "${SCRIPT_DIR}/k3s/bytesail.yaml" | kubectl apply -f - >/dev/null
    else
        kubectl apply -f "${SCRIPT_DIR}/k3s/bytesail.yaml" >/dev/null
    fi

    # Create domain-specific Ingress with TLS if domain is configured
    if [[ -n "$BYTESAIL_DOMAIN" ]]; then
        info "Configuring Ingress for ${BYTESAIL_DOMAIN}..."
        kubectl apply -f - >/dev/null <<INGRESS_EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bytesail-domain
  namespace: bytesail-system
  labels:
    app: bytesail
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  rules:
    - host: ${BYTESAIL_DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: bytesail
                port:
                  number: 80
  tls:
    - hosts:
        - ${BYTESAIL_DOMAIN}
      secretName: tls-bytesail-domain
INGRESS_EOF
        substep "TLS certificate will be issued by Let's Encrypt"
    fi

    # Monitor init container (database migration)
    info "Running database migrations (init container)..."
    local elapsed=0
    while [[ $elapsed -lt 120 ]]; do
        local init_ready
        init_ready=$(kubectl get pods -l app=bytesail -n bytesail-system -o jsonpath='{.items[0].status.initContainerStatuses[0].state.terminated.exitCode}' 2>/dev/null || echo "")

        if [[ "$init_ready" == "0" ]]; then
            log "Database migrations completed successfully"
            break
        elif [[ -n "$init_ready" && "$init_ready" != "0" ]]; then
            warn "Migration failed (exit ${init_ready}). Logs:"
            kubectl logs -n bytesail-system -l app=bytesail -c migrate --tail=10 2>/dev/null || true
            error "Database migration failed. Fix the issue and re-run the installer."
        fi

        substep "Migrations running... (${elapsed}s)"
        sleep 5
        elapsed=$((elapsed + 5))
    done

    # Wait for main application
    info "Starting ByteSail application..."
    if ! kubectl rollout status deployment/bytesail -n bytesail-system --timeout=180s 2>/dev/null; then
        warn "ByteSail did not start in time. Recent events:"
        kubectl get events -n bytesail-system --sort-by='.lastTimestamp' 2>/dev/null | tail -10 || true
        echo ""
        warn "Pod logs:"
        kubectl logs -n bytesail-system -l app=bytesail --tail=20 2>/dev/null || true

        if [[ "$BYTESAIL_UPGRADE" == "true" ]]; then
            echo ""
            warn "Initiating automatic rollback..."
            rollback
            error "Upgrade failed and was rolled back."
        else
            error "ByteSail failed to start. Run: kubectl logs -n bytesail-system deploy/bytesail"
        fi
    fi

    log "ByteSail is running"
}

# --- Install cert-manager ---
install_cert_manager() {
    step "Installing cert-manager"

    if kubectl get namespace cert-manager &>/dev/null; then
        log "cert-manager already installed, skipping"
        return
    fi

    info "Applying cert-manager manifests..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml >/dev/null 2>&1

    info "Waiting for cert-manager pods..."
    wait_for_pod "app.kubernetes.io/component=controller" "cert-manager" "cert-manager controller" 120
    wait_for_pod "app.kubernetes.io/component=webhook" "cert-manager" "cert-manager webhook" 120

    info "Applying Let's Encrypt cluster issuer..."
    kubectl apply -f "${SCRIPT_DIR}/k3s/cert-manager/cluster-issuer.yaml" >/dev/null
    log "cert-manager ready with Let's Encrypt"
}

# --- Install observability stack ---
install_observability() {
    step "Deploying observability stack"

    kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1

    local components=(
        "loki:Loki (log aggregation)"
        "node-exporter:Node Exporter (host metrics)"
        "kube-state-metrics:kube-state-metrics (K8s object metrics)"
        "alertmanager:Alertmanager (alert routing)"
        "prometheus:Prometheus (metrics collection)"
        "alloy:Alloy (log collection agent)"
        "grafana:Grafana (dashboards)"
    )

    for entry in "${components[@]}"; do
        local file="${entry%%:*}"
        local name="${entry#*:}"
        info "Deploying ${name}..."
        kubectl apply -f "${SCRIPT_DIR}/k3s/observability/${file}.yaml" >/dev/null 2>&1
    done

    echo ""
    info "Waiting for core observability pods..."
    wait_for_pod "app=loki" "observability" "Loki" 120
    wait_for_pod "app=prometheus" "observability" "Prometheus" 120
    wait_for_pod "app=grafana" "observability" "Grafana" 120

    log "Observability stack deployed (7 components)"
}

# --- Show cluster status ---
show_cluster_status() {
    step "Cluster status"

    echo -e "  ${BOLD}Nodes${NC}"
    kubectl get nodes -o wide --no-headers 2>/dev/null | while IFS= read -r line; do
        substep "$line"
    done

    echo ""
    echo -e "  ${BOLD}ByteSail pods${NC}"
    kubectl get pods -n bytesail-system --no-headers 2>/dev/null | while IFS= read -r line; do
        local status
        status=$(echo "$line" | awk '{print $3}')
        local color="$GREEN"
        [[ "$status" != "Running" ]] && color="$YELLOW"
        echo -e "  ${color}●${NC} ${line}"
    done

    echo ""
    echo -e "  ${BOLD}Observability pods${NC}"
    kubectl get pods -n observability --no-headers 2>/dev/null | while IFS= read -r line; do
        local status
        status=$(echo "$line" | awk '{print $3}')
        local color="$GREEN"
        [[ "$status" != "Running" ]] && color="$YELLOW"
        echo -e "  ${color}●${NC} ${line}"
    done
}

# --- Print access info ---
print_info() {
    local node_ip
    node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}' 2>/dev/null || true)
    if [[ -z "$node_ip" ]]; then
        node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "localhost")
    fi

    local access_url="http://${node_ip}"
    local grafana_url="http://${node_ip}/grafana"
    if [[ -n "$BYTESAIL_DOMAIN" ]]; then
        access_url="https://${BYTESAIL_DOMAIN}"
        grafana_url="https://${BYTESAIL_DOMAIN}/grafana"
    fi

    echo ""
    echo -e "${BOLD}${GREEN}"
    echo "  ╔══════════════════════════════════════════╗"
    if [[ "$BYTESAIL_UPGRADE" == "true" ]]; then
        echo "  ║       ByteSail upgrade complete!         ║"
    else
        echo "  ║     ByteSail installation complete!      ║"
    fi
    echo "  ╚══════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "  ${BOLD}Dashboard${NC}   ${access_url}"
    echo -e "  ${BOLD}Grafana${NC}     ${grafana_url}"
    echo -e "  ${BOLD}Server IP${NC}   ${node_ip}"
    echo ""
    echo -e "  ${DIM}Grafana login: admin / bytesail${NC}"
    echo ""

    if [[ -n "$BYTESAIL_DOMAIN" ]]; then
        echo -e "  ${BOLD}DNS Setup${NC}"
        echo -e "  Point your domain to this server:"
        echo -e "    ${CYAN}${BYTESAIL_DOMAIN}${NC}    →  A record  →  ${node_ip}"
        echo -e "    ${CYAN}*.${BYTESAIL_DOMAIN}${NC}  →  A record  →  ${node_ip}  ${DIM}(for service subdomains)${NC}"
        echo ""
    fi

    echo -e "  ${BOLD}Next steps${NC}"
    echo -e "  1. Open the dashboard and create your admin account"
    echo -e "  2. Create a project and deploy your first service"
    echo -e "  3. Connect a GitHub repo for auto-deploy on push"
    echo ""
    echo -e "  ${DIM}Docs:   https://github.com/Eldritch-Logic/bytesail/tree/main/docs${NC}"
    echo -e "  ${DIM}Issues: https://github.com/Eldritch-Logic/bytesail/issues${NC}"
    echo ""
}

# --- Main ---
main() {
    print_banner

    if [[ "$BYTESAIL_UPGRADE" != "true" ]]; then
        prompt_configuration
    fi

    check_requirements
    backup_before_upgrade
    install_k3s
    install_cert_manager
    configure_instance
    deploy_postgres
    deploy_registry
    deploy_bytesail
    install_observability
    show_cluster_status
    print_info
}

main "$@"
