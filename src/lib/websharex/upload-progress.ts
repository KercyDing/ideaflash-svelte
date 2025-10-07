import { writable } from 'svelte/store';
import { nanoid } from 'nanoid';

export interface UploadTask {
	id: string;
	fileName: string;
	status: 'uploading' | 'success' | 'error';
}

function createUploadProgressStore() {
	const { subscribe, update } = writable<UploadTask[]>([]);

	return {
		subscribe,
		addTask(fileName: string): string {
			const id = nanoid();
			update(tasks => {
				const newTasks = [...tasks, { id, fileName, status: 'uploading' as const }];
				return newTasks.slice(-5);
			});
			return id;
		},
		completeTask(id: string) {
			update(tasks => 
				tasks.map(task => 
					task.id === id ? { ...task, status: 'success' as const } : task
				)
			);
			setTimeout(() => {
				update(tasks => tasks.filter(task => task.id !== id));
			}, 3000);
		},
		failTask(id: string) {
			update(tasks => 
				tasks.map(task => 
					task.id === id ? { ...task, status: 'error' as const } : task
				)
			);
			
			setTimeout(() => {
				update(tasks => tasks.filter(task => task.id !== id));
			}, 5000);
		}
	};
}

export const uploadProgress = createUploadProgressStore();
