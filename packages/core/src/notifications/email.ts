import nodemailer from "nodemailer";
import type { NotificationEvent } from "./dispatch.js";

export type EmailConfig = {
	host: string;
	port: number;
	user: string;
	password: string;
	from: string;
	to: string;
	secure?: boolean;
};

function buildHtml(event: NotificationEvent): string {
	const statusColor =
		event.type.includes("failed") || event.type.includes("crashed")
			? "#ef4444"
			: event.type.includes("succeeded") || event.type.includes("completed")
				? "#22c55e"
				: event.type.includes("started")
					? "#3b82f6"
					: "#f59e0b";

	return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #fafafa; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a; overflow: hidden;">
    <div style="height: 4px; background: ${statusColor};"></div>
    <div style="padding: 24px;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #fafafa;">${event.title}</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #a1a1a1; line-height: 1.5;">${event.message}</p>
      ${event.url ? `<a href="${event.url}" style="display: inline-block; padding: 8px 16px; background: ${statusColor}; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 500;">View in ByteSail</a>` : ""}
    </div>
    <div style="padding: 12px 24px; border-top: 1px solid #2a2a2a; font-size: 11px; color: #666;">
      ByteSail &middot; ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`.trim();
}

export async function sendEmailNotification(
	config: EmailConfig,
	event: NotificationEvent,
): Promise<void> {
	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.secure ?? config.port === 465,
		auth: {
			user: config.user,
			pass: config.password,
		},
	});

	await transporter.sendMail({
		from: config.from,
		to: config.to,
		subject: `[ByteSail] ${event.title}`,
		text: `${event.title}\n\n${event.message}${event.url ? `\n\n${event.url}` : ""}`,
		html: buildHtml(event),
	});
}
