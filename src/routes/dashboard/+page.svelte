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

		const uploadsByDate = files.reduce<Record<string, number>>((acc, file) => {
			const date = new Date(file.createdAt).toISOString().slice(0, 10);
			acc[date] = (acc[date] ?? 0) + 1;
			return acc;
		}, {});

		const uploadsByWeek = files.reduce<Record<string, number>>((acc, file) => {
			const date = new Date(file.createdAt);
			const startOfYear = new Date(date.getFullYear(), 0, 1);
			const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
			const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
			const weekLabel = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
			acc[weekLabel] = (acc[weekLabel] ?? 0) + 1;
			return acc;
		}, {});

		const types = files.reduce<Record<string, number>>((acc, file) => {
			let category = '其他';
			const mime = file.mimeType.toLowerCase();
			
			if (mime.startsWith('image/')) {
				category = '图片';
			} else if (mime.startsWith('video/')) {
				category = '视频';
			} else if (mime.startsWith('audio/')) {
				category = '音频';
			} else if (mime.includes('pdf')) {
				category = 'PDF';
			} else if (
				mime.includes('word') ||
				mime.includes('document') ||
				mime.includes('msword') ||
				mime.includes('officedocument.wordprocessing')
			) {
				category = 'Word';
			} else if (
				mime.includes('excel') ||
				mime.includes('spreadsheet') ||
				mime.includes('ms-excel') ||
				mime.includes('officedocument.spreadsheet')
			) {
				category = 'Excel';
			} else if (
				mime.includes('powerpoint') ||
				mime.includes('presentation') ||
				mime.includes('ms-powerpoint') ||
				mime.includes('officedocument.presentation')
			) {
				category = 'PPT';
			} else if (mime.startsWith('text/')) {
				if (mime.includes('html')) {
					category = 'HTML';
				} else if (mime.includes('css')) {
					category = 'CSS';
				} else if (mime.includes('javascript') || mime.includes('js')) {
					category = 'JavaScript';
				} else {
					category = '文本文件';
				}
			} else if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar') || mime.includes('gz')) {
				category = '压缩文件';
			} else if (mime.includes('json')) {
				category = 'JSON';
			} else if (mime.includes('xml')) {
				category = 'XML';
			}
			
			acc[category] = (acc[category] ?? 0) + 1;
			return acc;
		}, {});

		return {
			files,
			totalFiles: files.length,
			totalFolders: folders,
			totalSize,
			uploadsByDate,
			uploadsByWeek,
			types
		};
	});

	$: stats = $statsStore;

	let dailyTrendCanvas: HTMLCanvasElement | null = null;
	let weeklyTrendCanvas: HTMLCanvasElement | null = null;
	let typeCanvas: HTMLCanvasElement | null = null;

	let dailyTrendChart: Chart | null = null;
	let weeklyTrendChart: Chart | null = null;
	let typeChart: Chart | null = null;

	function formatBytes(size: number) {
		if (size === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
		const value = size / Math.pow(1024, index);
		return `${value.toFixed(value > 9 ? 0 : 1)} ${units[index]}`;
	}

	function buildDailyTrendConfig(): ChartConfiguration<'line'> {
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

	function buildWeeklyTrendConfig(): ChartConfiguration<'line'> {
		const labels = Object.keys(stats.uploadsByWeek).sort();
		return {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: '每周上传文件数',
						data: labels.map((label) => stats.uploadsByWeek[label]),
						borderColor: 'rgb(16, 185, 129)',
						backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
		const colors = [
			'rgba(59, 130, 246, 0.7)',
			'rgba(16, 185, 129, 0.7)',
			'rgba(245, 158, 11, 0.7)',
			'rgba(236, 72, 153, 0.7)',
			'rgba(139, 92, 246, 0.7)',
			'rgba(239, 68, 68, 0.7)',
			'rgba(34, 197, 94, 0.7)',
			'rgba(251, 146, 60, 0.7)',
			'rgba(20, 184, 166, 0.7)',
			'rgba(168, 85, 247, 0.7)',
			'rgba(107, 114, 128, 0.7)',
			'rgba(252, 211, 77, 0.7)',
			'rgba(167, 139, 250, 0.7)',
			'rgba(248, 113, 113, 0.7)',
			'rgba(96, 165, 250, 0.7)'
		];
		return {
			type: 'doughnut',
			data: {
				labels,
				datasets: [
					{
						label: '文件类型分布',
						data: labels.map((label) => stats.types[label]),
						backgroundColor: labels.map((_, i) => colors[i % colors.length]),
						borderWidth: 1,
						borderColor: 'rgba(255, 255, 255, 0.8)'
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: { 
						position: 'bottom',
						labels: {
							padding: 10,
							font: {
								size: 11
							}
						}
					}
				}
			}
		};
	}

	function renderCharts() {
		if (dailyTrendCanvas) {
			dailyTrendChart?.destroy();
			dailyTrendChart = new Chart(dailyTrendCanvas, buildDailyTrendConfig());
		}
		if (weeklyTrendCanvas) {
			weeklyTrendChart?.destroy();
			weeklyTrendChart = new Chart(weeklyTrendCanvas, buildWeeklyTrendConfig());
		}
		if (typeCanvas) {
			typeChart?.destroy();
			typeChart = new Chart(typeCanvas, buildTypeConfig());
		}
	}

	$: if (dailyTrendCanvas && weeklyTrendCanvas && typeCanvas) {
		renderCharts();
	}

	onMount(() => {
		renderCharts();
	});

	onDestroy(() => {
		dailyTrendChart?.destroy();
		weeklyTrendChart?.destroy();
		typeChart?.destroy();
	});
</script>

<svelte:head>
	<title>DataBoard | IdeaFlash</title>
</svelte:head>

<div class="space-y-8 py-6">
	<div>
		<h1 class="text-3xl font-bold">DataBoard</h1>
		<p class="text-muted-foreground">WebShareX 使用情况可视化</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<div class="space-y-4 rounded-lg border p-4">
			<div>
				<h2 class="text-lg font-semibold">上传趋势</h2>
				<p class="text-sm text-muted-foreground">观察最近上传活跃度。</p>
			</div>
			{#if Object.keys(stats.uploadsByDate).length === 0}
				<p class="py-12 text-center text-sm text-muted-foreground">
					暂无线上数据，上传文件后查看趋势。
				</p>
			{:else}
				<div class="space-y-6">
					<div class="space-y-2">
						<h3 class="text-sm font-medium text-muted-foreground">每日趋势</h3>
						<div class="relative">
							<canvas bind:this={dailyTrendCanvas} aria-label="每日上传趋势图"></canvas>
							<p class="sr-only">每日上传趋势图</p>
						</div>
					</div>
					<div class="space-y-2">
						<h3 class="text-sm font-medium text-muted-foreground">每周趋势</h3>
						<div class="relative">
							<canvas bind:this={weeklyTrendCanvas} aria-label="每周上传趋势图"></canvas>
							<p class="sr-only">每周上传趋势图</p>
						</div>
					</div>
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
</div>
