import OSS from 'ali-oss';
import {
	ALIYUN_OSS_REGION,
	ALIYUN_OSS_ACCESS_KEY_ID,
	ALIYUN_OSS_ACCESS_KEY_SECRET,
	ALIYUN_OSS_BUCKET,
	ALIYUN_OSS_ENDPOINT
} from '$env/static/private';
import { nanoid } from 'nanoid';

let ossClient: OSS | null = null;

export function getOSSClient(): OSS {
	if (!ossClient) {
		ossClient = new OSS({
			region: ALIYUN_OSS_REGION,
			accessKeyId: ALIYUN_OSS_ACCESS_KEY_ID,
			accessKeySecret: ALIYUN_OSS_ACCESS_KEY_SECRET,
			bucket: ALIYUN_OSS_BUCKET,
			endpoint: ALIYUN_OSS_ENDPOINT
		});
	}
	return ossClient;
}

export interface UploadResult {
	name: string;
	url: string;
	size: number;
	mimeType: string;
}

export async function uploadFile(
	file: File | Buffer,
	options?: {
		fileName?: string;
		folder?: string;
		roomName?: string;
		preserveFileName?: boolean;
	}
): Promise<UploadResult> {
	const client = getOSSClient();

	const timestamp = Date.now();
	const randomId = nanoid(8);
	const fileName =
		options?.fileName ||
		(file instanceof File ? file.name : `file-${randomId}`);
	
	const roomPath = options?.roomName ? `${options.roomName}/` : '';
	const folderPath = options?.folder ? `${options.folder}/` : '';
	
	let objectName: string;
	if (options?.preserveFileName) {
		objectName = `websharex/${roomPath}${folderPath}${fileName}`;
	} else {
		const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
		objectName = `websharex/${roomPath}${folderPath}${timestamp}-${randomId}-${sanitizedFileName}`;
	}

	let buffer: Buffer;
	let size: number;
	let mimeType: string;

	if (file instanceof File) {
		const arrayBuffer = await file.arrayBuffer();
		buffer = Buffer.from(arrayBuffer);
		size = file.size;
		mimeType = file.type || 'application/octet-stream';
	} else {
		buffer = file;
		size = file.length;
		mimeType = 'application/octet-stream';
	}

	const result = await client.put(objectName, buffer, {
		headers: {
			'Content-Type': mimeType,
			'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
		}
	});

	return {
		name: objectName,
		url: result.url,
		size,
		mimeType
	};
}

export async function uploadMultipleFiles(
	files: File[],
	options?: {
		folder?: string;
		roomName?: string;
		preserveFileName?: boolean;
	}
): Promise<UploadResult[]> {
	const uploadPromises = files.map((file) =>
		uploadFile(file, {
			...options,
			fileName: file.name
		})
	);
	return Promise.all(uploadPromises);
}

export async function deleteFile(objectName: string): Promise<void> {
	if (objectName === 'websharex/.keepfolder') {
		return;
	}
	
	const client = getOSSClient();
	await client.delete(objectName);
}

export async function deleteMultipleFiles(objectNames: string[]): Promise<void> {
	const client = getOSSClient();
	const deletePromises = objectNames.map((name) => client.delete(name));
	await Promise.all(deletePromises);
}

export async function getFileUrl(objectName: string, expiresIn: number = 3600): Promise<string> {
	const client = getOSSClient();
	return client.signatureUrl(objectName, {
		expires: expiresIn
	});
}

export async function getPublicFileUrl(objectName: string): Promise<string> {
	const client = getOSSClient();
	return `https://${ALIYUN_OSS_BUCKET}.${ALIYUN_OSS_ENDPOINT}/${objectName}`;
}

export async function copyFile(sourceObjectName: string, targetObjectName: string): Promise<void> {
	const client = getOSSClient();
	await client.copy(targetObjectName, sourceObjectName);
}

export async function listFiles(prefix: string = 'websharex/'): Promise<any[]> {
	const client = getOSSClient();
	const result = await client.list(
		{
			prefix,
			'max-keys': '1000'
		},
		{}
	);
	return result.objects || [];
}

export async function renameFile(oldObjectName: string, newFileName: string): Promise<string> {
	const client = getOSSClient();
	const pathParts = oldObjectName.split('/');
	pathParts[pathParts.length - 1] = newFileName;
	const newObjectName = pathParts.join('/');
	
	await client.copy(newObjectName, oldObjectName);
	await client.delete(oldObjectName);
	
	return newObjectName;
}

export async function renameFolder(oldFolderPrefix: string, newFolderPrefix: string): Promise<void> {
	const client = getOSSClient();
	
	let marker: string | undefined;
	let hasMore = true;
	
	while (hasMore) {
		const result = await client.list(
			{
				prefix: oldFolderPrefix,
				'max-keys': '1000',
				marker
			},
			{}
		);
		
		const objects = result.objects || [];
		
		for (const obj of objects) {
			const oldName = obj.name;
			const relativePath = oldName.substring(oldFolderPrefix.length);
			const newName = newFolderPrefix + relativePath;
			
			await client.copy(newName, oldName);
		}
		
		if (objects.length > 0) {
			const objectNames = objects.map((obj: any) => obj.name);
			await client.deleteMulti(objectNames, { quiet: true });
		}
		
		hasMore = result.isTruncated;
		marker = result.nextMarker;
	}
}

export async function deleteFolder(folderPrefix: string): Promise<void> {
	const client = getOSSClient();
	
	let marker: string | undefined;
	let hasMore = true;
	
	while (hasMore) {
		const result = await client.list(
			{
				prefix: folderPrefix,
				'max-keys': '1000',
				marker
			},
			{}
		);
		
		const objects = result.objects || [];
		
		if (objects.length > 0) {
			// 过滤掉websharex根目录的.keepfolder，永不删除
			const objectNames = objects
				.map((obj: any) => obj.name)
				.filter((name: string) => name !== 'websharex/.keepfolder');
			
			if (objectNames.length > 0) {
				await client.deleteMulti(objectNames, { quiet: true });
			}
		}
		
		hasMore = result.isTruncated;
		marker = result.nextMarker;
	}
}
