import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import { renameFile, renameFolder, deleteFile, deleteFolder, uploadFile } from '$lib/server/oss';
import type { RequestHandler } from './$types';
import type { WebsharexEntry } from '$lib/websharex/types';

function buildFolderPath(entries: WebsharexEntry[], folderId: string | null): string {
	if (!folderId) return '';
	
	const folder = entries.find(e => e.id === folderId && e.type === 'folder');
	if (!folder) return '';
	
	const parentPath = folder.parentId ? buildFolderPath(entries, folder.parentId) : '';
	return parentPath ? `${parentPath}/${folder.name}` : folder.name;
}

export const PATCH: RequestHandler = async ({ request, params }) => {
	const roomName = params.name;
	const entryId = params.id;
	const { newName } = await request.json();

	const room = await websharexDb.getRoom(roomName);
	if (!room) {
		return json({ error: '房间不存在' }, { status: 404 });
	}

	const entry = room.entries.find((e) => e.id === entryId);
	if (!entry) {
		return json({ error: '条目不存在' }, { status: 404 });
	}

	const trimmedName = newName?.trim();
	if (!trimmedName) {
		return json({ error: '名称不能为空' }, { status: 400 });
	}

	try {
		let newOssObjectName: string | undefined;
		
		if (entry.type === 'file' && entry.ossObjectName) {
			newOssObjectName = await renameFile(entry.ossObjectName, trimmedName);
		} else if (entry.type === 'folder') {
			const oldPath = buildFolderPath(room.entries, entryId);
			const parentPath = entry.parentId ? buildFolderPath(room.entries, entry.parentId) : '';
			const newPath = parentPath ? `${parentPath}/${trimmedName}` : trimmedName;
			
			if (oldPath) {
				const oldFolderPrefix = `websharex/${roomName}/${oldPath}/`;
				const newFolderPrefix = `websharex/${roomName}/${newPath}/`;
				await renameFolder(oldFolderPrefix, newFolderPrefix);
			}
		}

		const updatedEntries = room.entries.map((e) => {
			if (e.id === entryId) {
				if (e.type === 'file') {
					return {
						...e,
						name: trimmedName,
						ossObjectName: newOssObjectName || e.ossObjectName,
						updatedAt: new Date().toISOString()
					};
				} else {
					return {
						...e,
						name: trimmedName,
						updatedAt: new Date().toISOString()
					};
				}
			}
			return e;
		});

		await websharexDb.updateRoom(roomName, { entries: updatedEntries });

		return json({ success: true });
	} catch (error) {
		console.error('Rename failed:', error);
		return json({ error: '重命名失败' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const roomName = params.name;
	const entryId = params.id;

	const room = await websharexDb.getRoom(roomName);
	if (!room) {
		return json({ error: '房间不存在' }, { status: 404 });
	}

	const entry = room.entries.find((e) => e.id === entryId);
	if (!entry) {
		return json({ error: '条目不存在' }, { status: 404 });
	}

	try {
		const removeSet = new Set<string>([entryId]);
		let changed = true;
		while (changed) {
			changed = false;
			for (const e of room.entries) {
				if (e.parentId && removeSet.has(e.parentId)) {
					if (!removeSet.has(e.id)) {
						removeSet.add(e.id);
						changed = true;
					}
				}
			}
		}

		const entriesToDelete = room.entries.filter((e) => removeSet.has(e.id));
		
		if (entry.type === 'file') {
			const folderPath = entry.parentId ? buildFolderPath(room.entries, entry.parentId) : '';
			const remainingFiles = room.entries.filter(
				e => e.type === 'file' && e.parentId === entry.parentId && !removeSet.has(e.id)
			);
			
			if (remainingFiles.length === 0) {
				try {
					const emptyBuffer = Buffer.from('');
					await uploadFile(emptyBuffer, {
						fileName: '.keepfolder',
						folder: folderPath || undefined,
						roomName,
						preserveFileName: true
					});
				} catch (error) {
					console.error('Failed to create .keepfolder:', error);
				}
			}
		}
		
		for (const e of entriesToDelete) {
			if (e.type === 'file' && e.ossObjectName) {
				await deleteFile(e.ossObjectName);
			} else if (e.type === 'folder') {
				const folderPath = buildFolderPath(room.entries, e.id);
				if (folderPath) {
					const ossFolderPath = `websharex/${roomName}/${folderPath}/`;
					await deleteFolder(ossFolderPath);
				}
			}
		}

		const updatedEntries = room.entries.filter((e) => !removeSet.has(e.id));
		const currentFolderId = removeSet.has(room.currentFolderId ?? '') 
			? null 
			: room.currentFolderId;

		await websharexDb.updateRoom(roomName, {
			entries: updatedEntries,
			currentFolderId
		});

		return json({ success: true });
	} catch (error) {
		console.error('Delete failed:', error);
		return json({ error: '删除失败' }, { status: 500 });
	}
};
