import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import { deleteFolder, uploadFile } from '$lib/server/oss';
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

	// 在根目录创建.keepfolder
	try {
		const emptyBuffer = Buffer.from('');
		await uploadFile(emptyBuffer, {
			fileName: '.keepfolder',
			roomName: name,
			preserveFileName: true
		});
	} catch (error) {
		console.error('Failed to create root .keepfolder:', error);
	}

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const { name } = await request.json();
	
	try {
		await deleteFolder(`websharex/${name}/`);
	} catch (error) {
		console.error('Failed to delete OSS folder:', error);
	}
	
	await websharexDb.deleteRoom(name);
	return json({ success: true });
};
