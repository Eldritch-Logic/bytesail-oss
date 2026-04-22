import type { AppRouter } from "@bytesail/api";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { getConfig } from "../config/store.js";

let _client: ReturnType<typeof createTRPCClient<AppRouter>> | null = null;

export function getClient() {
	if (_client) return _client;

	const config = getConfig();
	if (!config.instanceUrl) {
		console.error("Not configured. Run `bytesail login` first.");
		process.exit(1);
	}

	const credentials = getCredentials();

	_client = createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: `${config.instanceUrl}/api/trpc`,
				headers: () => ({
					...(credentials.apiKey ? { "x-api-key": credentials.apiKey } : {}),
				}),
			}),
		],
	});

	return _client;
}

function getCredentials(): { apiKey?: string } {
	try {
		const { getCredentials: getCreds } = require("../config/store.js");
		return getCreds();
	} catch {
		return {};
	}
}
