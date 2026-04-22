import { db } from "@bytesail/db";
import { notificationChannels } from "@bytesail/db/schema";
import { sendDiscordNotification } from "./discord.js";
import { sendEmailNotification } from "./email.js";
import { sendSlackNotification } from "./slack.js";
import { sendTelegramNotification } from "./telegram.js";
import { sendWebhookNotification } from "./webhook.js";

export type NotificationEvent = {
	type: string;
	title: string;
	message: string;
	url?: string;
};

export async function dispatchNotification(event: NotificationEvent): Promise<void> {
	let channels: (typeof notificationChannels.$inferSelect)[];

	try {
		channels = await db.select().from(notificationChannels);
	} catch {
		return;
	}

	const promises: Promise<void>[] = [];

	for (const channel of channels) {
		const events = channel.events as string[] | null;
		if (!channel.enabled) continue;
		if (events && events.length > 0 && !events.includes(event.type)) continue;

		promises.push(
			sendToChannel(channel.type, channel.config as Record<string, unknown>, event).catch((e) => {
				console.error(
					`[ByteSail] Notification failed for channel "${channel.name}" (${channel.type}):`,
					e instanceof Error ? e.message : e,
				);
			}),
		);
	}

	await Promise.allSettled(promises);
}

async function sendToChannel(
	type: string,
	config: Record<string, unknown>,
	event: NotificationEvent,
): Promise<void> {
	switch (type) {
		case "slack":
			await sendSlackNotification(config.webhookUrl as string, event);
			break;
		case "discord":
			await sendDiscordNotification(config.webhookUrl as string, event);
			break;
		case "email":
			await sendEmailNotification(config as Parameters<typeof sendEmailNotification>[0], event);
			break;
		case "telegram":
			await sendTelegramNotification(config.botToken as string, config.chatId as string, event);
			break;
		case "webhook":
			await sendWebhookNotification(config as Parameters<typeof sendWebhookNotification>[0], event);
			break;
		default:
			console.warn(`[ByteSail] Unknown notification channel type: ${type}`);
	}
}
