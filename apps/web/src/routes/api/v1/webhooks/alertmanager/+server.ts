import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";

type AlertmanagerAlert = {
	status: "firing" | "resolved";
	labels: Record<string, string>;
	annotations: Record<string, string>;
	startsAt: string;
	endsAt: string;
	generatorURL: string;
};

type AlertmanagerPayload = {
	version: string;
	groupKey: string;
	status: "firing" | "resolved";
	receiver: string;
	alerts: AlertmanagerAlert[];
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const payload = (await request.json()) as AlertmanagerPayload;

		// Dynamic import to avoid loading core packages at module level
		const { dispatchNotification } = await import("@bytesail/core/notifications/dispatch");

		for (const alert of payload.alerts) {
			const severity = alert.labels.severity ?? "warning";
			const alertName = alert.labels.alertname ?? "Unknown Alert";
			const namespace = alert.labels.namespace ?? "";
			const pod = alert.labels.pod ?? alert.labels.deployment ?? "";
			const summary = alert.annotations.summary ?? alertName;
			const description = alert.annotations.description ?? "";

			const isFiring = alert.status === "firing";

			const eventType = isFiring
				? severity === "critical"
					? "service.crashed"
					: "service.restarted"
				: "deployment.succeeded";

			const title = isFiring
				? `🚨 ${alertName} [${severity.toUpperCase()}]`
				: `✅ Resolved: ${alertName}`;

			const message = [
				summary,
				description ? `\n${description}` : "",
				namespace ? `\nNamespace: ${namespace}` : "",
				pod ? `\nPod: ${pod}` : "",
			]
				.filter(Boolean)
				.join("");

			await dispatchNotification({
				type: eventType,
				title,
				message,
			}).catch((e) => {
				console.error("[ByteSail] Alert dispatch failed:", e);
			});
		}

		return json({ status: "ok", processed: payload.alerts.length });
	} catch (e) {
		console.error("[ByteSail] Alertmanager webhook error:", e);
		return json({ error: "Failed to process alerts" }, { status: 500 });
	}
};
