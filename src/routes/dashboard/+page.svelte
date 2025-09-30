<script lang="ts">
	import Icon from '@iconify/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { derived } from 'svelte/store';
	import { Chart, type ChartConfiguration, registerables } from 'chart.js';
	import { websharexStore } from '$lib/websharex/store';
	import type { FileEntry } from '$lib/websharex/types';

	Chart.register(...registerables);

	const statsStore = derived(websharexStore, ($state) => {
		const rooms = Object.values($state.rooms ?? {});
		const files = rooms.flatMap((room) =>
			room.entries.filter((entry): entry is FileEntry => entry.type === 'file')
		);
		const folders = rooms.reduce(
			(sum, room) => sum + room.entries.filter((entry) => entry.type === 'folder').length,
			0
		);
		const totalSize = files.reduce((sum, file) => sum + file.size, 0);
		const recentFiles = files
			.slice()
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 5);

		const uploadsByDate = files.reduce<Record<string, number>>((acc, file) => {
			const date = new Date(file.createdAt).toISOString().slice(0, 10);
			acc[date] = (acc[date] ?? 0) + 1;
			return acc;
		}, {});

		const types = files.reduce<Record<string, number>>((acc, file) => {
			const key = file.mimeType.split('/')[0] ?? 'other';
			acc[key] = (acc[key] ?? 0) + 1;
			return acc;
		}, {});

		return {
			files,
			totalFiles: files.length,
			totalFolders: folders,
			totalSize,
			recentFiles,
			uploadsByDate,
			types
		};
	});

	$: stats = $statsStore;

	let trendCanvas: HTMLCanvasElement | null = null;
	let typeCanvas: HTMLCanvasElement | null = null;

	let trendChart: Chart | null = null;
	let typeChart: Chart | null = null;

	function formatBytes(size: number) {
		if (size === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
		const value = size / Math.pow(1024, index);
		return `${value.toFixed(value > 9 ? 0 : 1)} ${units[index]}`;
	}

	function buildTrendConfig(): ChartConfiguration<'line'> {
		const labels = Object.keys(stats.uploadsByDate).sort();
		return {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: '每日上传文件数',
						data: labels.map((label) => stats.uploadsByDate[label]),
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.2)',
						fill: true,
						tension: 0.3
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: true },
					title: { display: false }
				},
				scales: {
					y: { beginAtZero: true, ticks: { precision: 0 } }
				}
			}
		};
	}

	function buildTypeConfig(): ChartConfiguration<'doughnut'> {
		const labels = Object.keys(stats.types);
		return {
			type: 'doughnut',
			data: {
				labels,
				datasets: [
					{
						label: '文件类型分布',
						data: labels.map((label) => stats.types[label]),
						backgroundColor: [
							'rgba(59, 130, 246, 0.6)',
							'rgba(16, 185, 129, 0.6)',
							'rgba(245, 158, 11, 0.6)',
							'rgba(236, 72, 153, 0.6)',
							'rgba(107, 114, 128, 0.6)'
						],
						borderWidth: 1
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { position: 'bottom' }
				}
			}
		};
	}

	function renderCharts() {
		if (trendCanvas) {
			trendChart?.destroy();
			trendChart = new Chart(trendCanvas, buildTrendConfig());
		}
		if (typeCanvas) {
			typeChart?.destroy();
			typeChart = new Chart(typeCanvas, buildTypeConfig());
		}
	}

	$: if (trendCanvas && typeCanvas) {
		renderCharts();
	}

	onMount(() => {
		renderCharts();
	});

	onDestroy(() => {
		trendChart?.destroy();
		typeChart?.destroy();
	});
</script>

<svelte:head>
	<title>数据看板 | IdeaFlash</title>
</svelte:head>

<div class="space-y-8 py-6">
	<div>
		<h1 class="text-3xl font-bold">数据看板</h1>
		<p class="text-muted-foreground">掌握 WebShareX 的使用情况与关键指标。</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-lg border p-4">
			<div class="flex items-center justify-between text-sm text-muted-foreground">
				<span>总文件数</span>
				<Icon icon="mdi:file-outline" class="h-4 w-4" />
			</div>
			<div class="mt-2 text-2xl font-semibold">{stats.totalFiles}</div>
		</div>
		<div class="rounded-lg border p-4">
			<div class="flex items-center justify-between text-sm text-muted-foreground">
				<span>总文件夹</span>
				<Icon icon="mdi:folder" class="h-4 w-4" />
			</div>
			<div class="mt-2 text-2xl font-semibold">{stats.totalFolders}</div>
		</div>
		<div class="rounded-lg border p-4">
			<div class="flex items-center justify-between text-sm text-muted-foreground">
				<span>总占用空间</span>
				<Icon icon="mdi:database" class="h-4 w-4" />
			</div>
			<div class="mt-2 text-2xl font-semibold">{formatBytes(stats.totalSize)}</div>
		</div>
		<div class="rounded-lg border p-4">
			<div class="flex items-center justify-between text-sm text-muted-foreground">
				<span>最近上传</span>
				<Icon icon="mdi:clock-outline" class="h-4 w-4" />
			</div>
			<div class="mt-2 text-2xl font-semibold">
				{stats.recentFiles.length > 0
					? new Date(stats.recentFiles[0].createdAt).toLocaleString()
					: '暂无'}
			</div>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<div class="space-y-4 rounded-lg border p-4">
			<div>
				<h2 class="text-lg font-semibold">每日上传趋势</h2>
				<p class="text-sm text-muted-foreground">观察最近上传活跃度。</p>
			</div>
			{#if Object.keys(stats.uploadsByDate).length === 0}
				<p class="py-12 text-center text-sm text-muted-foreground">
					暂无线上数据，上传文件后查看趋势。
				</p>
			{:else}
				<div class="relative">
					<canvas bind:this={trendCanvas} aria-label="每日上传趋势图"></canvas>
					<p class="sr-only">每日上传趋势图</p>
				</div>
			{/if}
		</div>
		<div class="space-y-4 rounded-lg border p-4">
			<div>
				<h2 class="text-lg font-semibold">文件类型分布</h2>
				<p class="text-sm text-muted-foreground">了解存储内容的类型构成。</p>
			</div>
			{#if Object.keys(stats.types).length === 0}
				<p class="py-12 text-center text-sm text-muted-foreground">暂无数据可展示。</p>
			{:else}
				<div class="relative">
					<canvas bind:this={typeCanvas} aria-label="文件类型分布图"></canvas>
					<p class="sr-only">文件类型分布图</p>
				</div>
			{/if}
		</div>
	</div>

	<div class="rounded-lg border">
		<div class="border-b px-4 py-3">
			<h2 class="text-lg font-semibold">最新上传</h2>
		</div>
		<div class="divide-y">
			{#if stats.recentFiles.length === 0}
				<p class="px-4 py-6 text-center text-sm text-muted-foreground">尚无上传记录。</p>
			{:else}
				{#each stats.recentFiles as file}
					<div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm">
						<div class="flex items-center gap-2">
							<Icon icon="mdi:file-outline" class="h-5 w-5 text-primary" />
							<div>
								<div class="font-medium">{file.name}</div>
								<div class="text-xs text-muted-foreground">{file.mimeType || '未知类型'}</div>
							</div>
						</div>
						<div class="text-xs text-muted-foreground">
							{new Date(file.createdAt).toLocaleString()} • {formatBytes(file.size)}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
