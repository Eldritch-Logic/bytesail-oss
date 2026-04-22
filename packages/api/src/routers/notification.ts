import { notificationChannels } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

const channelConfigSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("slack"),
		webhookUrl: z.string().url(),
	}),
	z.object({
		type: z.literal("discord"),
		webhookUrl: z.string().url(),
	}),
	z.object({
		type: z.literal("email"),
		host: z.string().min(1),
		port: z.number(),
		user: z.string().min(1),
		password: z.string().min(1),
		from: z.string().min(1),
		to: z.string().min(1),
		secure: z.boolean().optional(),
	}),
	z.object({
		type: z.literal("telegram"),
		botToken: z.string().min(1),
		chatId: z.string().min(1),
	}),
	z.object({
		type: z.literal("webhook"),
		url: z.string().url(),
		secret: z.string().optional(),
		headers: z.record(z.string()).optional(),
	}),
]);

const eventTypes = [
	"deployment.started",
	"deployment.succeeded",
	"deployment.failed",
	"service.crashed",
	"service.restarted",
	"cert.expiring",
	"backup.completed",
	"backup.failed",
] as const;

export const notificationRouter = router({
	listChannels: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.select().from(notificationChannels);
	}),

	createChannel: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				config: channelConfigSchema,
				events: z.array(z.enum(eventTypes)).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [channel] = await ctx.db
				.insert(notificationChannels)
				.values({
					organizationId: "default",
					name: input.name,
					type: input.config.type,
					config: input.config,
					events: input.events,
				})
				.returning();

			return channel;
		}),

	updateChannel: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				name: z.string().min(1).max(100).optional(),
				config: channelConfigSchema.optional(),
				events: z.array(z.enum(eventTypes)).optional(),
				enabled: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const setValues: Record<string, unknown> = {};
			if (input.name !== undefined) setValues.name = input.name;
			if (input.config !== undefined) {
				setValues.config = input.config;
				setValues.type = input.config.type;
			}
			if (input.events !== undefined) setValues.events = input.events;
			if (input.enabled !== undefined) setValues.enabled = input.enabled;

			const [channel] = await ctx.db
				.update(notificationChannels)
				.set(setValues)
				.where(eq(notificationChannels.id, input.id))
				.returning();

			if (!channel) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" });
			}

			return channel;
		}),

	deleteChannel: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [channel] = await ctx.db
				.delete(notificationChannels)
				.where(eq(notificationChannels.id, input.id))
				.returning();

			if (!channel) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" });
			}

			return channel;
		}),

	testChannel: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [channel] = await ctx.db
				.select()
				.from(notificationChannels)
				.where(eq(notificationChannels.id, input.id));

			if (!channel) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Channel not found" });
			}

			const testEvent = {
				type: "deployment.succeeded",
				title: "Test Notification",
				message:
					"This is a test notification from ByteSail. If you see this, your notification channel is configured correctly!",
				url: undefined as string | undefined,
			};

			const config = channel.config as Record<string, unknown>;

			switch (channel.type) {
				case "slack": {
					const { sendSlackNotification } = await import("@bytesail/core/notifications/slack");
					await sendSlackNotification(config.webhookUrl as string, testEvent);
					break;
				}
				case "discord": {
					const { sendDiscordNotification } = await import("@bytesail/core/notifications/discord");
					await sendDiscordNotification(config.webhookUrl as string, testEvent);
					break;
				}
				case "email": {
					const { sendEmailNotification } = await import("@bytesail/core/notifications/email");
					await sendEmailNotification(
						config as Parameters<typeof sendEmailNotification>[0],
						testEvent,
					);
					break;
				}
				case "telegram": {
					const { sendTelegramNotification } = await import(
						"@bytesail/core/notifications/telegram"
					);
					await sendTelegramNotification(
						config.botToken as string,
						config.chatId as string,
						testEvent,
					);
					break;
				}
				case "webhook": {
					const { sendWebhookNotification } = await import("@bytesail/core/notifications/webhook");
					await sendWebhookNotification(
						config as Parameters<typeof sendWebhookNotification>[0],
						testEvent,
					);
					break;
				}
				default:
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Unsupported channel type: ${channel.type}`,
					});
			}

			return { success: true };
		}),
});
