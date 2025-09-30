import { json } from '@sveltejs/kit';
import { uploadMultipleFiles, deleteFile } from '$lib/server/oss';
import * as websharexDb from '$lib/server/websharex';
import { nanoid } from 'nanoid';
import type { RequestHandler } from './$types';
import type { FileEntry, WebsharexEntry } from '$lib/websharex/types';

function buildFolderPath(entries: WebsharexEntry[], folderId: string | null): string {
	if (!folderId) return '';
	
	const folder = entries.find(e => e.id === folderId && e.type === 'folder');
	if (!folder) return '';
	
	const parentPath = folder.parentId ? buildFolderPath(entries, folder.parentId) : '';
	return parentPath ? `${parentPath}/${folder.name}` : folder.name;
}

export const POST: RequestHandler = async ({ request, params }) => {
	const roomName = params.name;
	
	const room = await websharexDb.getRoom(roomName);
	if (!room) {
		return json({ error: '房间不存在' }, { status: 404 });
	}

	const formData = await request.formData();
	const files = formData.getAll('files') as File[];
	const parentId = (formData.get('parentId') as string) || null;

	if (!files || files.length === 0) {
		return json({ error: '没有文件' }, { status: 400 });
	}

	try {
		const folderPath = parentId ? buildFolderPath(room.entries, parentId) : '';
		const uploadResults = await uploadMultipleFiles(files, {
			folder: folderPath || undefined,
			roomName,
			preserveFileName: true
		});		const now = new Date().toISOString();
		const newEntries: FileEntry[] = uploadResults.map((result, index) => ({
			id: nanoid(),
			name: files[index].name,
			type: 'file' as const,
			parentId,
			size: result.size,
			mimeType: result.mimeType,
			payload: '',
			ossObjectName: result.name,
			ossUrl: result.url,
			createdAt: now,
			updatedAt: now,
			expiresAt: null,
			sharedPassword: null,
			shareToken: null,
			shareCreatedAt: null
		}));

		const updatedEntries = [...room.entries, ...newEntries];
		await websharexDb.updateRoom(roomName, { entries: updatedEntries });

		return json({ success: true, entries: newEntries });
	} catch (error) {
		console.error('Upload failed:', error);
		return json({ error: '上传失败' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const roomName = params.name;
	const { entryId } = await request.json();

	const room = await websharexDb.getRoom(roomName);
	if (!room) {
		return json({ error: '房间不存在' }, { status: 404 });
	}

	const entry = room.entries.find((e) => e.id === entryId);
	if (!entry || entry.type !== 'file') {
		return json({ error: '文件不存在' }, { status: 404 });
	}

	try {
		if (entry.ossObjectName) {
			await deleteFile(entry.ossObjectName);
		}

		const updatedEntries = room.entries.filter((e) => e.id !== entryId);
		await websharexDb.updateRoom(roomName, { entries: updatedEntries });

		return json({ success: true });
	} catch (error) {
		console.error('Delete failed:', error);
		return json({ error: '删除失败' }, { status: 500 });
	}
};
