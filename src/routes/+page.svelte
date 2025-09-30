<script>
	import Icon from '@iconify/svelte';
</script>

<div class="space-y-12 py-8">
	<section class="space-y-4 text-center">
		<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">IdeaFlash 闪念集</h1>
		<p class="mx-auto max-w-2xl text-xl text-muted-foreground">现代高效的 Web 工具集合</p>
	</section>

	<section class="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
		<div class="space-y-4 rounded-lg border p-6 transition-shadow hover:shadow-md">
			<h2 class="text-2xl font-bold">WebShareX</h2>
			<p class="text-muted-foreground">安全私密的文件传输和短时存储</p>
			<a href="/websharex/rooms" class="inline-flex items-center text-primary hover:underline">
				Start <Icon icon="mdi:arrow-right" class="ml-1 h-4 w-4" aria-hidden="true" />
			</a>
		</div>

		<div class="space-y-4 rounded-lg border p-6 transition-shadow hover:shadow-md">
			<h2 class="text-2xl font-bold">DataBoard</h2>
			<p class="text-muted-foreground">IdeaFlash 平台使用可视化看板</p>
			<a href="/dashboard" class="inline-flex items-center text-primary hover:underline">
				View <Icon icon="mdi:arrow-right" class="ml-1 h-4 w-4" aria-hidden="true" />
			</a>
		</div>
	</section>
</div>
