import { mysqlTable, varchar, timestamp, json } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const websharexRooms = mysqlTable('websharex_rooms', {
	name: varchar('name', { length: 255 }).primaryKey(),
	password: varchar('password', { length: 255 }).notNull(),
	createdAt: timestamp('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
	currentFolderId: varchar('current_folder_id', { length: 255 }),
	entries: json('entries').notNull().default('[]')
});
