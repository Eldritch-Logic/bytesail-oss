import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@bytesail/db";
import { systemSettings } from "@bytesail/db/schema";
import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types.js";

async function getWebhookSecret(): Promise<string | null> {
	const [appSetting] = await db
		.select()
		.from(systemSettings)
		.where(eq(systemSettings.key, "github_app"));

	if (!appSetting) return null;
	const config = appSetting.value as { webhookSecret?: string };
	return config.webhookSecret ?? null;
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
	const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
	try {
		return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
	} catch {
		return false;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const event = request.headers.get("x-github-event");
	const signature = request.headers.get("x-hub-signature-256");
	const body = await request.text();

	// Verify signature when webhook secret is configured
	const secret = await getWebhookSecret();
	if (secret) {
		if (!signature) {
			return json({ error: "Missing signature" }, { status: 401 });
		}
		if (!verifySignature(body, signature, secret)) {
			return json({ error: "Invalid signature" }, { status: 401 });
		}
	}

	if (!event) {
		return json({ error: "Missing X-GitHub-Event header" }, { status: 400 });
	}

	const payload = JSON.parse(body);

	try {
		const { handleGitHubWebhook } = await import("@bytesail/core/git/webhook");
		await handleGitHubWebhook(event, payload);
	} catch (e) {
		console.error(`[ByteSail] Webhook handler error (${event}):`, e);
	}

	return json({ received: true });
};
