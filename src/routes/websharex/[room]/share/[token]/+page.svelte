<script lang="ts">
	import Icon from '@iconify/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { websharexStore } from '$lib/websharex/store';
	import type { FileEntry } from '$lib/websharex/types';

	let roomName = '';
	let token = '';
	let fileEntry: FileEntry | null = null;
	let loading = true;
	let error = '';
	let passwordInput = '';
	let passwordRequired = false;
	let showPasswordForm = false;

	$: roomParam = $page.params.room ?? '';
	$: roomName = decodeURIComponent(roomParam);
	$: token = $page.params.token ?? '';

	onMount(() => {
		loadFile();
	});

	function loadFile() {
		loading = true;
		error = '';
		fileEntry = null;
		passwordRequired = false;
		showPasswordForm = false;

		if (!token || !roomName) {
			error = '分享链接无效';
			loading = false;
			return;
		}

		const entry = websharexStore.getEntryByShareToken(roomName, token);
		if (!entry) {
			error = '文件不存在或分享已失效';
			loading = false;
			return;
		}

		if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
			error = '分享链接已过期';
			loading = false;
			return;
		}

		if (entry.sharedPassword) {
			passwordRequired = true;
			showPasswordForm = true;
			loading = false;
			return;
		}

		fileEntry = entry;
		loading = false;
	}

	function verifyPassword() {
		if (!token || !roomName) return;

		const entry = websharexStore.getEntryByShareToken(roomName, token);
		if (!entry) {
			error = '文件不存在';
			return;
		}

		if (entry.sharedPassword !== passwordInput.trim()) {
			error = '密码错误';
			return;
		}

		fileEntry = entry;
		showPasswordForm = false;
		error = '';
	}

	function downloadFile() {
		if (!fileEntry || !roomName) return;
		websharexStore.downloadFile(roomName, fileEntry.id);
	}

	function formatBytes(size: number) {
		if (size === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
		const value = size / Math.pow(1024, index);
		return `${value.toFixed(value > 9 ? 0 : 1)} ${units[index]}`;
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleString();
	}
</script>

<svelte:head>
	<title>文件分享 | WebShareX</title>
</svelte:head>

<div class="min-h-screen bg-background py-12">
	<div class="container mx-auto max-w-2xl px-4">
		{#if loading}
			<div class="flex flex-col items-center gap-4 text-center">
				<Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-primary" />
				<p class="text-muted-foreground">加载中...</p>
			</div>
		{:else if error}
			<div class="flex flex-col items-center gap-4 text-center">
				<Icon icon="mdi:alert-circle-outline" class="h-12 w-12 text-destructive" />
				<h1 class="text-2xl font-bold text-destructive">访问失败</h1>
				<p class="text-muted-foreground">{error}</p>
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
					on:click={() => goto('/websharex/rooms')}
				>
					<Icon icon="mdi:arrow-left" class="h-4 w-4" />
					返回房间列表
				</button>
			</div>
		{:else if showPasswordForm}
			<div class="mx-auto max-w-md space-y-6 rounded-lg border bg-card p-6">
				<div class="text-center">
					<Icon icon="mdi:lock-outline" class="mx-auto h-12 w-12 text-primary" />
					<h1 class="mt-4 text-xl font-bold">需要访问密码</h1>
					<p class="mt-2 text-sm text-muted-foreground">此文件受密码保护，请输入正确的访问密码。</p>
				</div>

				<div class="space-y-4">
					<div>
						<label for="password" class="block text-sm font-medium">访问密码</label>
						<input
							id="password"
							type="password"
							class="mt-1 w-full rounded border px-3 py-2"
							bind:value={passwordInput}
							on:keydown={(event) => {
								if (event.key === 'Enter') {
									verifyPassword();
								}
							}}
							placeholder="请输入密码"
						/>
					</div>

					{#if error}
						<p class="text-sm text-destructive">{error}</p>
					{/if}

					<button
						type="button"
						class="w-full rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
						on:click={verifyPassword}
					>
						验证密码
					</button>
				</div>
			</div>
		{:else if fileEntry}
			<div class="space-y-6">
				<div class="text-center">
					<Icon icon="mdi:file-outline" class="mx-auto h-16 w-16 text-primary" />
					<h1 class="mt-4 text-2xl font-bold">{fileEntry.name}</h1>
					<p class="mt-2 text-muted-foreground">通过 WebShareX 房间 {roomName} 安全分享</p>
				</div>

				<div class="rounded-lg border bg-card p-6">
					<h2 class="mb-4 text-lg font-semibold">文件信息</h2>
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between">
							<dt class="text-muted-foreground">文件大小:</dt>
							<dd class="font-medium">{formatBytes(fileEntry.size)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">文件类型:</dt>
							<dd class="font-medium">{fileEntry.mimeType}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted-foreground">上传时间:</dt>
							<dd class="font-medium">{formatDate(fileEntry.createdAt)}</dd>
						</div>
						{#if fileEntry.expiresAt}
							<div class="flex justify-between">
								<dt class="text-muted-foreground">过期时间:</dt>
								<dd class="font-medium">{formatDate(fileEntry.expiresAt)}</dd>
							</div>
						{/if}
					</dl>
				</div>

				<div class="flex flex-col gap-3 sm:flex-row">
					<button
						type="button"
						class="inline-flex flex-1 items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-primary-foreground hover:bg-primary/90"
						on:click={downloadFile}
					>
						<Icon icon="mdi:download" class="h-5 w-5" />
						下载文件
					</button>
					<button
						type="button"
						class="inline-flex flex-1 items-center justify-center gap-2 rounded border px-4 py-3 hover:bg-muted"
						on:click={() => goto(`/websharex/${encodeURIComponent(roomName)}`)}
					>
						<Icon icon="mdi:folder-open-outline" class="h-5 w-5" />
						访问房间
					</button>
				</div>

				<div class="text-center text-xs text-muted-foreground">
					<p>此文件通过 IdeaFlash WebShareX 安全分享</p>
					<p class="mt-1">分享链接仅在设定的时间内有效</p>
				</div>
			</div>
		{/if}
	</div>
</div>
