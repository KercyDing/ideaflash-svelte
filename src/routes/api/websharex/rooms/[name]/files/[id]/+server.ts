import { json } from '@sveltejs/kit';
import { getFileUrl } from '$lib/server/oss';
import * as websharexDb from '$lib/server/websharex';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const roomName = params.name;
	const entryId = params.id;

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
			const downloadUrl = await getFileUrl(entry.ossObjectName, 3600);
			return json({ url: downloadUrl, name: entry.name });
		}
		
		if (entry.payload) {
			const dataUrl = `data:${entry.mimeType};base64,${entry.payload}`;
			return json({ url: dataUrl, name: entry.name });
		}

		return json({ error: '文件数据不可用' }, { status: 404 });
	} catch (error) {
		console.error('Get file URL failed:', error);
		return json({ error: '获取文件失败' }, { status: 500 });
	}
};
