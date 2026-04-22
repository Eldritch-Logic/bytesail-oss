import type { DeployStatus, ServiceStatus } from "./types.js";

export const STATUS_COLORS: Record<ServiceStatus, string> = {
	running: "#22c55e",
	building: "#f59e0b",
	deploying: "#3b82f6",
	failed: "#ef4444",
	stopped: "#6b7280",
	queued: "#3b82f6",
};

export const DEPLOY_STATUS_COLORS: Record<DeployStatus, string> = {
	queued: "#3b82f6",
	building: "#f59e0b",
	pushing: "#f59e0b",
	deploying: "#3b82f6",
	running: "#22c55e",
	failed: "#ef4444",
	cancelled: "#6b7280",
	rolled_back: "#6b7280",
};

export const DEFAULTS = {
	replicas: 1,
	healthCheckInterval: 30,
	cpuRequest: "100m",
	memoryRequest: "128Mi",
	cpuLimit: "500m",
	memoryLimit: "512Mi",
	volumeSizeGb: 1,
	backupRetentionDays: 7,
	sessionExpiresIn: 60 * 60 * 24 * 30,
} as const;

export const LIMITS = {
	maxReplicas: 10,
	maxVolumeSizeGb: 100,
	maxProjectsPerOrg: 50,
	maxServicesPerProject: 20,
	maxVariablesPerService: 200,
	maxDomainsPerService: 10,
	maxVolumesPerService: 5,
	apiKeyRateLimitWindow: 60,
	apiKeyRateLimitMax: 100,
} as const;
