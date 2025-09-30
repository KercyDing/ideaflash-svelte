import { browser } from '$app/environment';
import { derived, get, writable, type Readable } from 'svelte/store';
import { nanoid } from 'nanoid/non-secure';
import type {
	FileEntry,
	FolderEntry,
	RoomState,
	WebsharexEntry,
	WebsharexState
} from './types';

const DEFAULT_STATE: WebsharexState = { rooms: {} };

async function fetchRooms(): Promise<Record<string, RoomState>> {
	if (!browser) return {};
	try {
		const response = await fetch('/api/websharex/rooms');
		const data = await response.json();
		const roomsMap: Record<string, RoomState> = {};
		for (const room of data.rooms) {
			roomsMap[room.name] = room;
		}
		return roomsMap;
	} catch (error) {
		console.error('Failed to fetch rooms:', error);
		return {};
	}
}

async function apiCreateRoom(name: string, password: string): Promise<void> {
	const response = await fetch('/api/websharex/rooms', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, password })
	});
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error || '创建房间失败');
	}
}

async function apiDeleteRoom(name: string): Promise<void> {
	await fetch('/api/websharex/rooms', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name })
	});
}

async function apiGetRoom(name: string): Promise<RoomState | null> {
	try {
		const response = await fetch(`/api/websharex/rooms/${encodeURIComponent(name)}`);
		if (!response.ok) return null;
		const data = await response.json();
		return data.room;
	} catch (error) {
		console.error('Failed to get room:', error);
		return null;
	}
}

async function apiUpdateRoom(name: string, data: Partial<RoomState>): Promise<void> {
	await fetch(`/api/websharex/rooms/${encodeURIComponent(name)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
}

async function apiVerifyPassword(name: string, password: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/websharex/rooms/${encodeURIComponent(name)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password })
		});
		const data = await response.json();
		return data.valid;
	} catch (error) {
		console.error('Failed to verify password:', error);
		return false;
	}
}

function generateRandomPassword(length = 6) {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
	let value = '';
	for (let i = 0; i < length; i += 1) {
		value += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return value;
}

function sanitizeEntry(entry: WebsharexEntry): WebsharexEntry {
	const parentId = entry.parentId === 'root' ? null : entry.parentId;
	if (entry.type === 'file') {
		return {
			...entry,
			parentId,
			expiresAt: entry.expiresAt ?? null,
			sharedPassword: entry.sharedPassword ?? null,
			shareToken: entry.shareToken ?? null,
			shareCreatedAt: entry.shareCreatedAt ?? null
		};
	}
	return {
		...entry,
		parentId
	};
}

function normalizeRoomState(roomName: string, room: Partial<RoomState> | undefined): RoomState {
	const now = new Date().toISOString();
	const entries: WebsharexEntry[] = Array.isArray(room?.entries)
		? room!.entries.map(sanitizeEntry)
		: [];
	return {
		name: room?.name?.trim() || roomName,
		password: room?.password ?? generateRandomPassword(),
		createdAt: room?.createdAt ?? now,
		updatedAt: room?.updatedAt ?? now,
		currentFolderId: room?.currentFolderId === 'root' ? null : room?.currentFolderId ?? null,
		entries
	};
}

function normalizeState(raw: unknown): WebsharexState {
	if (!raw || typeof raw !== 'object') {
		return { ...DEFAULT_STATE };
	}

	const maybeRooms = (raw as Record<string, unknown>).rooms;
	if (maybeRooms && typeof maybeRooms === 'object') {
		const normalizedRooms: Record<string, RoomState> = {};
		for (const [key, value] of Object.entries(maybeRooms as Record<string, unknown>)) {
			const roomName = typeof key === 'string' ? key : String(key);
			normalizedRooms[roomName] = normalizeRoomState(roomName, value as Partial<RoomState>);
		}
		return { rooms: normalizedRooms };
	}

	return { ...DEFAULT_STATE };
}

async function loadState(): Promise<WebsharexState> {
	if (!browser) {
		return { ...DEFAULT_STATE };
	}

	try {
		const rooms = await fetchRooms();
		return { rooms };
	} catch (error) {
		console.error('Failed to load WebShareX state', error);
		return { ...DEFAULT_STATE };
	}
}

function toBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			if (typeof result === 'string') {
				const commaIndex = result.indexOf(',');
				resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
			} else {
				reject(new Error('Unexpected file reader result'));
			}
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

export function createWebsharexStore() {
	const state = writable<WebsharexState>(DEFAULT_STATE);
	const { subscribe, update, set } = state;

	if (browser) {
		loadState().then((loadedState) => {
			set(loadedState);
		});
	}

	const roomsList: Readable<RoomState[]> = derived(state, ($state) =>
		Object.values($state.rooms).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
	);

	function updateRoom(
		roomName: string,
		transformer: (room: RoomState) => RoomState
	): RoomState | undefined {
		let nextRoom: RoomState | undefined;
		update((current) => {
			const room = current.rooms[roomName];
			if (!room) {
				return current;
			}
			nextRoom = transformer(room);
			return {
				...current,
				rooms: { ...current.rooms, [roomName]: nextRoom as RoomState }
			};
		});
		if (nextRoom && browser) {
			apiUpdateRoom(roomName, nextRoom);
		}
		return nextRoom;
	}

	function ensureRoom(roomName: string): RoomState | undefined {
		return get(state).rooms[roomName];
	}

	return {
		subscribe,
		rooms: roomsList,
		room(roomName: string): Readable<RoomState | undefined> {
			return derived(state, ($state) => $state.rooms[roomName]);
		},
		currentFolderEntries(roomName: string): Readable<WebsharexEntry[]> {
			return derived(state, ($state) => {
				const room = $state.rooms[roomName];
				if (!room) return [];
				return room.entries.filter((entry) => entry.parentId === room.currentFolderId);
			});
		},
		listRoomNames(): string[] {
			return Object.keys(get(state).rooms);
		},
		async createRoom(rawName: string, rawPassword?: string) {
			const name = rawName.trim();
			if (!name) {
				throw new Error('房间名不能为空');
			}
			if (ensureRoom(name)) {
				throw new Error('房间已存在');
			}
			const password = rawPassword?.trim() || generateRandomPassword();
			const now = new Date().toISOString();
			
			await apiCreateRoom(name, password);
			
			update((current) => ({
				...current,
				rooms: {
					...current.rooms,
					[name]: {
						name,
						password,
						createdAt: now,
						updatedAt: now,
						currentFolderId: null,
						entries: []
					}
				}
			}));
			return password;
		},
		async verifyRoomAccess(name: string, rawPassword: string) {
			return await apiVerifyPassword(name.trim(), rawPassword.trim());
		},
		setRoomPassword(name: string, nextPassword: string) {
			updateRoom(name, (room) => ({
				...room,
				password: nextPassword,
				updatedAt: new Date().toISOString()
			}));
		},
		deleteRoom(name: string) {
			const room = ensureRoom(name.trim());
			if (!room) return false;
			
			if (browser) {
				apiDeleteRoom(name);
			}
			
			update((current) => {
				const { [name]: _removed, ...remainingRooms } = current.rooms;
				return {
					...current,
					rooms: remainingRooms
				};
			});
			return true;
		},
		setCurrentFolder(roomName: string, id: string | null) {
			updateRoom(roomName, (room) => ({
				...room,
				currentFolderId: id,
				updatedAt: new Date().toISOString()
			}));
		},
		async uploadFiles(roomName: string, files: FileList | File[]) {
			const room = ensureRoom(roomName);
			if (!room) {
				throw new Error('房间不存在');
			}
			const list = Array.from(files);
			const parentId = room.currentFolderId ?? null;
			const now = new Date();
			const payloads = await Promise.all(
				list.map(async (file) => {
					const base64 = await toBase64(file);
					const entry: FileEntry = {
						id: nanoid(),
						name: file.name,
						type: 'file',
						parentId,
						size: file.size,
						mimeType: file.type || 'application/octet-stream',
						payload: base64,
						createdAt: now.toISOString(),
						updatedAt: now.toISOString(),
						expiresAt: null,
						sharedPassword: null,
						shareToken: null,
						shareCreatedAt: null
					};
					return entry;
				})
			);
			updateRoom(roomName, (room) => ({
				...room,
				entries: [...room.entries, ...payloads],
				updatedAt: new Date().toISOString()
			}));
		},
		createFolder(roomName: string, rawName: string) {
			const room = ensureRoom(roomName);
			if (!room) {
				throw new Error('房间不存在');
			}
			const name = rawName.trim();
			if (!name) return;
			const parentId = room.currentFolderId ?? null;
			const folder: FolderEntry = {
				id: nanoid(),
				name,
				type: 'folder',
				parentId,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
			updateRoom(roomName, (room) => ({
				...room,
				entries: [...room.entries, folder],
				updatedAt: new Date().toISOString()
			}));
		},
		renameEntry(roomName: string, id: string, rawNextName: string) {
			const name = rawNextName.trim();
			if (!name) return;
			updateRoom(roomName, (room) => ({
				...room,
				entries: room.entries.map((entry) =>
					entry.id === id
						? { ...entry, name, updatedAt: new Date().toISOString() }
						: entry
				),
				updatedAt: new Date().toISOString()
			}));
		},
		deleteEntry(roomName: string, id: string) {
			updateRoom(roomName, (room) => {
				const removeSet = new Set<string>([id]);
				let changed = true;
				while (changed) {
					changed = false;
					for (const entry of room.entries) {
						const parentId = entry.parentId;
						if (parentId && removeSet.has(parentId)) {
							if (!removeSet.has(entry.id)) {
								removeSet.add(entry.id);
								changed = true;
							}
						}
					}
				}

				const nextEntries = room.entries.filter((entry) => !removeSet.has(entry.id));
				const nextFolderId = removeSet.has(room.currentFolderId ?? '') ? null : room.currentFolderId;
				return {
					...room,
					entries: nextEntries,
					currentFolderId: nextFolderId,
					updatedAt: new Date().toISOString()
				};
			});
		},
		setShareOptions(
			roomName: string,
			id: string,
			options: { enabled: boolean; expiresAt: string | null; sharedPassword: string | null }
		) {
			updateRoom(roomName, (room) => ({
				...room,
				entries: room.entries.map((entry) =>
					entry.id === id && entry.type === 'file'
						? ((): FileEntry => {
							if (!options.enabled) {
								return {
									...entry,
									expiresAt: null,
									sharedPassword: null,
									shareToken: null,
									shareCreatedAt: null,
									updatedAt: new Date().toISOString()
								};
							}

							const ensureToken = entry.shareToken ?? nanoid();
							const nowIso = new Date().toISOString();
							return {
								...entry,
								expiresAt: options.expiresAt,
								sharedPassword: options.sharedPassword,
								shareToken: ensureToken,
								shareCreatedAt: entry.shareCreatedAt ?? nowIso,
								updatedAt: nowIso
							};
						})()
					: entry
				),
				updatedAt: new Date().toISOString()
			}));
		},
		getEntryByShareToken(roomName: string, token: string) {
			const room = ensureRoom(roomName);
			if (!room) return undefined;
			return room.entries.find((entry) => entry.type === 'file' && entry.shareToken === token) as
				| FileEntry
				| undefined;
		},
		findEntryByShareToken(token: string) {
			const snapshot = get(state).rooms;
			for (const [name, room] of Object.entries(snapshot)) {
				const match = room.entries.find(
					(entry) => entry.type === 'file' && entry.shareToken === token
				) as FileEntry | undefined;
				if (match) {
					return { roomName: name, entry: match };
				}
			}
			return undefined;
		},
		downloadFile(roomName: string, id: string) {
			const room = ensureRoom(roomName);
			if (!room) return;
			const entry = room.entries.find((item) => item.id === id);
			if (!entry || entry.type !== 'file') return;

			const url = `data:${entry.mimeType};base64,${entry.payload}`;
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = entry.name;
			anchor.click();
		}
	};
}

export const websharexStore = createWebsharexStore();
