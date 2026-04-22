import { describe, expect, it } from "vitest";
import { generateDeploymentManifest } from "../deployments.js";
import { generateIngressManifest } from "../ingress.js";
import { projectNamespace } from "../namespaces.js";
import { generateServiceManifest } from "../services.js";

describe("projectNamespace", () => {
	it("generates namespace from project id and slug", () => {
		expect(projectNamespace("abc123-def-456", "my-project")).toBe("project-abc123-my-project");
	});

	it("uses first segment of id as prefix", () => {
		expect(projectNamespace("deadbeef-1234-5678-9abc-def012345678", "app")).toBe(
			"project-deadbeef-app",
		);
	});
});

describe("generateServiceManifest", () => {
	it("generates a ClusterIP service", () => {
		const manifest = generateServiceManifest({
			slug: "web",
			projectId: "abc-123",
			projectSlug: "my-app",
			port: 8080,
		});

		expect(manifest.kind).toBe("Service");
		expect(manifest.metadata?.name).toBe("web");
		expect(manifest.metadata?.namespace).toBe("project-abc-my-app");
		expect(manifest.spec?.type).toBe("ClusterIP");
		expect(manifest.spec?.ports?.[0].port).toBe(8080);
		expect(manifest.spec?.selector?.["bytesail.io/service"]).toBe("web");
	});

	it("defaults to port 3000", () => {
		const manifest = generateServiceManifest({
			slug: "api",
			projectId: "abc-123",
			projectSlug: "app",
		});
		expect(manifest.spec?.ports?.[0].port).toBe(3000);
	});

	it("includes bytesail labels", () => {
		const manifest = generateServiceManifest({
			slug: "web",
			projectId: "abc-123",
			projectSlug: "my-app",
		});
		expect(manifest.metadata?.labels?.["app.kubernetes.io/managed-by"]).toBe("bytesail");
		expect(manifest.metadata?.labels?.["bytesail.io/service"]).toBe("web");
	});
});

describe("generateDeploymentManifest", () => {
	const baseService = {
		slug: "web",
		projectId: "abc-123",
		projectSlug: "my-app",
		replicas: 2,
		port: 3000,
	};

	const baseDeployment = {
		id: "deploy-1",
		imageTag: "registry.local/web:v1",
		environmentSlug: "production",
	};

	it("generates a Deployment with correct metadata", () => {
		const manifest = generateDeploymentManifest(baseService, baseDeployment);

		expect(manifest.kind).toBe("Deployment");
		expect(manifest.metadata?.name).toBe("web-production");
		expect(manifest.metadata?.namespace).toBe("project-abc-my-app");
	});

	it("sets replicas", () => {
		const manifest = generateDeploymentManifest(baseService, baseDeployment);
		expect(manifest.spec?.replicas).toBe(2);
	});

	it("sets the container image", () => {
		const manifest = generateDeploymentManifest(baseService, baseDeployment);
		const container = manifest.spec?.template?.spec?.containers?.[0];
		expect(container?.image).toBe("registry.local/web:v1");
	});

	it("sets container port", () => {
		const manifest = generateDeploymentManifest(baseService, baseDeployment);
		const container = manifest.spec?.template?.spec?.containers?.[0];
		expect(container?.ports?.[0].containerPort).toBe(3000);
	});

	it("adds envFrom with secret ref", () => {
		const manifest = generateDeploymentManifest(baseService, baseDeployment);
		const container = manifest.spec?.template?.spec?.containers?.[0];
		expect(container?.envFrom?.[0].secretRef?.name).toBe("web-env");
	});

	it("adds health check probes when configured", () => {
		const manifest = generateDeploymentManifest(
			{
				...baseService,
				healthCheckPath: "/health",
				healthCheckPort: 3000,
				healthCheckInterval: 15,
			},
			baseDeployment,
		);
		const container = manifest.spec?.template?.spec?.containers?.[0];
		expect(container?.livenessProbe?.httpGet?.path).toBe("/health");
		expect(container?.readinessProbe?.httpGet?.path).toBe("/health");
	});

	it("omits probes when no health check configured", () => {
		const manifest = generateDeploymentManifest(baseService, baseDeployment);
		const container = manifest.spec?.template?.spec?.containers?.[0];
		expect(container?.livenessProbe).toBeUndefined();
	});

	it("adds resource limits when configured", () => {
		const manifest = generateDeploymentManifest(
			{ ...baseService, cpuLimit: "500m", memoryLimit: "256Mi" },
			baseDeployment,
		);
		const container = manifest.spec?.template?.spec?.containers?.[0];
		expect(container?.resources?.limits?.cpu).toBe("500m");
		expect(container?.resources?.limits?.memory).toBe("256Mi");
	});

	it("adds volume mounts when configured", () => {
		const manifest = generateDeploymentManifest(
			{ ...baseService, volumeMounts: [{ name: "data", mountPath: "/data" }] },
			baseDeployment,
		);
		const container = manifest.spec?.template?.spec?.containers?.[0];
		expect(container?.volumeMounts?.[0].name).toBe("data");
		expect(container?.volumeMounts?.[0].mountPath).toBe("/data");
		expect(manifest.spec?.template?.spec?.volumes?.[0].persistentVolumeClaim?.claimName).toBe(
			"data",
		);
	});
});

describe("generateIngressManifest", () => {
	it("generates an Ingress with hostname", () => {
		const manifest = generateIngressManifest({
			hostname: "app.example.com",
			serviceSlug: "web",
			namespace: "project-abc-my-app",
			port: 3000,
			path: "/",
			tlsEnabled: false,
		});

		expect(manifest.kind).toBe("Ingress");
		expect(manifest.spec?.rules?.[0].host).toBe("app.example.com");
		expect(manifest.spec?.rules?.[0].http?.paths?.[0].backend?.service?.name).toBe("web");
		expect(manifest.spec?.rules?.[0].http?.paths?.[0].backend?.service?.port?.number).toBe(3000);
	});

	it("adds TLS config when enabled", () => {
		const manifest = generateIngressManifest({
			hostname: "app.example.com",
			serviceSlug: "web",
			namespace: "ns",
			port: 3000,
			path: "/",
			tlsEnabled: true,
		});

		expect(manifest.metadata?.annotations?.["cert-manager.io/cluster-issuer"]).toBe(
			"letsencrypt-prod",
		);
		expect(manifest.spec?.tls?.[0].hosts).toContain("app.example.com");
	});

	it("omits TLS when disabled", () => {
		const manifest = generateIngressManifest({
			hostname: "app.example.com",
			serviceSlug: "web",
			namespace: "ns",
			port: 3000,
			path: "/",
			tlsEnabled: false,
		});

		expect(manifest.spec?.tls).toBeUndefined();
	});

	it("sanitizes hostname for ingress name", () => {
		const manifest = generateIngressManifest({
			hostname: "my.app.example.com",
			serviceSlug: "web",
			namespace: "ns",
			port: 3000,
			path: "/",
			tlsEnabled: false,
		});

		expect(manifest.metadata?.name).toBe("web-my-app-example-com");
	});
});
