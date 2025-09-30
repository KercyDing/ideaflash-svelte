import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import { renameFile, renameFolder, deleteFile, deleteFolder } from '$lib/server/oss';
import type { RequestHandler } from './$types';

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
			const oldFolderPath = `websharex/${roomName}/${entryId}/`;
			const newFolderPath = `websharex/${roomName}/${entryId}/`;
			// OSS文件夹路径保持不变（使用ID），只更新数据库中的显示名称
			// 如果需要同步重命名OSS中的路径，取消注释下面这行：
			// await renameFolder(oldFolderPath, newFolderPath);
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
		
		for (const e of entriesToDelete) {
			if (e.type === 'file' && e.ossObjectName) {
				await deleteFile(e.ossObjectName);
			} else if (e.type === 'folder') {
				const folderPath = `websharex/${roomName}/${e.id}/`;
				await deleteFolder(folderPath);
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
