import { create } from 'zustand';
import { TaskWithSource } from './tasks';

export interface NoteLink {
    fileUri: string;
    filePath: string;
    fileName: string;
    title: string;
}

export interface RelationData {
    tasks: TaskWithSource[];
    notes: NoteLink[];
}

interface RelationsState {
    // Map eventId -> RelationData
    relations: Record<string, RelationData>;
    // Map fileUri -> eventIds[] (reverse lookup for quick updates/badges on notes if needed)
    fileRelations: Record<string, string[]>;

    setRelations: (relations: Record<string, RelationData>) => void;

    addTaskLink: (eventId: string, task: TaskWithSource) => void;
    removeTaskLink: (eventId: string, task: TaskWithSource) => void;

    addNoteLink: (eventId: string, note: NoteLink) => void;
    removeNoteLink: (eventId: string, note: NoteLink) => void;

    updateTask: (oldTask: TaskWithSource, newTask: TaskWithSource) => void;
}

export const useRelationsStore = create<RelationsState>((set) => ({
    relations: {},
    fileRelations: {},

    setRelations: (relations) => {
        if (typeof relations === 'function') {
            console.error('[RelationsStore] setRelations called with a function! This store does not support functional updates.');
            return;
        }
        const fileRelations: Record<string, string[]> = {};

        Object.entries(relations).forEach(([eventId, data]) => {
            data.tasks.forEach(task => {
                if (!fileRelations[task.fileUri]) fileRelations[task.fileUri] = [];
                if (!fileRelations[task.fileUri].includes(eventId)) fileRelations[task.fileUri].push(eventId);
            });
            data.notes.forEach(note => {
                if (!fileRelations[note.fileUri]) fileRelations[note.fileUri] = [];
                if (!fileRelations[note.fileUri].includes(eventId)) fileRelations[note.fileUri].push(eventId);
            });
        });

        set({ relations, fileRelations });
    },

    addTaskLink: (eventId, task) => set((state) => {
        const current = state.relations[eventId] || { tasks: [], notes: [] };
        // Avoid duplicates
        if (current.tasks.some(t => t.fileUri === task.fileUri && t.originalLine === task.originalLine)) {
            return state;
        }

        const newRelations = {
            ...state.relations,
            [eventId]: {
                ...current,
                tasks: [...current.tasks, task]
            }
        };

        const newFileRelations = { ...state.fileRelations };
        if (!newFileRelations[task.fileUri]) newFileRelations[task.fileUri] = [];
        if (!newFileRelations[task.fileUri].includes(eventId)) newFileRelations[task.fileUri].push(eventId);

        return { relations: newRelations, fileRelations: newFileRelations };
    }),

    removeTaskLink: (eventId, task) => set((state) => {
        const current = state.relations[eventId];
        if (!current) return state;

        const newRelations = {
            ...state.relations,
            [eventId]: {
                ...current,
                tasks: current.tasks.filter(t => !(t.fileUri === task.fileUri && t.originalLine === task.originalLine))
            }
        };

        const remainingTasksInFile = newRelations[eventId].tasks.filter(t => t.fileUri === task.fileUri);
        const remainingNotesInFile = newRelations[eventId].notes.filter(n => n.fileUri === task.fileUri);

        let newFileRelations = { ...state.fileRelations };
        if (remainingTasksInFile.length === 0 && remainingNotesInFile.length === 0) {
            if (newFileRelations[task.fileUri]) {
                newFileRelations[task.fileUri] = newFileRelations[task.fileUri].filter(id => id !== eventId);
            }
        }

        return { relations: newRelations, fileRelations: newFileRelations };
    }),

    addNoteLink: (eventId, note) => set((state) => {
        const current = state.relations[eventId] || { tasks: [], notes: [] };
        if (current.notes.some(n => n.fileUri === note.fileUri)) return state;

        const newRelations = {
            ...state.relations,
            [eventId]: {
                ...current,
                notes: [...current.notes, note]
            }
        };

        const newFileRelations = { ...state.fileRelations };
        if (!newFileRelations[note.fileUri]) newFileRelations[note.fileUri] = [];
        if (!newFileRelations[note.fileUri].includes(eventId)) newFileRelations[note.fileUri].push(eventId);

        return { relations: newRelations, fileRelations: newFileRelations };
    }),

    removeNoteLink: (eventId, note) => set((state) => {
        const current = state.relations[eventId];
        if (!current) return state;

        const newRelations = {
            ...state.relations,
            [eventId]: {
                ...current,
                notes: current.notes.filter(n => n.fileUri !== note.fileUri)
            }
        };

        const remainingTasksInFile = newRelations[eventId].tasks.filter(t => t.fileUri === note.fileUri);
        const remainingNotesInFile = newRelations[eventId].notes.filter(n => n.fileUri === note.fileUri);

        let newFileRelations = { ...state.fileRelations };
        if (remainingTasksInFile.length === 0 && remainingNotesInFile.length === 0) {
            if (newFileRelations[note.fileUri]) {
                newFileRelations[note.fileUri] = newFileRelations[note.fileUri].filter(id => id !== eventId);
            }
        }

        return { relations: newRelations, fileRelations: newFileRelations };
    }),

    updateTask: (oldTask, newTask) => set((state) => {
        const eventIds = state.fileRelations[oldTask.fileUri] || [];
        if (eventIds.length === 0) return state;

        const newRelations = { ...state.relations };
        let hasChanges = false;

        eventIds.forEach(eventId => {
            const relation = newRelations[eventId];
            if (relation) {
                const taskIndex = relation.tasks.findIndex(t => t.originalLine === oldTask.originalLine);
                if (taskIndex !== -1) {
                    const newTasks = [...relation.tasks];
                    newTasks[taskIndex] = newTask;
                    newRelations[eventId] = { ...relation, tasks: newTasks };
                    hasChanges = true;
                }
            }
        });

        if (!hasChanges) return state;
        return { relations: newRelations };
    })
}));
