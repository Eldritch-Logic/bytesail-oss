import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type CanvasGroup = {
	id: string;
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;
};

export type CanvasState = {
	nodes: Array<{ serviceId: string; x: number; y: number; groupId?: string }>;
	groups: CanvasGroup[];
	zoom: number;
	panX: number;
	panY: number;
};

export const projects = pgTable("projects", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: text("organization_id").notNull(),
	name: text("name").notNull(),
	slug: text("slug").notNull(),
	description: text("description"),
	canvasState: jsonb("canvas_state").$type<CanvasState>(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
