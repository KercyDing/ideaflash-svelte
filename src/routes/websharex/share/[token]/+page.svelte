<script lang="ts">
	import Icon from '@iconify/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { websharexStore } from '$lib/websharex/store';

	let redirecting = true;
	let error = '';

	$: token = $page.params.token;

	onMount(() => {
		if (!token) {
			error = '分享链接无效';
			redirecting = false;
			return;
		}

		const result = websharexStore.findEntryByShareToken(token);
		if (!result) {
			error = '文件不存在或分享已失效';
			redirecting = false;
			return;
		}

		goto(`/websharex/${encodeURIComponent(result.roomName)}/share/${token}`);
	});
</script>

<svelte:head>
	<title>文件分享 | WebShareX</title>
</svelte:head>

<div class="min-h-screen bg-background py-12">
	<div class="container mx-auto max-w-2xl px-4">
		{#if redirecting}
			<div class="flex flex-col items-center gap-4 text-center">
				<Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-primary" />
				<p class="text-muted-foreground">正在跳转到更新后的分享地址...</p>
			</div>
		{:else}
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
		{/if}
	</div>
</div>
