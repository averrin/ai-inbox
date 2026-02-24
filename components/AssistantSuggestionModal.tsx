import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { Colors } from './ui/design-tokens';
import { AssistantSuggestion } from './ui/calendar/hooks/useScheduleAssistant';

interface AssistantSuggestionModalProps {
    visible: boolean;
    suggestion: AssistantSuggestion | null;
    onAccept: (suggestion: AssistantSuggestion) => void;
    onDismiss: (id: string) => void;
    onClose: () => void;
}

export const AssistantSuggestionModal = ({ visible, suggestion, onAccept, onDismiss, onClose }: AssistantSuggestionModalProps) => {
    if (!suggestion) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-center items-center p-4">
                <View className="bg-surface w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                    {/* Header */}
                    <View className="bg-primary/10 p-4 border-b border-white/5 flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                            <Ionicons name="sparkles" size={20} color={Colors.primary} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-lg">Suggestion</Text>
                            <Text className="text-text-secondary text-xs">AI Assistant</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={20} color={Colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View className="p-5 gap-4">
                        <View>
                            <Text className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Move Event</Text>
                            <Text className="text-white text-lg font-semibold">{suggestion.title}</Text>
                        </View>

                        <View className="flex-row items-center gap-3 bg-surfaceHighlight p-3 rounded-lg border border-white/5">
                            <View className="flex-1">
                                <Text className="text-text-tertiary text-xs">From</Text>
                                {/* We don't have original start time here, unless we passed it. But we can just show "To" */}
                                <Text className="text-text-secondary font-medium">Original Slot</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={16} color={Colors.text.secondary} />
                            <View className="flex-1 items-end">
                                <Text className="text-text-tertiary text-xs">To</Text>
                                <Text className="text-success font-bold">
                                    {dayjs(suggestion.newStart).format('h:mm A')}
                                </Text>
                                <Text className="text-text-tertiary text-[10px]">
                                    {dayjs(suggestion.newStart).format('MMM D')}
                                </Text>
                            </View>
                        </View>

                        <View>
                            <Text className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-2">Why?</Text>
                            <Text className="text-white/90 leading-5 text-sm bg-surfaceHighlight/50 p-3 rounded-lg">
                                {suggestion.reason}
                            </Text>
                        </View>
                    </View>

                    {/* Actions */}
                    <View className="p-4 border-t border-white/5 flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => {
                                onDismiss(suggestion.id);
                                onClose();
                            }}
                            className="flex-1 py-3 bg-surfaceHighlight rounded-xl items-center"
                        >
                            <Text className="text-text-secondary font-semibold">Dismiss</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                onAccept(suggestion);
                                onClose();
                            }}
                            className="flex-1 py-3 bg-primary rounded-xl items-center"
                        >
                            <Text className="text-white font-bold">Accept Move</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
