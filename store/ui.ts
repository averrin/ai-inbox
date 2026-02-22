import { create } from 'zustand';

export interface AlertOption {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
}

export interface AlertState {
    visible: boolean;
    title: string;
    message?: string;
    options: AlertOption[];
}

export interface ErrorState {
    visible: boolean;
    title: string;
    error: string | Error;
    onClose?: () => void;
}

interface FabState {
    visible: boolean;
    icon: string;
    onPress: (() => void) | null;
    onLongPress?: (() => void) | null;
    color?: string; // Optional custom color
    iconColor?: string; // Optional custom icon color
}

interface UIState {
    fab: FabState;
    setFab: (fab: Partial<FabState>) => void;
    clearFab: () => void;

    alert: AlertState;
    setAlert: (alert: Partial<AlertState>) => void;
    clearAlert: () => void;

    error: ErrorState;
    setError: (error: Partial<ErrorState>) => void;
    clearError: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    fab: {
        visible: false,
        icon: 'add',
        onPress: null,
        onLongPress: null,
    },
    setFab: (fab) => set((state) => ({ fab: { ...state.fab, ...fab } })),
    clearFab: () => set({ fab: { visible: false, icon: 'add', onPress: null, onLongPress: null, color: undefined, iconColor: undefined } }),

    alert: {
        visible: false,
        title: '',
        message: '',
        options: [],
    },
    setAlert: (alert) => set((state) => ({ alert: { ...state.alert, ...alert, visible: true } })),
    clearAlert: () => set({ alert: { visible: false, title: '', message: '', options: [] } }),

    error: {
        visible: false,
        title: '',
        error: '',
    },
    setError: (error) => set((state) => ({ error: { ...state.error, ...error, visible: true } })),
    clearError: () => set({ error: { visible: false, title: '', error: '' } }),
}));
