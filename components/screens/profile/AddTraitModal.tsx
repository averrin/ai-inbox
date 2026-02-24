import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';

interface AddTraitModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: () => void;
    value: string;
    onChangeValue: (value: string) => void;
}

export const AddTraitModal: React.FC<AddTraitModalProps> = ({
    visible,
    onClose,
    onSubmit,
    value,
    onChangeValue
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-center px-6">
                <View className="bg-background border border-border rounded-2xl p-6 shadow-2xl">
                    <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest mb-4">
                        Add New Trait
                    </Text>
                    <TextInput
                        className="bg-slate-950 text-text-primary p-4 rounded-xl border border-border mb-6"
                        placeholder="E.g., Creative, Analytical, Early Bird..."
                        placeholderTextColor="#475569"
                        value={value}
                        onChangeText={onChangeValue}
                        onSubmitEditing={onSubmit}
                        autoFocus
                    />
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            className="flex-1 bg-surface py-4 rounded-xl items-center"
                            onPress={onClose}
                        >
                            <Text className="text-text-secondary font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-primary py-4 rounded-xl items-center"
                            onPress={onSubmit}
                        >
                            <Text className="text-white font-bold">Add</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
