import { db } from "@bytesail/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { bearer } from "better-auth/plugins/bearer";
import { organization } from "better-auth/plugins/organization";

// biome-ignore lint/suspicious/noExplicitAny: betterAuth return type is generic and can't be named portably
type AuthInstance = any;

let _auth: AuthInstance | null = null;

function createAuth() {
	return betterAuth({
		database: drizzleAdapter(db, { provider: "pg" }),
		emailAndPassword: {
			enabled: true,
			rateLimit: { window: 60, max: 5 },
		},
		rateLimit: {
			window: 60,
			max: 100,
		},
		socialProviders: {
			github: {
				clientId: process.env.GITHUB_CLIENT_ID ?? "",
				clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
				enabled: !!process.env.GITHUB_CLIENT_ID,
			},
		},
		plugins: [
			organization({
				allowUserToCreateOrganization: true,
				organizationLimit: 5,
				membershipLimit: 25,
			}),
			bearer(),
			admin({
				defaultRole: "member",
			}),
		],
		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60,
			},
		},
		trustedOrigins: process.env.DASHBOARD_URL ? [process.env.DASHBOARD_URL] : [],
	});
}

export const auth = new Proxy({} as AuthInstance, {
	get(_target, prop, receiver) {
		if (!_auth) _auth = createAuth();
		return Reflect.get(_auth, prop, receiver);
	},
});

export type Auth = AuthInstance;
