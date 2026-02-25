import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { MarkdownTextInput, parseExpensiMark } from '@expensify/react-native-live-markdown';
import { Colors } from './ui/design-tokens';
import { markdownStyle } from './markdown/markdownStyle';

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
            <MarkdownTextInput
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor={Colors.text.tertiary}
                parser={parseExpensiMark}
                markdownStyle={markdownStyle}
                style={styles.input}
                multiline
                textAlignVertical="top"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    input: {
        flex: 1,
        color: Colors.text.primary,
        padding: 16,
        fontSize: 16,
        lineHeight: 24,
        textAlignVertical: 'top',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    }
});
