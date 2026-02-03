import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RichTask } from '../utils/taskParser';

export interface TaskWithSource extends RichTask {
    filePath: string;
    fileName: string;
    fileUri: string;
}

interface TasksState {
    tasksRoot: string;
    setTasksRoot: (path: string) => void;
    tasks: TaskWithSource[];
    setTasks: (tasks: TaskWithSource[]) => void;
    lastSynced: number;
    setLastSynced: (timestamp: number) => void;
}

export const useTasksStore = create<TasksState>()(
    persist(
        (set) => ({
            tasksRoot: '',
            setTasksRoot: (path) => set({ tasksRoot: path }),
            tasks: [],
            setTasks: (tasks) => set({ tasks }),
            lastSynced: 0,
            setLastSynced: (timestamp) => set({ lastSynced: timestamp }),
        }),
        {
            name: 'tasks-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
