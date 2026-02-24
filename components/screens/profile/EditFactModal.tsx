import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';

interface EditFactModalProps {
    editingFact: { key: string, value: string } | null;
    onClose: () => void;
    onSave: () => void;
    onChangeValue: (value: string) => void;
}

export const EditFactModal: React.FC<EditFactModalProps> = ({
    editingFact,
    onClose,
    onSave,
    onChangeValue
}) => {
    return (
        <Modal
            visible={!!editingFact}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-center px-6">
                <View className="bg-background border border-border rounded-2xl p-6 shadow-2xl">
                    <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest mb-1">
                        Edit Property
                    </Text>
                    <Text className="text-text-primary text-lg font-bold mb-4">
                        {editingFact?.key}
                    </Text>

                    <TextInput
                        className="bg-slate-950 text-text-primary p-4 rounded-xl border border-border min-h-[120px]"
                        multiline
                        textAlignVertical="top"
                        value={editingFact?.value || ''}
                        onChangeText={onChangeValue}
                        autoFocus
                    />

                    <View className="flex-row gap-3 mt-6">
                        <TouchableOpacity
                            className="flex-1 bg-surface py-4 rounded-xl items-center"
                            onPress={onClose}
                        >
                            <Text className="text-text-secondary font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-primary py-4 rounded-xl items-center"
                            onPress={onSave}
                        >
                            <Text className="text-white font-bold">Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
