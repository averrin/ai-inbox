import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../ui/design-tokens';

interface EditTraitModalProps {
    editingTrait: { original: string, value: string } | null;
    onClose: () => void;
    onSave: () => void;
    onDelete: () => void;
    onChangeValue: (value: string) => void;
}

export const EditTraitModal: React.FC<EditTraitModalProps> = ({
    editingTrait,
    onClose,
    onSave,
    onDelete,
    onChangeValue
}) => {
    return (
        <Modal
            visible={!!editingTrait}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-center px-6">
                <View className="bg-background border border-border rounded-2xl p-6 shadow-2xl">
                    <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest mb-1">
                        Edit Trait
                    </Text>
                    <Text className="text-text-secondary text-xs mb-4">
                        Update or remove this personality trait.
                    </Text>

                    <TextInput
                        className="bg-slate-950 text-text-primary p-4 rounded-xl border border-border mb-6"
                        value={editingTrait?.value || ''}
                        onChangeText={onChangeValue}
                        autoFocus
                    />

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            className="bg-surface p-4 rounded-xl items-center justify-center aspect-square"
                            onPress={onDelete}
                        >
                            <Ionicons name="trash-outline" size={24} color={Colors.error} />
                        </TouchableOpacity>
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
                            <Text className="text-white font-bold">Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
