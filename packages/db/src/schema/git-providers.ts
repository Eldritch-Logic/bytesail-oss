import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const gitProviders = pgTable("git_providers", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	provider: text("provider", {
		enum: ["github", "gitlab", "gitea", "bitbucket"],
	}).notNull(),

	// GitHub App installation
	githubAppId: text("github_app_id"),
	githubInstallationId: text("github_installation_id"),

	// OAuth tokens
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: timestamp("token_expires_at"),

	// Provider metadata
	providerUserId: text("provider_user_id"),
	providerUsername: text("provider_username"),
	avatarUrl: text("avatar_url"),

	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
