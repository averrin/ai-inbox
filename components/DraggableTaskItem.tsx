import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { RichTaskItem } from './markdown/RichTaskItem';
import { useDragDrop } from './DragDropContext';
import { RichTask } from '../utils/taskParser';
import * as Haptics from 'expo-haptics';

interface DraggableTaskItemProps {
  task: RichTask;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdate: (updatedTask: RichTask) => void;
  fileName?: string;
  onTagPress?: (tag: string) => void;
}

export const DraggableTaskItem = ({
  task,
  onToggle,
  onEdit,
  onDelete,
  onUpdate,
  fileName,
  onTagPress
}: DraggableTaskItemProps) => {
  const { isDragging, dragX, dragY, dragData } = useDragDrop();

  const handleDragStart = () => {
    try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
        // Haptics not available
    }
  };

  const gesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((e) => {
      isDragging.value = true;
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
      dragData.value = { type: 'task', payload: task };
      runOnJS(handleDragStart)();
    })
    .onUpdate((e) => {
      dragX.value = e.absoluteX;
      dragY.value = e.absoluteY;
    })
    .onEnd(() => {
      isDragging.value = false;
      // We don't clear dragData immediately so that drop handler can read it
      // But we should clear it eventually. Let's rely on isDragging flag.
    })
    .onFinalize(() => {
      isDragging.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isBeingDragged = isDragging.value && dragData.value?.payload?.title === task.title; // Simple check, ideally use ID if available
    return {
      opacity: isBeingDragged ? 0 : 1,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={animatedStyle}>
        <RichTaskItem
          task={task}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdate={onUpdate}
          fileName={fileName}
          onTagPress={onTagPress}
          // Disable long press actions on RichTaskItem to avoid conflict with drag
          onStatusLongPress={undefined}
          onPriorityLongPress={undefined}
        />
      </Animated.View>
    </GestureDetector>
  );
};
