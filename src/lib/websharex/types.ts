export type EntryType = 'file' | 'folder';

export interface BaseEntry {
	id: string;
	name: string;
	type: EntryType;
	parentId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface FileEntry extends BaseEntry {
	type: 'file';
	size: number;
	mimeType: string;
	/**
	 * Base64 encoded file contents for demo purposes.
	 * In production this would point to external object storage.
	 */
	payload: string;
	expiresAt: string | null;
	sharedPassword: string | null;
	shareToken: string | null;
	shareCreatedAt: string | null;
}

export interface FolderEntry extends BaseEntry {
	type: 'folder';
}

export type WebsharexEntry = FileEntry | FolderEntry;

export interface RoomState {
	name: string;
	password: string;
	createdAt: string;
	updatedAt: string;
	currentFolderId: string | null;
	entries: WebsharexEntry[];
}

export interface WebsharexState {
	rooms: Record<string, RoomState>;
}
