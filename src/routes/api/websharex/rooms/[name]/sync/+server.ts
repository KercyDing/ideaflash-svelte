import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import { getOSSClient } from '$lib/server/oss';
import type { RequestHandler } from './$types';
import type { WebsharexEntry } from '$lib/websharex/types';

function buildFolderPath(entries: WebsharexEntry[], folderId: string | null): string {
	if (!folderId) return '';
	
	const folder = entries.find(e => e.id === folderId && e.type === 'folder');
	if (!folder) return '';
	
	const parentPath = folder.parentId ? buildFolderPath(entries, folder.parentId) : '';
	return parentPath ? `${parentPath}/${folder.name}` : folder.name;
}

export const POST: RequestHandler = async ({ params }) => {
	const roomName = params.name;
	
	const room = await websharexDb.getRoom(roomName);
	if (!room) {
		return json({ error: '房间不存在' }, { status: 404 });
	}

	try {
		const client = getOSSClient();
		const prefix = `websharex/${roomName}/`;
		
		// 获取OSS中所有文件
		const ossFiles = new Set<string>();
		let marker: string | undefined;
		let hasMore = true;
		
		while (hasMore) {
			const result = await client.list(
				{
					prefix,
					'max-keys': '1000',
					marker
				},
				{}
			);
			
			const objects = result.objects || [];
			for (const obj of objects) {
				// 移除前缀，只保留相对路径
				const relativePath = obj.name.substring(prefix.length);
				ossFiles.add(relativePath);
			}
			
			hasMore = result.isTruncated;
			marker = result.nextMarker;
		}

		// 检查数据库中的文件条目
		let updatedEntries = [...room.entries];
		let removedCount = 0;

		// 过滤出不存在于OSS的文件
		const validEntries = updatedEntries.filter(entry => {
			if (entry.type === 'file' && entry.ossObjectName) {
				// 检查文件是否在OSS中存在
				if (!ossFiles.has(entry.ossObjectName.substring(prefix.length))) {
					removedCount++;
					return false; // 文件不存在，移除
				}
			} else if (entry.type === 'folder') {
				// 检查文件夹是否在OSS中有内容
				const folderPath = buildFolderPath(room.entries, entry.id);
				if (folderPath) {
					// 检查文件夹下是否有文件
					const hasFolderContent = Array.from(ossFiles).some(file => 
						file.startsWith(folderPath + '/')
					);
					if (!hasFolderContent) {
						removedCount++;
						return false;
					}
				}
			}
			return true;
		});

		if (removedCount > 0) {
			// 递归清理孤立的子条目
			let changed = true;
			while (changed) {
				changed = false;
				const beforeCount = validEntries.length;
				
				// 移除父文件夹不存在的条目
				const parentIds = new Set(validEntries.filter(e => e.type === 'folder').map(e => e.id));
				const filteredEntries = validEntries.filter(entry => {
					if (entry.parentId && !parentIds.has(entry.parentId)) {
						return false; // 父文件夹不存在，移除
					}
					return true;
				});
				
				if (filteredEntries.length < beforeCount) {
					changed = true;
					validEntries.length = 0;
					validEntries.push(...filteredEntries);
				}
			}

			await websharexDb.updateRoom(roomName, { entries: validEntries });
		}

		return json({ 
			success: true, 
			removedCount
		});
	} catch (error) {
		console.error('Sync failed:', error);
		return json({ error: '同步失败' }, { status: 500 });
	}
};
