import { gitProviders } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

export const gitRouter = router({
	listProviders: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.select().from(gitProviders).where(eq(gitProviders.userId, ctx.user.id));
	}),

	connect: protectedProcedure
		.input(
			z.object({
				provider: z.enum(["github", "gitlab", "gitea", "bitbucket"]),
				githubInstallationId: z.string().optional(),
				accessToken: z.string().optional(),
				refreshToken: z.string().optional(),
				providerUserId: z.string().optional(),
				providerUsername: z.string().optional(),
				avatarUrl: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [provider] = await ctx.db
				.insert(gitProviders)
				.values({
					userId: ctx.user.id,
					provider: input.provider,
					githubInstallationId: input.githubInstallationId,
					accessToken: input.accessToken,
					refreshToken: input.refreshToken,
					providerUserId: input.providerUserId,
					providerUsername: input.providerUsername,
					avatarUrl: input.avatarUrl,
				})
				.returning();
			return provider;
		}),

	disconnect: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [provider] = await ctx.db
				.delete(gitProviders)
				.where(and(eq(gitProviders.id, input.id), eq(gitProviders.userId, ctx.user.id)))
				.returning();
			if (!provider) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Git provider not found" });
			}
			return provider;
		}),

	listRepos: protectedProcedure
		.input(z.object({ providerId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [provider] = await ctx.db
				.select()
				.from(gitProviders)
				.where(and(eq(gitProviders.id, input.providerId), eq(gitProviders.userId, ctx.user.id)));
			if (!provider) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Git provider not found" });
			}
			// Repo listing is handled client-side via GitHubIntegration
			// This returns the provider so the client can fetch repos
			return { provider };
		}),

	listBranches: protectedProcedure
		.input(
			z.object({
				providerId: z.string().uuid(),
				owner: z.string(),
				repo: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const [provider] = await ctx.db
				.select()
				.from(gitProviders)
				.where(and(eq(gitProviders.id, input.providerId), eq(gitProviders.userId, ctx.user.id)));
			if (!provider) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Git provider not found" });
			}
			return { provider, owner: input.owner, repo: input.repo };
		}),
});
