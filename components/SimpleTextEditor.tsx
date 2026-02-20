import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './ui/design-tokens';

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
    onReminder?: () => void;
    onCreateReminder?: () => void;
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
    onReminder,
    onCreateReminder,
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
                    placeholderTextColor={Colors.text.tertiary}
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
                            <Ionicons name="attach" size={20} color="white" />
                        </TouchableOpacity>
                    )}
                    {onCreateReminder && (
                        <TouchableOpacity onPress={onCreateReminder} style={styles.toolbarButton}>
                            <Ionicons name="add-circle-outline" size={20} color="white" />
                        </TouchableOpacity>
                    )}
                    {onReminder && (
                        <TouchableOpacity onPress={onReminder} style={styles.toolbarButton}>
                            <Ionicons name="alarm-outline" size={20} color="white" />
                        </TouchableOpacity>
                    )}
                    {onCamera && (
                        <TouchableOpacity onPress={onCamera} style={styles.toolbarButton}>
                            <Ionicons name="camera" size={20} color="white" />
                        </TouchableOpacity>
                    )}
                    {onRecord && (
                        <TouchableOpacity 
                            onPress={onRecord} 
                            style={[styles.toolbarButton, recording && styles.recordingButton]}
                        >
                            <Ionicons name={recording ? "stop" : "mic"} size={20} color="white" />
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
        borderColor: Colors.surfaceHighlight, // slate-700
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
        flexDirection: 'row',
        minHeight: 200,
    },
    input: {
        flex: 1,
        color: Colors.white,
        padding: 16,
        fontSize: 16,
        fontFamily: 'System', // Ensures consistent font with rich editor
        lineHeight: 24, // Matches 1.5/1.6 approx
    },
    toolbar: {
        width: 44,
        paddingTop: 6,
        paddingBottom: 6,
        alignItems: 'center',
        gap: 6,
        borderLeftWidth: 1,
        borderLeftColor: Colors.surfaceHighlight, // slate-700
        backgroundColor: 'rgba(30, 41, 59, 0.5)', 
    },
    toolbarButton: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(51, 65, 85, 0.5)', // slate-700/50
    },
    recordingButton: {
        backgroundColor: 'rgba(220, 38, 38, 0.9)', // red-600/90
    }
});
