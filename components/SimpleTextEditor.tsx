import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SimpleTextEditorProps {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    containerStyle?: any;
    inputStyle?: any;
    
    // Toolbar actions
    onAttach?: () => Promise<void>;
    onCamera?: () => Promise<void>;
    onRecord?: () => void;
    recording?: boolean;
    // Focus callbacks
    onFocus?: () => void;
    onBlur?: () => void;
}

export function SimpleTextEditor({
    value = '',
    onChangeText,
    placeholder = 'Start typing...',
    autoFocus = false,
    disabled = false,
    containerStyle,
    inputStyle,
    onAttach,
    onCamera,
    onRecord,
    recording,
    onFocus,
    onBlur,
}: SimpleTextEditorProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            <View style={styles.editorContainer}>
                <TextInput
                    style={[styles.input, inputStyle]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    multiline
                    autoFocus={autoFocus}
                    editable={!disabled}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    textAlignVertical="top"
                />

                {/* Toolbar */}
                <View style={styles.toolbar}>
                    {onAttach && (
                        <TouchableOpacity onPress={onAttach} style={styles.toolbarButton}>
                            <Ionicons name="attach" size={24} color="white" />
                        </TouchableOpacity>
                    )}
                    {onCamera && (
                        <TouchableOpacity onPress={onCamera} style={styles.toolbarButton}>
                            <Ionicons name="camera" size={24} color="white" />
                        </TouchableOpacity>
                    )}
                    {onRecord && (
                        <TouchableOpacity 
                            onPress={onRecord} 
                            style={[styles.toolbarButton, recording && styles.recordingButton]}
                        >
                            <Ionicons name={recording ? "stop" : "mic"} size={24} color="white" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    editorContainer: {
        backgroundColor: 'rgba(30, 41, 59, 0.8)', // slate-800/80
        borderColor: '#334155', // slate-700
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
        flexDirection: 'row',
        minHeight: 200,
    },
    input: {
        flex: 1,
        color: '#ffffff',
        padding: 16,
        fontSize: 16,
        fontFamily: 'System', // Ensures consistent font with rich editor
        lineHeight: 24, // Matches 1.5/1.6 approx
    },
    toolbar: {
        width: 48,
        paddingTop: 8,
        alignItems: 'center',
        gap: 12,
        borderLeftWidth: 1,
        borderLeftColor: '#334155', // slate-700
        backgroundColor: 'rgba(30, 41, 59, 0.5)', 
    },
    toolbarButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(51, 65, 85, 0.5)', // slate-700/50
    },
    recordingButton: {
        backgroundColor: 'rgba(220, 38, 38, 0.9)', // red-600/90
    }
});
