<script lang="ts">
	import Icon from '@iconify/svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { websharexStore } from '$lib/websharex/store';

	let createName = '';
	let createPassword = '';
	let createError = '';
	let joinName = '';
	let joinPassword = '';
	let joinError = '';
	let showPasswordReminder = false;
	let reminderMessage = '';

	const roomsStore = websharexStore.rooms;

	onMount(() => {
		createName = '';
		createPassword = '';
		joinName = '';
		joinPassword = '';
	});

	function resetReminder() {
		showPasswordReminder = false;
		reminderMessage = '';
	}

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		createError = '';
		resetReminder();

		const trimmedName = createName.trim();
		const trimmedPassword = createPassword.trim();

		if (!trimmedName) {
			createError = '请填写房间名';
			return;
		}

		try {
			const finalPassword = websharexStore.createRoom(trimmedName, trimmedPassword);
			if (!trimmedPassword) {
				showPasswordReminder = true;
				reminderMessage = `已为房间 “${trimmedName}” 生成随机密码：${finalPassword}`;
			} else {
				showPasswordReminder = true;
				reminderMessage = `房间 “${trimmedName}” 的密码为：${finalPassword}`;
			}

			createName = '';
			createPassword = '';

			await goto(`/websharex/${encodeURIComponent(trimmedName)}`);
		} catch (error) {
			createError = error instanceof Error ? error.message : '创建房间失败，请稍后重试';
		}
	}

	async function handleJoin(event: SubmitEvent) {
		event.preventDefault();
		joinError = '';
		resetReminder();

		const trimmedName = joinName.trim();
		const trimmedPassword = joinPassword.trim();

		if (!trimmedName || !trimmedPassword) {
			joinError = '请输入房间名和密码';
			return;
		}

		const ok = websharexStore.verifyRoomAccess(trimmedName, trimmedPassword);
		if (!ok) {
			joinError = '房间名或密码不正确';
			return;
		}

		joinName = '';
		joinPassword = '';

		await goto(`/websharex/${encodeURIComponent(trimmedName)}`);
	}
</script>

<svelte:head>
	<title>选择房间 | WebShareX</title>
</svelte:head>

<div class="space-y-8 py-8">
	<div class="space-y-2 text-center">
		<h1 class="text-3xl font-bold">选择或创建房间</h1>
		<p class="text-muted-foreground">
			房间是临时的共享空间，设置密码即可保护共享内容。
		</p>
	</div>

	{#if showPasswordReminder}
		<div class="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
			{reminderMessage}
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<section class="space-y-4 rounded-lg border p-6">
			<div class="space-y-1">
				<h2 class="text-xl font-semibold">新增房间</h2>
				<p class="text-sm text-muted-foreground">设置房间名，可选密码为空则自动生成。</p>
			</div>
			<form class="space-y-4" on:submit|preventDefault={handleCreate}>
				<label class="block space-y-1 text-sm">
					<span class="font-medium">房间名</span>
					<input
						class="w-full rounded border px-3 py-2"
						type="text"
						bind:value={createName}
						placeholder="请输入房间名"
						required
					/>
				</label>
				<label class="block space-y-1 text-sm">
					<span class="font-medium">访问密码（可选）</span>
					<input
						class="w-full rounded border px-3 py-2"
						type="text"
						bind:value={createPassword}
						placeholder="留空将自动生成 6 位密码"
					/>
				</label>
				{#if createError}
					<p class="text-sm text-destructive">{createError}</p>
				{/if}
				<button
					type="submit"
					class="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-primary-foreground"
				>
					<Icon icon="mdi:plus-circle" class="h-4 w-4" />
					创建并进入
				</button>
			</form>
		</section>

		<section class="space-y-4 rounded-lg border p-6">
			<div class="space-y-1">
				<h2 class="text-xl font-semibold">进入房间</h2>
				<p class="text-sm text-muted-foreground">输入房间名及密码加入现有房间。</p>
			</div>
			<form class="space-y-4" on:submit|preventDefault={handleJoin}>
				<label class="block space-y-1 text-sm">
					<span class="font-medium">房间名</span>
					<input
						class="w-full rounded border px-3 py-2"
						type="text"
						bind:value={joinName}
						placeholder="请输入房间名"
						required
					/>
				</label>
				<label class="block space-y-1 text-sm">
					<span class="font-medium">访问密码</span>
					<input
						class="w-full rounded border px-3 py-2"
						type="password"
						bind:value={joinPassword}
						placeholder="请输入密码"
						required
					/>
				</label>
				{#if joinError}
					<p class="text-sm text-destructive">{joinError}</p>
				{/if}
				<button
					type="submit"
					class="inline-flex items-center gap-2 rounded border px-4 py-2 text-sm font-medium hover:bg-muted"
				>
					<Icon icon="mdi:login" class="h-4 w-4" />
					进入房间
				</button>
			</form>
		</section>
	</div>

	<section class="space-y-4 rounded-lg border p-6">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold">房间列表</h2>
				<p class="text-sm text-muted-foreground">最近创建或访问过的房间。</p>
			</div>
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-muted"
				on:click={resetReminder}
			>
				<Icon icon="mdi:refresh" class="h-4 w-4" />
				刷新提示
			</button>
		</div>

		{#if $roomsStore.length === 0}
			<p class="py-8 text-center text-sm text-muted-foreground">当前还没有房间，先创建一个吧。</p>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each $roomsStore as room}
					<button
						type="button"
						class="flex flex-col items-start gap-2 rounded-lg border px-4 py-3 text-left transition hover:border-primary hover:shadow"
						on:click={() => goto(`/websharex/${encodeURIComponent(room.name)}`)}
					>
						<div class="flex w-full items-center justify-between text-sm text-muted-foreground">
							<span>房间</span>
							<Icon icon="mdi:chevron-right" class="h-4 w-4" />
						</div>
						<div class="text-lg font-semibold">{room.name}</div>
						<div class="text-xs text-muted-foreground">
							上次更新：{new Date(room.updatedAt).toLocaleString()}
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</section>
</div>
