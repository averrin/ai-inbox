import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { useDragDrop } from './DragDropContext';
import { RichTaskItem } from './markdown/RichTaskItem';
import { RichTask } from '../utils/taskParser';

export const DragOverlay = () => {
  const { isDragging, dragX, dragY, dragData } = useDragDrop();
  const [activeTask, setActiveTask] = useState<RichTask | null>(null);

  useAnimatedReaction(
    () => {
      return {
        data: dragData.value,
        dragging: isDragging.value
      };
    },
    (result) => {
      if (result.dragging && result.data && result.data.type === 'task') {
        runOnJS(setActiveTask)(result.data.payload);
      } else if (!result.dragging) {
        // Delay clearing slightly to allow fade out if we want, but for now instant clear
        runOnJS(setActiveTask)(null);
      }
    },
    []
  );

  const style = useAnimatedStyle(() => {
    if (!isDragging.value) {
      return { display: 'none', opacity: 0 };
    }
    return {
      position: 'absolute',
      left: dragX.value - 20, // Offset to center under finger (approx)
      top: dragY.value - 20,
      width: 300, // Fixed width for drag preview
      display: 'flex',
      zIndex: 9999,
      opacity: 0.9,
      transform: [{ scale: 1.05 }],
      // Shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
    };
  });

  if (!activeTask) return null;

  return (
    <Animated.View style={style} pointerEvents="none">
      <View style={{ backgroundColor: '#1e293b', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' }}>
        <RichTaskItem
            task={activeTask}
            onToggle={() => {}}
            onUpdate={() => {}}
            showGuide={false}
        />
      </View>
    </Animated.View>
  );
};
