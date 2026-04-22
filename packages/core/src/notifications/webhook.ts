import crypto from "node:crypto";
import type { NotificationEvent } from "./dispatch.js";

export type WebhookConfig = {
	url: string;
	secret?: string;
	headers?: Record<string, string>;
};

function buildPayload(event: NotificationEvent) {
	return {
		event: event.type,
		title: event.title,
		message: event.message,
		url: event.url ?? null,
		timestamp: new Date().toISOString(),
		source: "bytesail",
	};
}

export async function sendWebhookNotification(
	config: WebhookConfig,
	event: NotificationEvent,
): Promise<void> {
	const payload = JSON.stringify(buildPayload(event));

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"User-Agent": "ByteSail-Webhook/1.0",
		...config.headers,
	};

	if (config.secret) {
		const signature = crypto.createHmac("sha256", config.secret).update(payload).digest("hex");
		headers["X-ByteSail-Signature"] = `sha256=${signature}`;
	}

	const response = await fetch(config.url, {
		method: "POST",
		headers,
		body: payload,
	});

	if (!response.ok) {
		throw new Error(`Webhook failed: ${response.status} ${await response.text()}`);
	}
}
