import { broadcast } from "./ws.js";

export const channels = {
	deploymentStatus: (id: string) => `deployment:status:${id}`,
	deploymentLogs: (id: string) => `deployment:logs:${id}`,
	serviceLogs: (id: string) => `service:logs:${id}`,
	serviceStatus: (id: string) => `service:status:${id}`,
	systemUpdate: "system:update",
} as const;

export type DeploymentStatusEvent = {
	deploymentId: string;
	status: string;
	version?: number;
	error?: string;
};

export type DeploymentLogEvent = {
	deploymentId: string;
	line: string;
	timestamp: string;
};

export type ServiceLogEvent = {
	serviceId: string;
	line: string;
	timestamp: string;
	pod?: string;
	level?: string;
};

export type ServiceStatusEvent = {
	serviceId: string;
	status: string;
	replicas?: number;
	readyReplicas?: number;
};

export function emitDeploymentStatus(deploymentId: string, event: DeploymentStatusEvent) {
	broadcast(channels.deploymentStatus(deploymentId), {
		type: "deployment:status",
		...event,
	});
}

export function emitDeploymentLog(deploymentId: string, line: string) {
	broadcast(channels.deploymentLogs(deploymentId), {
		type: "deployment:log",
		deploymentId,
		line,
		timestamp: new Date().toISOString(),
	});
}

export function emitServiceLog(serviceId: string, line: string, pod?: string, level?: string) {
	broadcast(channels.serviceLogs(serviceId), {
		type: "service:log",
		serviceId,
		line,
		pod,
		level,
		timestamp: new Date().toISOString(),
	});
}

export function emitServiceStatus(serviceId: string, event: ServiceStatusEvent) {
	broadcast(channels.serviceStatus(serviceId), {
		type: "service:status",
		...event,
	});
}
