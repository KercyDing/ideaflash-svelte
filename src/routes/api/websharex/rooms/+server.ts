import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import type { RequestHandler } from './$types';

await websharexDb.ensureTable();

export const GET: RequestHandler = async () => {
	const rooms = await websharexDb.getAllRooms();
	return json({ rooms });
};

export const POST: RequestHandler = async ({ request }) => {
	const { name, password } = await request.json();
	
	const existing = await websharexDb.getRoom(name);
	if (existing) {
		return json({ error: '房间已存在' }, { status: 400 });
	}

	await websharexDb.createRoom(name, password);
	return json({ success: true, password });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const { name } = await request.json();
	await websharexDb.deleteRoom(name);
	return json({ success: true });
};
