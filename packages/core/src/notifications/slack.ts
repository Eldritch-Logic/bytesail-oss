import type { NotificationEvent } from "./dispatch.js";

type SlackBlock =
	| { type: "header"; text: { type: "plain_text"; text: string } }
	| { type: "section"; text: { type: "mrkdwn"; text: string } }
	| { type: "divider" }
	| {
			type: "actions";
			elements: Array<{
				type: "button";
				text: { type: "plain_text"; text: string };
				url?: string;
				style?: "primary" | "danger";
			}>;
	  };

type SlackMessage = {
	text: string;
	blocks?: SlackBlock[];
};

const STATUS_EMOJI: Record<string, string> = {
	"deployment.started": ":rocket:",
	"deployment.succeeded": ":white_check_mark:",
	"deployment.failed": ":x:",
	"service.crashed": ":rotating_light:",
	"service.restarted": ":arrows_counterclockwise:",
	"cert.expiring": ":warning:",
	"backup.completed": ":floppy_disk:",
	"backup.failed": ":x:",
};

function buildSlackMessage(event: NotificationEvent): SlackMessage {
	const emoji = STATUS_EMOJI[event.type] ?? ":bell:";
	const blocks: SlackBlock[] = [
		{
			type: "header",
			text: { type: "plain_text", text: `${emoji} ${event.title}` },
		},
		{
			type: "section",
			text: { type: "mrkdwn", text: event.message },
		},
	];

	if (event.url) {
		blocks.push({
			type: "actions",
			elements: [
				{
					type: "button",
					text: { type: "plain_text", text: "View in ByteSail" },
					url: event.url,
					style: "primary",
				},
			],
		});
	}

	return {
		text: `${emoji} ${event.title}: ${event.message}`,
		blocks,
	};
}

export async function sendSlackNotification(
	webhookUrl: string,
	event: NotificationEvent,
): Promise<void> {
	const message = buildSlackMessage(event);

	const response = await fetch(webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(message),
	});

	if (!response.ok) {
		throw new Error(`Slack webhook failed: ${response.status} ${await response.text()}`);
	}
}
