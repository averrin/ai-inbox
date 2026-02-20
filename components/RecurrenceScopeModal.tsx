import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './ui/design-tokens';

interface RecurrenceScopeModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (scope: 'this' | 'future' | 'all') => void;
    actionType?: 'save' | 'delete' | 'reschedule' | 'update';
}

export function RecurrenceScopeModal({ 
    visible, 
    onClose, 
    onSelect, 
    actionType = 'update' 
}: RecurrenceScopeModalProps) {
    const actionText = actionType === 'delete' ? 'deletion' : (actionType === 'reschedule' ? 'rescheduling' : 'changes');

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-3xl border border-slate-700">
                    <Text className="text-white text-xl font-bold mb-4 text-center">Recurring Event</Text>
                    
                    <Text className="text-slate-300 text-center mb-6">
                        This is a recurring event. How would you like to apply your {actionText}?
                    </Text>

                    <View className="gap-3">
                        <TouchableOpacity
                            onPress={() => onSelect('this')}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between"
                        >
                            <Text className="text-white font-semibold">This event only</Text>
                            <Ionicons name="calendar-outline" size={20} color={Colors.text.tertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => onSelect('future')}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between"
                        >
                            <Text className="text-white font-semibold">This and following events</Text>
                            <Ionicons name="albums-outline" size={20} color={Colors.text.tertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => onSelect('all')}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between"
                        >
                            <Text className="text-white font-semibold">All events in series</Text>
                            <Ionicons name="infinite-outline" size={20} color={Colors.text.tertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onClose}
                            className="mt-2 p-4 rounded-xl items-center"
                        >
                            <Text className="text-slate-500 font-semibold">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
