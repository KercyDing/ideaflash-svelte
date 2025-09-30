<script>
	import '../app.css';
	import Icon from '@iconify/svelte';
</script>

<div class="flex min-h-screen flex-col">
	<header class="border-b">
		<div class="container mx-auto flex h-16 items-center px-4 sm:px-6">
			<a href="/" class="flex items-center space-x-2">
				<span class="text-xl font-bold">IdeaFlash</span>
				<span class="text-sm text-muted-foreground">闪念集</span>
			</a>
			<nav class="ml-auto flex items-center space-x-4">
				<a href="/websharex" class="text-sm font-medium hover:underline">WebShareX</a>
				<a href="/dashboard" class="text-sm font-medium hover:underline">DataBoard</a>
			</nav>
		</div>
	</header>

	<main class="container mx-auto flex-1 px-4 py-6 sm:px-6">
		<slot />
	</main>

	<footer class="border-t py-4">
		<div class="container mx-auto flex flex-col items-center gap-2 px-4 text-center sm:px-6">
			<a
				href="https://github.com/KercyDing/ideaflash-svelte"
				target="_blank"
				rel="noreferrer"
				class="text-muted-foreground transition hover:text-foreground"
			>
				<Icon icon="mdi:github-circle" class="h-6 w-6" />
				<span class="sr-only">GitHub</span>
			</a>
			<p class="text-xs text-muted-foreground">
				Copyright © 2025-2026 Kercy. All rights reserved.
			</p>
		</div>
	</footer>
</div>
