import type { NotificationEvent } from "./dispatch.js";

type DiscordEmbed = {
	title: string;
	description: string;
	color: number;
	url?: string;
	footer?: { text: string };
	timestamp?: string;
};

const EVENT_COLORS: Record<string, number> = {
	"deployment.started": 0x3b82f6,
	"deployment.succeeded": 0x22c55e,
	"deployment.failed": 0xef4444,
	"service.crashed": 0xef4444,
	"service.restarted": 0xf59e0b,
	"cert.expiring": 0xf59e0b,
	"backup.completed": 0x22c55e,
	"backup.failed": 0xef4444,
};

function buildDiscordPayload(event: NotificationEvent) {
	const embed: DiscordEmbed = {
		title: event.title,
		description: event.message,
		color: EVENT_COLORS[event.type] ?? 0x6b7280,
		timestamp: new Date().toISOString(),
		footer: { text: "ByteSail" },
	};

	if (event.url) {
		embed.url = event.url;
	}

	return {
		content: null,
		embeds: [embed],
	};
}

export async function sendDiscordNotification(
	webhookUrl: string,
	event: NotificationEvent,
): Promise<void> {
	const payload = buildDiscordPayload(event);

	const response = await fetch(webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`Discord webhook failed: ${response.status} ${await response.text()}`);
	}
}
