import { json } from '@sveltejs/kit';
import * as websharexDb from '$lib/server/websharex';
import { getOSSClient } from '$lib/server/oss';
import type { RequestHandler } from './$types';
import type { WebsharexEntry, FileEntry, FolderEntry } from '$lib/websharex/types';

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
		
		// 获取OSS中所有文件及其元数据
		const ossFilesMap = new Map<string, { size: number; lastModified: Date }>();
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
				const relativePath = obj.name.substring(prefix.length);
				
				ossFilesMap.set(relativePath, {
					size: obj.size,
					lastModified: new Date(obj.lastModified)
				});
			}
			
			hasMore = result.isTruncated;
			marker = result.nextMarker;
		}

		let updatedEntries = [...room.entries];
		let removedCount = 0;
		let addedCount = 0;

		const validEntries = updatedEntries.filter(entry => {
			if (entry.type === 'file' && entry.ossObjectName) {
				if (!ossFilesMap.has(entry.ossObjectName.substring(prefix.length))) {
					removedCount++;
					return false;
				}
			} else if (entry.type === 'folder') {
				const folderPath = buildFolderPath(room.entries, entry.id);
				if (folderPath) {
					const hasFolderContent = Array.from(ossFilesMap.keys()).some(file => 
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

		// 递归清理孤立的子条目
		if (removedCount > 0) {
			let changed = true;
			while (changed) {
				changed = false;
				const beforeCount = validEntries.length;
				
				const parentIds = new Set(validEntries.filter(e => e.type === 'folder').map(e => e.id));
				const filteredEntries = validEntries.filter(entry => {
					if (entry.parentId && !parentIds.has(entry.parentId)) {
						return false;
					}
					return true;
				});
				
				if (filteredEntries.length < beforeCount) {
					changed = true;
					validEntries.length = 0;
					validEntries.push(...filteredEntries);
				}
			}
		}

		const validParentIds = new Set<string | null>(validEntries.filter(e => e.type === 'folder').map(e => e.id));
		validParentIds.add(null);
		
		let fixedCount = 0;
		for (const entry of validEntries) {
			if (entry.type === 'file' && entry.parentId && !validParentIds.has(entry.parentId)) {
				if (entry.ossObjectName) {
					const relativePath = entry.ossObjectName.substring(prefix.length);
					const pathParts = relativePath.split('/');
					
					if (pathParts.length > 1) {
						const folderParts = pathParts.slice(0, -1);
						let targetParentId: string | null = null;
						
						// 逐级查找文件夹
						for (let i = 0; i < folderParts.length; i++) {
							const folderPath = folderParts.slice(0, i + 1).join('/');
							const folder = validEntries.find(e => 
								e.type === 'folder' && 
								buildFolderPath(validEntries, e.id) === folderPath
							);
							if (folder) {
								targetParentId = folder.id;
							}
						}
						
						entry.parentId = targetParentId;
					} else {
						// 文件在根目录
						entry.parentId = null;
					}
				} else {
					entry.parentId = null;
				}
				
				fixedCount++;
			}
		}

		const existingOssNames = new Set(
			validEntries
				.filter((e): e is FileEntry => e.type === 'file' && !!e.ossObjectName)
				.map(e => e.ossObjectName!)
		);

		// 创建文件夹路径到ID的映射
		const folderPathToId = new Map<string, string>();
		for (const entry of validEntries) {
			if (entry.type === 'folder') {
				const path = buildFolderPath(validEntries, entry.id);
				if (path) {
					folderPathToId.set(path, entry.id);
				}
			}
		}

		const now = new Date().toISOString();
		for (const [relativePath, metadata] of ossFilesMap.entries()) {
			const fullPath = prefix + relativePath;
			
			// .keepfolder文件不加入数据库
			if (relativePath.endsWith('.keepfolder')) {
				continue;
			}
			
			if (!existingOssNames.has(fullPath)) {
				const pathParts = relativePath.split('/');
				const fileName = pathParts[pathParts.length - 1];
				const folderParts = pathParts.slice(0, -1);
				
				let parentId: string | null = null;
				for (let i = 0; i < folderParts.length; i++) {
					const folderPath = folderParts.slice(0, i + 1).join('/');
					const folderName = folderParts[i];
					
					if (!folderPathToId.has(folderPath)) {
						const folderId = crypto.randomUUID();
						const folderEntry: FolderEntry = {
							id: folderId,
							name: folderName,
							type: 'folder',
							parentId,
							createdAt: now,
							updatedAt: now
						};
						validEntries.push(folderEntry);
						folderPathToId.set(folderPath, folderId);
						addedCount++;
						parentId = folderId;
					} else {
						parentId = folderPathToId.get(folderPath)!;
					}
				}
				
				const fileId = crypto.randomUUID();
				const fileEntry: FileEntry = {
					id: fileId,
					name: fileName,
					type: 'file',
					parentId,
					size: metadata.size,
					mimeType: 'application/octet-stream',
					payload: '',
					ossObjectName: fullPath,
					ossUrl: undefined,
					expiresAt: null,
					sharedPassword: null,
					shareToken: null,
					shareCreatedAt: null,
					createdAt: now,
					updatedAt: metadata.lastModified.toISOString()
				};
				validEntries.push(fileEntry);
				addedCount++;
			}
		}

		if (removedCount > 0 || addedCount > 0 || fixedCount > 0) {
			await websharexDb.updateRoom(roomName, { entries: validEntries });
		}

		return json({ 
			success: true, 
			removedCount,
			addedCount,
			fixedCount
		});
	} catch (error) {
		console.error('Sync failed:', error);
		return json({ error: '同步失败' }, { status: 500 });
	}
};
