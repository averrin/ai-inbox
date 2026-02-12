import { RichTask } from './taskParser';

export function filterTasks<T extends RichTask>(tasks: T[], search: string, showCompleted: boolean): T[] {
    return tasks.filter(task => {
        const isDone = task.status === 'x' || task.status === '-';
        const matchesStatus = isDone === showCompleted;
        const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) ||
            task.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
        return matchesStatus && matchesSearch;
    });
}
