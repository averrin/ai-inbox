import { create } from 'zustand';

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
}));
