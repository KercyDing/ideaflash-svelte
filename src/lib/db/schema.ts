import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 用户表
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`)
});

// 文件表 - 先声明类型，避免循环引用
export type File = {
	id: string;
	name: string;
	path: string;
	size: number;
	type: string;
	userId: string;
	parentId: string | null;
	createdAt: number;
	updatedAt: number;
};

// 文件表
export const files = sqliteTable('files', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	path: text('path').notNull(),
	size: integer('size').notNull(),
	type: text('type').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	parentId: text('parent_id').references((): any => files.id),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`)
});

// 分享表
export const shares = sqliteTable('shares', {
	id: text('id').primaryKey(),
	password: text('password'),
	expiresAt: integer('expires_at', { mode: 'timestamp' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	fileId: text('file_id')
		.notNull()
		.references(() => files.id),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`)
});
