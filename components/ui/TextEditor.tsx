import React, { useMemo } from 'react';
import { View, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MarkdownTextInput, parseExpensiMark } from '@expensify/react-native-live-markdown';
import { preprocessMarkdownEmbeds, postprocessMarkdownEmbeds } from '../../utils/markdownParser';

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
    onFocus?: () => void;
    onBlur?: () => void;
    containerStyle?: any;
    inputStyle?: any;
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
    onFocus,
    onBlur,
    containerStyle: customContainerStyle,
    inputStyle: customInputStyle,
}: TextEditorProps) {
    const [highlightingEnabled, setHighlightingEnabled] = React.useState(true);
    
    // Obsidian-flavored markdown styles
    const markdownStyle = {
        syntax: {
            color: '#64748b', // Slate-500 for syntax markers
        },
        link: {
            color: '#60a5fa', // Blue-400
        },
        h1: {
            fontSize: 24,
            fontWeight: 'bold' as const,
            color: '#f1f5f9', // Slate-100
        },
        h2: {
            fontSize: 20,
            fontWeight: 'bold' as const,
            color: '#f1f5f9',
        },
        h3: {
            fontSize: 18,
            fontWeight: 'bold' as const,
            color: '#f1f5f9',
        },
        h4: {
            fontSize: 16,
            fontWeight: 'bold' as const,
            color: '#e2e8f0',
        },
        h5: {
            fontSize: 14,
            fontWeight: 'bold' as const,
            color: '#e2e8f0',
        },
        h6: {
            fontSize: 14,
            fontWeight: 'bold' as const,
            color: '#cbd5e1',
        },
        em: {
            fontStyle: 'italic' as const,
            color: '#94a3b8', // Slate-400
        },
        strong: {
            fontWeight: 'bold' as const,
            color: '#fbbf24', // Amber-400
        },
        del: {
            textDecorationLine: 'line-through' as const,
            color: '#64748b',
        },
        blockquote: {
            borderColor: '#60a5fa', // Blue for embed callouts
            borderWidth: 4,
            marginLeft: 0,
            paddingLeft: 12,
            color: '#93c5fd', // Lighter blue text
            fontStyle: 'normal' as const, // Not italic for embeds
        },
        code: {
            fontFamily: 'monospace',
            fontSize: 14,
            color: '#f472b6', // Pink-400
            backgroundColor: '#1e293b', // Slate-800
            paddingHorizontal: 4,
            paddingVertical: 2,
            borderRadius: 3,
        },
        pre: {
            fontFamily: 'monospace',
            fontSize: 13,
            color: '#60a5fa', // Blue-400 for embed/callout feel
            backgroundColor: '#1e3a8a22', // Semi-transparent blue
            borderColor: '#60a5fa', // Blue accent border
            borderWidth: 4,
            borderRadius: 6,
            padding: 12,
            paddingVertical: 12,
            paddingHorizontal: 12,
        },
        mentionHere: {
            color: '#22c55e', // Green-500
            backgroundColor: '#14532d33',
        },
        mentionUser: {
            color: '#3b82f6', // Blue-500
            backgroundColor: '#1e3a8a33',
        },
    };

    const inputStyle = {
        textAlignVertical: 'top' as const,
        minHeight: 200,
        maxHeight: customInputStyle?.maxHeight || 400,
        fontSize: 16,
        lineHeight: 24,
        color: '#ffffff',
        ...customInputStyle
    };

    // Preprocess value to convert ```embed blocks to styled blockquotes
    const displayValue = useMemo(() => preprocessMarkdownEmbeds(value), [value]);

    // Handle text change: postprocess to restore ```embed blocks
    const handleTextChange = (text: string) => {
        const restoredText = postprocessMarkdownEmbeds(text);
        onChangeText(restoredText);
    };

    return (
        <View className="mb-4 relative" style={customContainerStyle}>
            <View className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-lg relative flex-1">
                {highlightingEnabled ? (
                    <MarkdownTextInput
                        className="flex-1 p-4 pr-14"
                        multiline
                        placeholder={placeholder}
                        placeholderTextColor="#94a3b8"
                        style={inputStyle}
                        value={displayValue}
                        onChangeText={handleTextChange}
                        autoFocus={autoFocus}
                        editable={!disabled}
                        autoCapitalize="sentences"
                        markdownStyle={markdownStyle}
                        parser={parseExpensiMark}
                        onFocus={onFocus}
                        onBlur={onBlur}
                    />
                ) : (
                    <TextInput
                        className="flex-1 p-4 pr-14 text-white"
                        multiline
                        placeholder={placeholder}
                        placeholderTextColor="#94a3b8"
                        style={inputStyle}
                        value={value}
                        onChangeText={onChangeText}
                        autoFocus={autoFocus}
                        editable={!disabled}
                        autoCapitalize="sentences"
                        onFocus={onFocus}
                        onBlur={onBlur}
                    />
                )}

                {/* Vertical Button Column */}
                <View className="absolute right-2 justify-start gap-3 w-12 items-center pt-2">
                    <TouchableOpacity
                        onPress={onAttach}
                        className="bg-slate-700/50 p-2 rounded-lg"
                        disabled={disabled}
                    >
                        <Ionicons name="attach" size={24} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onCamera}
                        className="bg-slate-700/50 p-2 rounded-lg"
                        disabled={disabled}
                    >
                        <Ionicons name="camera" size={24} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onRecord}
                        className={`p-2 rounded-lg ${recording ? 'bg-red-600/90' : 'bg-slate-700/50'}`}
                        disabled={disabled}
                    >
                        <Ionicons name={recording ? "stop" : "mic"} size={24} color="white" />
                    </TouchableOpacity>

                    {/* Syntax Highlighting Toggle */}
                    <TouchableOpacity
                        onPress={() => setHighlightingEnabled(!highlightingEnabled)}
                        className={`p-2 rounded-lg ${highlightingEnabled ? 'bg-indigo-600/90' : 'bg-slate-700/50'}`}
                        disabled={disabled}
                    >
                        <Ionicons name="color-palette" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
