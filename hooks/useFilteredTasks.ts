import { useMemo } from 'react';
import { TaskWithSource } from '../store/tasks';
import { filterTasks } from '../utils/taskFilter';

export function useFilteredTasks(
    tasks: TaskWithSource[],
    search: string,
    showCompleted: boolean,
    sortBy: 'smart' | 'file' | 'title' | 'priority'
) {
    return useMemo(() => {
        let result = filterTasks(tasks, search, showCompleted);

        if (sortBy === 'file') return result;

        const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const statusOrder: Record<string, number> = { ' ': 0, '/': 0, '>': 1, '?': 1, 'x': 2, '-': 2 };

        return [...result].sort((a, b) => {
            if (sortBy === 'title') return a.title.localeCompare(b.title);
            if (sortBy === 'priority') {
                const pA = priorityMap[a.properties.priority] ?? 0;
                const pB = priorityMap[b.properties.priority] ?? 0;
                if (pA !== pB) return pB - pA;
                return a.title.localeCompare(b.title);
            }

            // Default Smart Sort
            const sA = statusOrder[a.status] ?? 3;
            const sB = statusOrder[b.status] ?? 3;
            if (sA !== sB) return sA - sB;

            const pA = priorityMap[a.properties.priority] ?? 0;
            const pB = priorityMap[b.properties.priority] ?? 0;
            if (pA !== pB) return pB - pA;

            return a.title.localeCompare(b.title);
        });
    }, [tasks, search, showCompleted, sortBy]);
}
