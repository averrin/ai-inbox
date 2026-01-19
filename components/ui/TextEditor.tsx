import React from 'react';
import { View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TextEditorProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onAttach: () => Promise<void>;
    onCamera: () => Promise<void>;
    onRecord: () => void;
    recording: boolean;
    disabled?: boolean;
    autoFocus?: boolean;
}

export function TextEditor({
    value,
    onChangeText,
    placeholder = 'Type your note...',
    onAttach,
    onCamera,
    onRecord,
    recording,
    disabled = false,
    autoFocus = false,
}: TextEditorProps) {
    return (
        <View className="mb-4 relative flex-row">
            <TextInput
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl p-4 pr-14 text-white text-lg shadow-lg"
                multiline
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                style={{ textAlignVertical: 'top', minHeight: 200, maxHeight: 400 }}
                value={value}
                onChangeText={onChangeText}
                autoFocus={autoFocus}
                editable={!disabled}
            />

            {/* Vertical Button Column */}
            <View className="absolute right-2 top-2 bottom-2 justify-start gap-3 w-12 items-center pt-2">
                {/* Attach file button */}
                <TouchableOpacity
                    onPress={onAttach}
                    className="bg-slate-700/50 p-2 rounded-lg"
                    disabled={disabled}
                >
                    <Ionicons name="attach" size={24} color="white" />
                </TouchableOpacity>

                {/* Camera button */}
                <TouchableOpacity
                    onPress={onCamera}
                    className="bg-slate-700/50 p-2 rounded-lg"
                    disabled={disabled}
                >
                    <Ionicons name="camera" size={24} color="white" />
                </TouchableOpacity>

                {/* Voice Record Button */}
                <TouchableOpacity
                    onPress={onRecord}
                    className={`p-2 rounded-lg ${recording ? 'bg-red-600/90' : 'bg-slate-700/50'}`}
                    disabled={disabled}
                >
                    <Ionicons name={recording ? "stop" : "mic"} size={24} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
