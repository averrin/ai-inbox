import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './ui/design-tokens';

interface RichTextEditorProps {
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
    // Callbacks for focus handling (optional usage)
    onFocus?: () => void;
    onBlur?: () => void;
}

export function RichTextEditor({
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
}: RichTextEditorProps) {

    return (
         <View style={[styles.container, containerStyle]}>
            <View style={styles.editorContainer}>
                <TextInput
                    style={[styles.editor, inputStyle]}
                    multiline
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.text.tertiary}
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
        padding: 8,
        paddingVertical: 4,
    },
    editor: {
        flex: 1,
        backgroundColor: Colors.transparent,
        color: Colors.white,
        fontSize: 16,
        padding: 8,
        minHeight: 180,
    },
    toolbar: {
        width: 44,
        paddingTop: 8,
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
