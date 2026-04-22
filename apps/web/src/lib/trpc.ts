import type { AppRouter } from "@bytesail/api";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export const trpc = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: "/api/trpc",
		}),
	],
});
