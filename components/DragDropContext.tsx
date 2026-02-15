import React, { createContext, useContext, ReactNode } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

export interface DragDropContextType {
  isDragging: SharedValue<boolean>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  dragData: SharedValue<any>;
}

export const DragDropContext = createContext<DragDropContextType | null>(null);

export const DragDropProvider = ({ children }: { children: ReactNode }) => {
  const isDragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragData = useSharedValue<any>(null);

  return (
    <DragDropContext.Provider value={{ isDragging, dragX, dragY, dragData }}>
      {children}
    </DragDropContext.Provider>
  );
};

export const useDragDrop = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
};
