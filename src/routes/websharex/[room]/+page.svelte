<script lang="ts">
	import Icon from '@iconify/svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { derived } from 'svelte/store';
	import { websharexStore } from '$lib/websharex/store';
	import type { RoomState, WebsharexEntry } from '$lib/websharex/types';

	const roomNameStore = derived(page, ($page) => decodeURIComponent($page.params.room ?? ''));
	const roomStateStore = derived([roomNameStore, websharexStore], ([$roomName, $state]) =>
		$roomName ? ($state.rooms?.[$roomName] as RoomState | undefined) : undefined
	);
	const entriesStore = derived([roomNameStore, websharexStore], ([$roomName, $state]) => {
		if (!$roomName) return [];
		const room = $state.rooms?.[$roomName];
		if (!room) return [];
		return room.entries.filter((entry) => entry.parentId === room.currentFolderId);
	});
	const breadcrumbsStore = derived([roomNameStore, roomStateStore], ([$roomName, $room]) => {
		if (!$roomName || !$room) return [];
		const crumbs: { id: string | null; name: string }[] = [];
		let pointer = $room.currentFolderId;
		while (pointer) {
			const entry = $room.entries.find((item) => item.id === pointer);
			if (!entry) break;
			crumbs.unshift({ id: entry.id, name: entry.name });
			pointer = entry.parentId;
		}
		return crumbs;
	});

	let roomName = '';
	let room: RoomState | undefined;
	let folderEntries: WebsharexEntry[] = [];
	let breadcrumbs: { id: string | null; name: string }[] = [];

	let showCreateFolder = false;
	let folderName = '';
	let renameTarget: WebsharexEntry | null = null;
	let shareTarget: WebsharexEntry | null = null;
	let sharePassword = '';
	let shareExpiry = '';
	let shareEnabled = false;
	let shareCopyStatus: 'idle' | 'copied' | 'error' = 'idle';
	let showPassword = false;
	let passwordCopyStatus: 'idle' | 'copied' | 'error' = 'idle';
	let deleteError = '';
	let lastRoomName = '';
	let sortBy: 'name' | 'size' | 'time' = 'name';
	let sortOrder: 'asc' | 'desc' = 'asc';
	let isDraggingOver = false;
	let isSyncing = false;
	let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

	const origin = browser ? window.location.origin : '';

	const resetShareForm = () => {
		shareEnabled = !!(shareTarget && shareTarget.type === 'file' && shareTarget.shareToken);
		sharePassword =
			shareTarget && shareTarget.type === 'file' && shareTarget.sharedPassword
				? shareTarget.sharedPassword
				: '';
		shareExpiry =
			shareTarget && shareTarget.type === 'file' && shareTarget.expiresAt
				? shareTarget.expiresAt.slice(0, 16)
				: '';
		shareCopyStatus = 'idle';
	};

	$: roomName = $roomNameStore;
	$: room = $roomStateStore;
	$: folderEntries = (() => {
		let entries = $entriesStore;
		const folders = entries.filter((e) => e.type === 'folder');
		const files = entries.filter((e) => e.type === 'file');

		const sortFn = (a: WebsharexEntry, b: WebsharexEntry) => {
			let comparison = 0;
			if (sortBy === 'name') {
				comparison = a.name.localeCompare(b.name, 'zh-CN');
			} else if (sortBy === 'size') {
				const aSize = a.type === 'file' ? a.size : calculateFolderSize(a.id);
				const bSize = b.type === 'file' ? b.size : calculateFolderSize(b.id);
				comparison = aSize - bSize;
			} else if (sortBy === 'time') {
				comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
			}
			return sortOrder === 'asc' ? comparison : -comparison;
		};

		return [...folders.sort(sortFn), ...files.sort(sortFn)];
	})();
	$: breadcrumbs = $breadcrumbsStore;
	$: roomPassword = room?.password ?? '';
	$: maskedPassword = roomPassword
		? '*'.repeat(Math.max(roomPassword.length, 6))
		: '******';
	$: if (roomName && roomName !== lastRoomName) {
		lastRoomName = roomName;
		showPassword = false;
		passwordCopyStatus = 'idle';
		deleteError = '';
		if (browser) {
			syncWithOSS().catch(err => console.error('Auto sync failed:', err));
		}
	} else if (!roomName && lastRoomName) {
		lastRoomName = '';
		showPassword = false;
		passwordCopyStatus = 'idle';
		deleteError = '';
	}

	$: displayRoomName = room?.name ?? roomName;

	$: renameValue = renameTarget?.name ?? '';

	function calculateFolderSize(folderId: string): number {
		if (!room) return 0;
		
		let totalSize = 0;
		
		// 递归计算文件夹大小
		const calculateRecursive = (parentId: string | null) => {
			const children = room.entries.filter(e => e.parentId === parentId);
			
			for (const child of children) {
				if (child.type === 'file') {
					totalSize += child.size || 0;
				} else if (child.type === 'folder') {
					// 递归计算子文件夹
					calculateRecursive(child.id);
				}
			}
		};
		
		calculateRecursive(folderId);
		return totalSize;
	}

	function ensureRoomAvailable() {
		return Boolean(roomName && room);
	}

	function toggleSort(column: 'name' | 'size' | 'time') {
		if (sortBy === column) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = column;
			sortOrder = 'asc';
		}
	}

	function handleFilesSelected(event: Event) {
		if (!ensureRoomAvailable()) return;
		const target = event.target as HTMLInputElement;
		if (target.files) {
			void websharexStore.uploadFiles(roomName, target.files);
			target.value = '';
		}
	}

	function handleDrop(event: DragEvent) {
		if (!ensureRoomAvailable()) return;
		event.preventDefault();
		isDraggingOver = false;
		if (event.dataTransfer?.files?.length) {
			void websharexStore.uploadFiles(roomName, event.dataTransfer.files);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDraggingOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDraggingOver = false;
	}

	function createFolder() {
		if (!ensureRoomAvailable()) return;
		if (!folderName.trim()) return;
		websharexStore.createFolder(roomName, folderName.trim());
		folderName = '';
		showCreateFolder = false;
	}

	function startRename(entry: WebsharexEntry) {
		renameTarget = entry;
	}

	function submitRename() {
		if (!ensureRoomAvailable()) return;
		if (!renameTarget) return;
		const nextName = renameValue.trim();
		if (!nextName) return;
		websharexStore.renameEntry(roomName, renameTarget.id, nextName);
		renameTarget = null;
	}

	function cancelRename() {
		renameTarget = null;
	}

	function confirmDelete(entry: WebsharexEntry) {
		if (!ensureRoomAvailable()) return;
		const message =
			entry.type === 'folder' ? '确定要删除该文件夹及其全部内容吗？' : '确定要删除该文件吗？';
		if (confirm(message)) {
			websharexStore.deleteEntry(roomName, entry.id);
		}
	}

	function openShare(entry: WebsharexEntry) {
		if (entry.type !== 'file') return;
		shareTarget = entry;
		resetShareForm();
	}

	function closeShare() {
		shareTarget = null;
		shareEnabled = false;
		sharePassword = '';
		shareExpiry = '';
		shareCopyStatus = 'idle';
	}

	function submitShare() {
		if (!ensureRoomAvailable()) return;
		if (!shareTarget || shareTarget.type !== 'file') return;
		const expiresAt = shareExpiry ? new Date(shareExpiry).toISOString() : null;
		const password = sharePassword.trim() || null;
		websharexStore.setShareOptions(roomName, shareTarget.id, {
			enabled: shareEnabled,
			expiresAt,
			sharedPassword: password
		});
		closeShare();
	}

	function navigateToFolder(id: string | null) {
		if (!ensureRoomAvailable()) return;
		websharexStore.setCurrentFolder(roomName, id);
	}

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	async function copyRoomPassword() {
		if (!roomPassword) return;
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(roomPassword);
			} else {
				const area = document.createElement('textarea');
				area.value = roomPassword;
				area.setAttribute('readonly', '');
				area.style.position = 'absolute';
				area.style.left = '-9999px';
				document.body.appendChild(area);
				area.select();
				document.execCommand('copy');
				document.body.removeChild(area);
			}
			passwordCopyStatus = 'copied';
		} catch (error) {
			console.error('Failed to copy room password', error);
			passwordCopyStatus = 'error';
		}
		setTimeout(() => {
			passwordCopyStatus = 'idle';
		}, 2000);
	}

	async function deleteCurrentRoom() {
		if (!ensureRoomAvailable()) return;
		deleteError = '';
		const confirmed = confirm(
			`确定要删除房间 “${roomName}” 吗？此操作将移除房间及其所有文件。`
		);
		if (!confirmed) return;
		const success = websharexStore.deleteRoom(roomName);
		if (!success) {
			deleteError = '删除失败，房间可能已被移除。';
			return;
		}
		await goto('/websharex/rooms');
	}

	function formatBytes(size: number) {
		if (size === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
		const value = size / Math.pow(1024, index);
		return `${value.toFixed(value > 9 ? 0 : 1)} ${units[index]}`;
	}

	function isExpired(entry: WebsharexEntry) {
		if (entry.type !== 'file' || !entry.expiresAt) return false;
		return new Date(entry.expiresAt).getTime() < Date.now();
	}

	async function copyShareLink(link: string) {
		if (!link) return;
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(link);
			} else {
				const area = document.createElement('textarea');
				area.value = link;
				area.setAttribute('readonly', '');
				area.style.position = 'absolute';
				area.style.left = '-9999px';
				document.body.appendChild(area);
				area.select();
				document.execCommand('copy');
				document.body.removeChild(area);
			}
			shareCopyStatus = 'copied';
		} catch (error) {
			console.error('Failed to copy share link', error);
			shareCopyStatus = 'error';
		}

		setTimeout(() => {
			shareCopyStatus = 'idle';
		}, 2000);
	}

	async function syncWithOSS() {
		if (!ensureRoomAvailable() || isSyncing) return;
		isSyncing = true;
		
		try {
			await websharexStore.syncRoom(roomName);
		} catch (error) {
			console.error('Sync failed:', error);
		} finally {
			isSyncing = false;
		}
	}

	// 启动自动同步定时器
	onMount(() => {
		setTimeout(() => {
			if (browser && roomName) {
				syncWithOSS().catch(err => console.error('Initial sync failed:', err));
				
				autoSyncInterval = setInterval(() => {
					syncWithOSS().catch(err => console.error('Auto sync failed:', err));
				}, 5000);
			}
		}, 100);
	});

	onDestroy(() => {
		if (autoSyncInterval) {
			clearInterval(autoSyncInterval);
			autoSyncInterval = null;
		}
	});

	$: encodedRoom = encodeURIComponent(roomName);
	$: shareLink =
		shareTarget && shareTarget.type === 'file' && shareTarget.shareToken
			? `${origin}/websharex/${encodedRoom}/share/${shareTarget.shareToken}`
			: '';
</script>

<svelte:head>
	<title>{displayRoomName ? `${displayRoomName} | WebShareX` : 'WebShareX | IdeaFlash'}</title>
</svelte:head>

{#if !roomName}
	<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
		<h1 class="text-2xl font-semibold">未指定房间</h1>
		<p class="text-muted-foreground">请返回房间列表后重新进入。</p>
		<button
			type="button"
			class="rounded bg-primary px-4 py-2 text-primary-foreground"
			on:click={() => goto('/websharex/rooms')}
		>
			返回房间列表
		</button>
	</div>
{:else if !room}
	<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
		<h1 class="text-2xl font-semibold">房间不存在</h1>
		<p class="text-muted-foreground">可能被删除或尚未创建，请返回房间列表。</p>
		<button
			type="button"
			class="rounded bg-primary px-4 py-2 text-primary-foreground"
			on:click={() => goto('/websharex/rooms')}
		>
			返回房间列表
		</button>
	</div>
{:else}
	<div class="space-y-6 py-6">
		<!-- 房间密码和操作按钮 -->
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<span class="text-xs font-semibold">房间密码</span>
				{#if roomPassword}
					<span class="rounded bg-muted px-2 py-1 font-mono text-sm text-foreground">
						{showPassword ? roomPassword : maskedPassword}
					</span>
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
						on:click={togglePasswordVisibility}
					>
						<Icon
							icon={showPassword ? 'mdi:eye-off-outline' : 'mdi:eye-outline'}
							class="h-4 w-4"
						/>
						{showPassword ? '隐藏' : '显示'}
					</button>
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
						on:click={copyRoomPassword}
					>
						<Icon icon="mdi:content-copy" class="h-3.5 w-3.5" />
						{passwordCopyStatus === 'copied'
							? '已复制'
							: passwordCopyStatus === 'error'
								? '复制失败'
								: '复制'}
					</button>
				{:else}
					<span class="rounded bg-muted px-2 py-1 font-mono text-sm text-muted-foreground">
						未设置
					</span>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-2">

				<label
					class="inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-primary/50 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
				>
					<Icon icon="mdi:cloud-upload-outline" class="h-4 w-4" />
					<span>上传文件</span>
					<input class="hidden" type="file" multiple on:change={handleFilesSelected} />
				</label>

				<button
					type="button"
					class="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium hover:bg-muted"
					on:click={() => {
						showCreateFolder = true;
					}}
				>
					<Icon icon="mdi:folder-plus" class="h-4 w-4" />
					新建文件夹
				</button>

				<button
					type="button"
					class="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
					on:click={deleteCurrentRoom}
				>
					<Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
					删除房间
				</button>
			</div>
		</div>

		{#if deleteError}
			<div class="rounded border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
				{deleteError}
			</div>
		{/if}

		<div
			class="grid gap-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors {isDraggingOver ? 'border-primary bg-primary/5 border-2' : ''}"
			on:drop={handleDrop}
			on:dragover={handleDragOver}
			on:dragleave={handleDragLeave}
			role="region"
			aria-label="拖拽文件上传区域"
		>
			<Icon icon="mdi:inbox-arrow-down" class="mx-auto h-10 w-10 {isDraggingOver ? 'text-primary scale-110' : 'text-primary'} transition-transform" />
			<div class="font-medium {isDraggingOver ? 'text-primary' : 'text-foreground'} transition-colors">拖拽文件或文件夹至此上传</div>
		</div>

		<!-- 面包屑导航 -->
		<div class="flex flex-wrap items-center text-sm text-muted-foreground mb-2">
			<span class="pr-0">~/</span>
			<button
				type="button"
				class={`inline-flex items-center gap-1 rounded px-2 py-1 transition hover:bg-muted/60 ${
					room.currentFolderId === null ? 'font-medium text-foreground' : ''
				}`}
				on:click={() => navigateToFolder(null)}
			>
				{displayRoomName}
			</button>
			<Icon
				icon="mdi:chevron-right"
				class={`h-4 w-4 ml-1 ${breadcrumbs.length === 0 ? 'text-muted-foreground/40' : ''}`}
			/>
			{#if breadcrumbs.length === 0}
				<span class="inline-flex min-w-[1ch] px-2 py-1">&nbsp;</span>
			{:else}
				{#each breadcrumbs as crumb, index}
					<button
						type="button"
						class={`inline-flex items-center gap-1 rounded px-2 py-1 ml-1 transition hover:bg-muted/60 ${
							crumb.id === room.currentFolderId ? 'font-medium text-foreground' : ''
						}`}
						on:click={() => navigateToFolder(crumb.id)}
					>
						{crumb.name}
					</button>
					{#if index < breadcrumbs.length - 1}
						<Icon icon="mdi:chevron-right" class="h-4 w-4 ml-1" />
					{/if}
				{/each}
			{/if}
		</div>

		<div class="overflow-hidden rounded-lg border">
			<table class="min-w-full divide-y text-sm">
				<thead class="bg-muted/40">
					<tr class="text-left text-xs tracking-wider text-muted-foreground uppercase">
						<th class="px-4 py-3">
							<button
								type="button"
								class="inline-flex items-center gap-1 hover:text-foreground transition"
								on:click={() => toggleSort('name')}
							>
								名称
								{#if sortBy === 'name'}
									<Icon
										icon={sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'}
										class="h-3 w-3"
									/>
								{/if}
							</button>
						</th>
						<th class="hidden px-4 py-3 sm:table-cell">
							<button
								type="button"
								class="inline-flex items-center gap-1 hover:text-foreground transition"
								on:click={() => toggleSort('size')}
							>
								大小
								{#if sortBy === 'size'}
									<Icon
										icon={sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'}
										class="h-3 w-3"
									/>
								{/if}
							</button>
						</th>
						<th class="hidden px-4 py-3 md:table-cell">
							<button
								type="button"
								class="inline-flex items-center gap-1 hover:text-foreground transition"
								on:click={() => toggleSort('time')}
							>
								更新时间
								{#if sortBy === 'time'}
									<Icon
										icon={sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'}
										class="h-3 w-3"
									/>
								{/if}
							</button>
						</th>
						<th class="px-4 py-3">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#if folderEntries.length === 0}
						<tr>
							<td class="px-4 py-6 text-center text-muted-foreground" colspan="4"
								>暂无文件，尝试上传或创建文件夹。</td
							>
						</tr>
					{:else}
						{#each folderEntries as entry}
							<tr class="hover:bg-muted/40">
								<td class="px-4 py-3">
									<div class="flex items-center gap-3">
										{#if entry.type === 'folder'}
											<button
												type="button"
												class="flex items-center gap-2"
												on:click={() => navigateToFolder(entry.id)}
											>
												<Icon icon="mdi:folder" class="h-5 w-5 text-amber-500" />
												<span class="font-medium">{entry.name}</span>
											</button>
										{:else}
											<Icon icon="mdi:file-outline" class="h-5 w-5 text-sky-500" />
											<div class="flex flex-col">
												<span class={`font-medium ${isExpired(entry) ? 'text-destructive' : ''}`}
													>{entry.name}</span
												>
												{#if entry.type === 'file' && (entry.sharedPassword || entry.expiresAt || entry.shareToken)}
													<div
														class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
													>
														{#if entry.sharedPassword}
															<span
																class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"
															>
																<Icon icon="mdi:lock-outline" class="h-3 w-3" />
																密码
															</span>
														{/if}
														{#if entry.expiresAt}
															<span
																class={`inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 ${isExpired(entry) ? 'text-destructive' : ''}`}
															>
																<Icon icon="mdi:clock-outline" class="h-3 w-3" />
																{isExpired(entry)
																	? '已过期'
																	: new Date(entry.expiresAt).toLocaleString()}
															</span>
														{/if}
														{#if entry.shareToken}
															<span
																class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"
															>
																<Icon icon="mdi:link-variant" class="h-3 w-3" />
																{isExpired(entry) ? '分享失效' : '分享已启用'}
															</span>
														{/if}
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</td>
								<td class="hidden px-4 py-3 text-sm text-muted-foreground sm:table-cell">
									{#if entry.type === 'file'}
										{formatBytes(entry.size)}
									{:else}
										{formatBytes(calculateFolderSize(entry.id))}
									{/if}
								</td>
								<td class="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
									{new Date(entry.updatedAt).toLocaleString()}
								</td>
								<td class="px-4 py-3">
									<div class="flex flex-wrap items-center gap-2">
										{#if entry.type === 'file'}
											<button
												type="button"
												class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
												on:click={() => websharexStore.downloadFile(roomName, entry.id)}
											>
												<Icon icon="mdi:download" class="h-4 w-4" />
												下载
											</button>
											<button
												type="button"
												class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
												on:click={() => openShare(entry)}
											>
												<Icon icon="mdi:share-variant" class="h-4 w-4" />
												分享
											</button>
										{/if}
										<button
											type="button"
											class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
											on:click={() => startRename(entry)}
										>
											<Icon icon="mdi:rename-box" class="h-4 w-4" />
											重命名
										</button>
										<button
											type="button"
											class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
											on:click={() => confirmDelete(entry)}
										>
											<Icon icon="mdi:trash-can-outline" class="h-4 w-4" />
											删除
										</button>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		{#if renameTarget}
			<div class="fixed inset-0 flex items-center justify-center bg-background/70 backdrop-blur">
				<div class="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-lg">
					<h2 class="text-lg font-semibold">重命名</h2>
					<input
						class="w-full rounded border px-3 py-2"
						type="text"
						bind:value={renameValue}
						on:keydown={(event) => {
							if (event.key === 'Enter') {
								submitRename();
							}
						}}
					/>
					<div class="flex justify-end gap-2 text-sm">
						<button class="rounded border px-3 py-2" on:click={cancelRename}>取消</button>
						<button
							class="rounded bg-primary px-3 py-2 text-primary-foreground"
							on:click={submitRename}
						>
							保存
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if showCreateFolder}
			<div class="fixed inset-0 flex items-center justify-center bg-background/70 backdrop-blur">
				<div class="w-full max-w-sm space-y-4 rounded-lg border bg-background p-6 shadow-lg">
					<h2 class="text-lg font-semibold">新建文件夹</h2>
					<input
						class="w-full rounded border px-3 py-2"
						type="text"
						placeholder="输入文件夹名称"
						bind:value={folderName}
						on:keydown={(event) => {
							if (event.key === 'Enter') {
								createFolder();
							}
						}}
					/>
					<div class="flex justify-end gap-2 text-sm">
						<button class="rounded border px-3 py-2" on:click={() => (showCreateFolder = false)}
							>取消</button
						>
						<button
							class="rounded bg-primary px-3 py-2 text-primary-foreground"
							on:click={createFolder}
						>
							创建
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if shareTarget}
			<div class="fixed inset-0 flex items-center justify-center bg-background/70 backdrop-blur">
				<div class="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg">
					<h2 class="text-lg font-semibold">文件分享设置</h2>
					<p class="text-sm text-muted-foreground">配置临时分享密码、过期时间及分享状态。</p>
					<div class="space-y-3 text-sm">
						<label class="flex items-center gap-2">
							<input type="checkbox" class="h-4 w-4" bind:checked={shareEnabled} />
							<span class="font-medium">启用分享链接</span>
						</label>
						<label class="flex flex-col gap-1">
							<span>访问密码（可选）</span>
							<input
								class="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:bg-muted/50"
								type="text"
								bind:value={sharePassword}
								disabled={!shareEnabled}
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span>过期时间（可选）</span>
							<input
								class="rounded border px-3 py-2 disabled:cursor-not-allowed disabled:bg-muted/50"
								type="datetime-local"
								bind:value={shareExpiry}
								disabled={!shareEnabled}
							/>
						</label>
						{#if shareEnabled}
							<div class="space-y-2 rounded border px-3 py-2">
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<Icon icon="mdi:information-outline" class="h-4 w-4" />
									链接会在保存后生成或更新。
								</div>
								{#if shareLink}
									<div class="flex items-center gap-2 text-xs">
										<span class="truncate">{shareLink}</span>
										<button
											type="button"
											class="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-muted"
											on:click={() => copyShareLink(shareLink)}
										>
											<Icon icon="mdi:content-copy" class="h-3.5 w-3.5" />
											{shareCopyStatus === 'copied'
												? '已复制'
												: shareCopyStatus === 'error'
													? '复制失败'
													: '复制链接'}
										</button>
									</div>
								{:else}
									<div class="text-xs text-muted-foreground">保存后将生成新的分享链接。</div>
								{/if}
							</div>
						{/if}
					</div>
					<div class="flex justify-end gap-2 text-sm">
						<button class="rounded border px-3 py-2" on:click={closeShare}>取消</button>
						<button
							class="rounded bg-primary px-3 py-2 text-primary-foreground"
							on:click={submitShare}
						>
							保存设置
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
