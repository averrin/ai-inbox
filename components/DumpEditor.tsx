import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { ProseMarkEditor } from './ui/ProseMarkEditor';

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
        <ProseMarkEditor
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            containerStyle={styles.editorWrapper}
            editorStyle={styles.editorContainer}
            inputStyle={styles.webView}
        />
    );
};

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
    editorWrapper: {
        flex: 1,
        marginBottom: 0,
        backgroundColor: '#0f172a',
    },
    editorContainer: {
        flex: 1,
        borderWidth: 0,
        borderRadius: 0,
        backgroundColor: 'transparent',
    },
    webView: {
        backgroundColor: 'transparent',
    }
});
