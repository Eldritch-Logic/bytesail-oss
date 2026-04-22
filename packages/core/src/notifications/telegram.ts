import type { NotificationEvent } from "./dispatch.js";

const TELEGRAM_API = "https://api.telegram.org";

const STATUS_EMOJI: Record<string, string> = {
	"deployment.started": "🚀",
	"deployment.succeeded": "✅",
	"deployment.failed": "❌",
	"service.crashed": "🚨",
	"service.restarted": "🔄",
	"cert.expiring": "⚠️",
	"backup.completed": "💾",
	"backup.failed": "❌",
};

function buildMessage(event: NotificationEvent): string {
	const emoji = STATUS_EMOJI[event.type] ?? "🔔";
	let text = `${emoji} *${escapeMarkdown(event.title)}*\n\n${escapeMarkdown(event.message)}`;

	if (event.url) {
		text += `\n\n[View in ByteSail](${event.url})`;
	}

	return text;
}

function escapeMarkdown(text: string): string {
	return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function sendTelegramNotification(
	botToken: string,
	chatId: string,
	event: NotificationEvent,
): Promise<void> {
	const message = buildMessage(event);

	const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			chat_id: chatId,
			text: message,
			parse_mode: "MarkdownV2",
			disable_web_page_preview: false,
		}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(
			`Telegram API failed: ${response.status} ${(error as { description?: string }).description ?? ""}`,
		);
	}
}
