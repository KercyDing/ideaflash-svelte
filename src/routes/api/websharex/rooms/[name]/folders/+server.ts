import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import { createKeepFile } from '$lib/server/oss';
import { nanoid } from 'nanoid';
import type { RequestHandler } from './$types';
import type { FolderEntry } from '$lib/websharex/types';

export const POST: RequestHandler = async ({ request, params }) => {
	const roomName = params.name;
	const { folderName, parentId } = await request.json();

	const room = await websharexDb.getRoom(roomName);
	if (!room) {
		return json({ error: '房间不存在' }, { status: 404 });
	}

	const trimmedName = folderName?.trim();
	if (!trimmedName) {
		return json({ error: '文件夹名称不能为空' }, { status: 400 });
	}

	const now = new Date().toISOString();
	const folderId = nanoid();
	const newFolder: FolderEntry = {
		id: folderId,
		name: trimmedName,
		type: 'folder',
		parentId: parentId || null,
		createdAt: now,
		updatedAt: now
	};

	const updatedEntries = [...room.entries, newFolder];
	await websharexDb.updateRoom(roomName, { entries: updatedEntries });

	try {
		const folderPath = parentId ? `${parentId}/${folderId}` : folderId;
		await createKeepFile(`websharex/${roomName}/${folderPath}`);
	} catch (error) {
		console.error('Failed to create .keep file:', error);
	}

	return json({ success: true, folder: newFolder });
};
