import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import { uploadFile } from '$lib/server/oss';
import { nanoid } from 'nanoid';
import type { RequestHandler } from './$types';
import type { FolderEntry, WebsharexEntry } from '$lib/websharex/types';

function buildFolderPath(entries: WebsharexEntry[], folderId: string | null): string {
	if (!folderId) return '';
	
	const folder = entries.find(e => e.id === folderId && e.type === 'folder');
	if (!folder) return '';
	
	const parentPath = folder.parentId ? buildFolderPath(entries, folder.parentId) : '';
	return parentPath ? `${parentPath}/${folder.name}` : folder.name;
}

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

	// 上传.keepfolder文件到OSS
	try {
		const folderPath = buildFolderPath(updatedEntries, folderId);
		const emptyBuffer = Buffer.from('');
		await uploadFile(emptyBuffer, {
			fileName: '.keepfolder',
			folder: folderPath,
			roomName,
			preserveFileName: true
		});
	} catch (error) {
		console.error('Failed to create .keepfolder:', error);
	}

	return json({ success: true, folder: newFolder });
};
