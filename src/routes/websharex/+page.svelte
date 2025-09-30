<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/websharex/rooms');
	});
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
	<h1 class="text-2xl font-semibold">正在跳转到房间列表...</h1>
	<button
		type="button"
		class="rounded bg-primary px-4 py-2 text-primary-foreground"
		on:click={() => goto('/websharex/rooms')}
	>
		立即前往
	</button>
</div>
