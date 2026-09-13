import { pgTable, serial, text, integer, boolean, timestamp, foreignKey, unique, uniqueIndex, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const links = pgTable("links", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	url: text().notNull(),
	icon: text(),
	imageUrl: text("image_url"),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	clickCount: integer("click_count").default(0).notNull(),
});

export const songs = pgTable("songs", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	artist: text().notNull(),
	url: text().notNull(),
	coverUrl: text("cover_url"),
	duration: integer(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const feedback = pgTable("feedback", {
	id: serial().primaryKey().notNull(),
	category: text(),
	rating: integer(),
	name: text(),
	email: text(),
	message: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
	id: serial().primaryKey().notNull(),
	conversationId: integer("conversation_id").notNull(),
	role: text().notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
]);

export const conversations = pgTable("conversations", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	userId: text("user_id"),
});

export const settings = pgTable("settings", {
	id: serial().primaryKey().notNull(),
	key: text().notNull(),
	value: text().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("settings_key_unique").on(table.key),
]);

export const visitors = pgTable("visitors", {
	id: serial().primaryKey().notNull(),
	visitedAt: timestamp("visited_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	page: text().default('/').notNull(),
});

export const announcements = pgTable("announcements", {
	id: serial().primaryKey().notNull(),
	message: text().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	color: text().default('#00d4ff').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const toolRating = pgTable("tool_rating", {
	id: serial().primaryKey().notNull(),
	toolId: text("tool_id").notNull(),
	userId: text("user_id").notNull(),
	rating: integer().notNull(),
	comment: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("tool_rating_tool_user_idx").using("btree", table.toolId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
]);

export const toolUsage = pgTable("tool_usage", {
	toolId: text("tool_id").primaryKey().notNull(),
	useCount: integer("use_count").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const dailyUsage = pgTable("daily_usage", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "daily_usage_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	userId: text("user_id").notNull(),
	usageDate: date("usage_date").notNull(),
	used: integer().default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("daily_usage_user_date_idx").using("btree", table.userId.asc().nullsLast().op("date_ops"), table.usageDate.asc().nullsLast().op("date_ops")),
]);
