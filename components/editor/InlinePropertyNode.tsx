import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function InlinePropertyNode(props: any) {
    const { node, updateAttributes } = props;
    const { key, value } = node.attrs;

    const handleRemove = () => {
        // We can't easily "remove" ourselves via context directly without a specialized command?
        // Usually we might set "removed" attr or similar, but ideally we delete the node.
        // Tiptap NodeView props often include `deleteNode`.
        // TenTap's `useNodeViewContext` might expose it?
        // If not, we can treat it as a UI interaction for now.
        // Or we assume the bridge allows sending a delete command.
        
        // For now, let's just log or visually indicate specific interaction.
        console.log('Remove inline property:', key, value);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.keyText}>{key}</Text>
            <View style={styles.separator} />
            <Text style={styles.valueText}>{value}</Text>
            <TouchableOpacity onPress={handleRemove} style={styles.removeButton}>
                <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#334155', // Slate-700
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 2,
        marginHorizontal: 2,
    },
    keyText: {
        color: '#f472b6', // Pink-400
        fontWeight: '600',
        fontSize: 14,
    },
    separator: {
        width: 1,
        height: 12,
        backgroundColor: '#475569', // Slate-600
        marginHorizontal: 4,
    },
    valueText: {
        color: '#f1f5f9', // Slate-100
        fontSize: 14,
    },
    removeButton: {
        marginLeft: 4,
        padding: 2,
    },
    removeText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
