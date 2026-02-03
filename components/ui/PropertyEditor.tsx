import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseEditor } from './BaseEditor';

interface PropertyEditorProps {
    properties: Record<string, any>;
    onUpdate: (properties: Record<string, any>) => void;
    label?: string;
    keySuggestions?: string[];
}

export function PropertyEditor({ properties, onUpdate, label, keySuggestions = [] }: PropertyEditorProps) {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [tempKey, setTempKey] = useState('');
    const [tempValue, setTempValue] = useState('');
    const [editingKey, setEditingKey] = useState<string | null>(null);

    const propertyItems = useMemo(() => Object.entries(properties), [properties]);

    const filteredSuggestions = useMemo(() => {
        if (!tempKey) return keySuggestions.slice(0, 5);
        return keySuggestions
            .filter(k => k.toLowerCase().includes(tempKey.toLowerCase()) && !properties[k])
            .slice(0, 5);
    }, [keySuggestions, tempKey, properties]);

    const handleAdd = () => {
        setTempKey('');
        setTempValue('');
        setEditingKey(null);
        setIsModalVisible(true);
    };

    const handleEdit = (key: string, value: any) => {
        setTempKey(key);
        setTempValue(typeof value === 'string' ? value : JSON.stringify(value));
        setEditingKey(key);
        setIsModalVisible(true);
    };

    const handleRemove = (key: string) => {
        const newProps = { ...properties };
        delete newProps[key];
        onUpdate(newProps);
    };

    const handleConfirm = () => {
        const key = tempKey.trim();
        if (!key) return;

        const newProps = { ...properties };
        if (editingKey && editingKey !== key) {
            delete newProps[editingKey];
        }
        
        // Try to parse as number if applicable, otherwise keep as string
        let finalValue: any = tempValue;
        if (tempValue && !isNaN(Number(tempValue)) && tempValue.trim() !== '') {
            finalValue = Number(tempValue);
        } else if (tempValue.toLowerCase() === 'true') {
            finalValue = true;
        } else if (tempValue.toLowerCase() === 'false') {
            finalValue = false;
        }

        newProps[key] = finalValue;
        onUpdate(newProps);
        setIsModalVisible(false);
    };

    const renderItem = ([key, value]: [string, any], index: number) => (
        <View key={key} className="bg-slate-700/80 px-2.5 py-1 rounded-md flex-row items-center border border-slate-600/50">
            <TouchableOpacity onPress={() => handleEdit(key, value)} className="flex-row items-center">
                <Text className="text-slate-400 text-xs mr-1">{key}:</Text>
                <Text className="text-slate-200 text-xs mr-2" numberOfLines={1}>
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity 
                onPress={() => handleRemove(key)} 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="close" size={10} color="#94a3b8" />
            </TouchableOpacity>
        </View>
    );

    const suggestionsUI = filteredSuggestions.length > 0 ? (
        <View>
            <Text className="text-slate-400 text-[10px] font-bold mb-2 uppercase tracking-tight">Key Suggestions</Text>
            <View className="flex-row flex-wrap gap-2">
                {filteredSuggestions.map(suggestion => (
                    <TouchableOpacity
                        key={suggestion}
                        onPress={() => setTempKey(suggestion)}
                        className="bg-slate-800 border border-slate-700 px-2 py-1 rounded-md"
                    >
                        <Text className="text-slate-300 text-xs">{suggestion}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    ) : null;

    return (
        <BaseEditor
            items={propertyItems}
            renderItem={renderItem}
            onAdd={handleAdd}
            label={label}
            addLabel="Property"
            modalTitle={editingKey ? "Edit Property" : "Add Property"}
            isModalVisible={isModalVisible}
            onCloseModal={() => setIsModalVisible(false)}
            onConfirm={handleConfirm}
            suggestions={suggestionsUI}
        >
            <View className="gap-3">
                <View>
                    <Text className="text-slate-400 text-[10px] uppercase font-bold mb-1 ml-1">Key</Text>
                    <TextInput
                        value={tempKey}
                        onChangeText={setTempKey}
                        placeholder="e.g., status, priority"
                        placeholderTextColor="#64748b"
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white text-sm"
                        autoCapitalize="none"
                    />
                </View>
                <View>
                    <Text className="text-slate-400 text-[10px] uppercase font-bold mb-1 ml-1">Value</Text>
                    <TextInput
                        value={tempValue}
                        onChangeText={setTempValue}
                        placeholder="Value..."
                        placeholderTextColor="#64748b"
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white text-sm"
                    />
                </View>
            </View>
        </BaseEditor>
    );
}
