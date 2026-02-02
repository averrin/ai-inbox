import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui/Button';
import { HabitDefinition } from '../store/habitStore';

// Common icons suitable for habits
const HABIT_ICONS = [
    'barbell', 'book', 'water', 'bed', 'bicycle', 'walk', 'medkit', 
    'nutrition', 'musical-notes', 'brush', 'language', 'sunny', 
    'moon', 'desktop', 'code', 'wallet', 'leaf', 'heart', 'star'
];

const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
];

interface HabitModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (habit: Omit<HabitDefinition, 'id' | 'isEnabled'>) => void;
    initialData?: HabitDefinition;
}

export function HabitModal({ visible, onClose, onSave, initialData }: HabitModalProps) {
    const [title, setTitle] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('star');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);

    useEffect(() => {
        if (visible) {
            if (initialData) {
                setTitle(initialData.title);
                setSelectedIcon(initialData.icon);
                setSelectedColor(initialData.color);
            } else {
                setTitle('');
                setSelectedIcon('star');
                setSelectedColor(COLORS[0]);
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
                            <Ionicons name="close" size={24} color="#94a3b8" />
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
                                placeholderTextColor="#64748b"
                                autoFocus
                            />
                        </View>

                        <View className="mb-6">
                            <Text className="text-indigo-200 mb-2 font-medium">Icon</Text>
                            <View className="flex-row flex-wrap gap-3">
                                {HABIT_ICONS.map(icon => (
                                    <TouchableOpacity
                                        key={icon}
                                        onPress={() => setSelectedIcon(icon)}
                                        className={`w-12 h-12 rounded-xl items-center justify-center border-2 ${
                                            selectedIcon === icon 
                                                ? 'bg-slate-800 border-indigo-500' 
                                                : 'bg-slate-800/50 border-transparent'
                                        }`}
                                    >
                                        <Ionicons 
                                            name={icon as any} 
                                            size={24} 
                                            color={selectedIcon === icon ? '#818cf8' : '#64748b'} 
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View className="mb-8">
                            <Text className="text-indigo-200 mb-2 font-medium">Color</Text>
                            <View className="flex-row flex-wrap gap-3">
                                {COLORS.map(color => (
                                    <TouchableOpacity
                                        key={color}
                                        onPress={() => setSelectedColor(color)}
                                        className={`w-10 h-10 rounded-full border-2 ${
                                            selectedColor === color ? 'border-white' : 'border-transparent'
                                        }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </View>
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
