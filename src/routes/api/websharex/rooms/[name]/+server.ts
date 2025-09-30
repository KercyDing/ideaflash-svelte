import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const room = await websharexDb.getRoom(params.name);
	if (!room) {
		return json({ error: '房间不存在' }, { status: 404 });
	}
	return json({ room });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const data = await request.json();
	await websharexDb.updateRoom(params.name, data);
	return json({ success: true });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { password } = await request.json();
	const valid = await websharexDb.verifyRoomPassword(params.name, password);
	return json({ valid });
};
