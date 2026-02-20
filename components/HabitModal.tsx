import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui/Button';
import { HabitDefinition } from '../store/habitStore';
import { ColorPicker } from './ui/ColorPicker';
import { Palette, Colors } from './ui/design-tokens';
import { IconPicker } from './ui/IconPicker';

interface HabitModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (habit: Omit<HabitDefinition, 'id' | 'isEnabled'>) => void;
    initialData?: HabitDefinition;
}

export function HabitModal({ visible, onClose, onSave, initialData }: HabitModalProps) {
    const [title, setTitle] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('star');
    const [selectedColor, setSelectedColor] = useState(Palette[0]);

    useEffect(() => {
        if (visible) {
            if (initialData) {
                setTitle(initialData.title);
                setSelectedIcon(initialData.icon);
                setSelectedColor(initialData.color);
            } else {
                setTitle('');
                setSelectedIcon('star');
                setSelectedColor(Palette[0]);
            }
        }
    }, [visible, initialData]);

    const handleSave = () => {
        if (!title.trim()) return;
        
        onSave({
            title: title.trim(),
            icon: selectedIcon,
            color: selectedColor,
        });
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-end bg-black/50"
            >
                <View className="bg-slate-900 rounded-t-3xl p-6 max-h-[90%]">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-xl font-bold">
                            {initialData ? 'Edit Check' : 'New Check'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={Colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView>
                        <View className="mb-6">
                            <Text className="text-indigo-200 mb-2 font-medium">Title</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 font-medium"
                                value={title}
                                onChangeText={setTitle}
                                placeholder="e.g. Exercise, Read, Meditate"
                                placeholderTextColor={Colors.secondary}
                                autoFocus
                            />
                        </View>

                        <View className="mb-6">
                            <IconPicker
                                label="Icon"
                                value={selectedIcon}
                                onChange={setSelectedIcon}
                            />
                        </View>

                        <View className="mb-8">
                            <ColorPicker
                                label="Color"
                                value={selectedColor}
                                onChange={setSelectedColor}
                            />
                        </View>

                        <Button 
                            title="Save" 
                            onPress={handleSave}
                            disabled={!title.trim()}
                        />
                        <View className="h-4" /> 
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
