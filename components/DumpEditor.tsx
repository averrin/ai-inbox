import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { RichTextEditor } from './RichTextEditor';

interface DumpEditorProps {
    value: string;
    onChange: (markdown: string) => void;
    placeholder?: string;
    isLoading?: boolean;
}

export const DumpEditor = ({
    value,
    onChange,
    placeholder = 'Start dumping your thoughts...',
    isLoading = false
}: DumpEditorProps) => {

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#818cf8" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <RichTextEditor
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                autoFocus={false}
                containerStyle={styles.editorContainer}
                inputStyle={styles.editorInput}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a', // Ensure background matches theme
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
    editorContainer: {
        flex: 1,
        marginBottom: 0,
        backgroundColor: 'transparent',
        borderWidth: 0,
    },
    editorInput: {
        backgroundColor: 'transparent',
        color: '#f8fafc',
    }
});
