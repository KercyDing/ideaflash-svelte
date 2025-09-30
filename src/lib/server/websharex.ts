import { db } from '$lib/db';
import { websharexRooms } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { RoomState, WebsharexEntry } from '$lib/websharex/types';
import { uploadFile, getOSSClient } from '$lib/server/oss';

export async function ensureTable() {
	try {
		await db.execute(`
			CREATE TABLE IF NOT EXISTS websharex_rooms (
				name VARCHAR(255) PRIMARY KEY,
				password VARCHAR(255) NOT NULL,
				created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				current_folder_id VARCHAR(255),
				entries JSON NOT NULL DEFAULT ('[]')
			)
		`);
		
		try {
			const client = getOSSClient();
			const keepfolderPath = 'websharex/.keepfolder';
			
			try {
				await client.head(keepfolderPath);
			} catch (error) {
				const emptyBuffer = Buffer.from('');
				await client.put(keepfolderPath, emptyBuffer);
			}
		} catch (error) {
			console.error('Failed to create websharex/.keepfolder:', error);
		}
	} catch (error) {
		console.error('Failed to create table:', error);
	}
}

export async function getAllRooms(): Promise<RoomState[]> {
	try {
		const rooms = await db.select().from(websharexRooms);
		return rooms.map((row) => ({
			name: row.name,
			password: row.password,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			currentFolderId: row.currentFolderId ?? null,
			entries: Array.isArray(row.entries) ? row.entries : []
		}));
	} catch (error) {
		console.error('Failed to get rooms:', error);
		return [];
	}
}

export async function getRoom(name: string): Promise<RoomState | null> {
	try {
		const rooms = await db.select().from(websharexRooms).where(eq(websharexRooms.name, name));
		if (rooms.length === 0) return null;
		const row = rooms[0];
		return {
			name: row.name,
			password: row.password,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			currentFolderId: row.currentFolderId ?? null,
			entries: Array.isArray(row.entries) ? row.entries : []
		};
	} catch (error) {
		console.error('Failed to get room:', error);
		return null;
	}
}

export async function createRoom(name: string, password: string): Promise<void> {
	await db.insert(websharexRooms).values({
		name,
		password,
		currentFolderId: null,
		entries: []
	});
}

export async function updateRoom(name: string, data: Partial<RoomState>): Promise<void> {
	const updateData: any = {};
	if (data.password !== undefined) updateData.password = data.password;
	if (data.currentFolderId !== undefined) updateData.currentFolderId = data.currentFolderId;
	if (data.entries !== undefined) updateData.entries = data.entries;

	await db.update(websharexRooms).set(updateData).where(eq(websharexRooms.name, name));
}

export async function deleteRoom(name: string): Promise<boolean> {
	const result = await db.delete(websharexRooms).where(eq(websharexRooms.name, name));
	return true;
}

export async function verifyRoomPassword(name: string, password: string): Promise<boolean> {
	const room = await getRoom(name);
	if (!room) return false;
	return room.password === password;
}
