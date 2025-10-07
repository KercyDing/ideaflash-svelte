<script lang="ts">
	import { uploadProgress } from '$lib/websharex/upload-progress';
	import { CheckCircle2, XCircle, Loader2 } from 'lucide-svelte';
</script>

{#if $uploadProgress.length > 0}
	<div class="fixed right-4 bottom-4 z-50 flex flex-col gap-2 max-w-sm">
		{#each $uploadProgress.slice(0, 5) as task (task.id)}
			<div class="bg-background border rounded-lg shadow-lg p-3 animate-in slide-in-from-right">
				<div class="flex items-center gap-3">
					{#if task.status === 'uploading'}
						<Loader2 class="w-5 h-5 animate-spin text-blue-500" />
					{:else if task.status === 'success'}
						<CheckCircle2 class="w-5 h-5 text-green-500" />
					{:else}
						<XCircle class="w-5 h-5 text-red-500" />
					{/if}
					
					<div class="flex-1 min-w-0">
						<p class="text-sm font-medium truncate">{task.fileName}</p>
						<p class="text-xs text-muted-foreground mt-0.5">
							{#if task.status === 'uploading'}
								正在上传...
							{:else if task.status === 'success'}
								上传成功
							{:else}
								上传失败
							{/if}
						</p>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
