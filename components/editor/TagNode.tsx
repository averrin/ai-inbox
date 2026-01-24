import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function TagNode(props: any) {
    const { node } = props;
    const { tag } = node.attrs;

    return (
        <View style={styles.container}>
            <Text style={styles.text}>{tag}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#334155', // Slate-700
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 4,
        marginHorizontal: 2,
        alignSelf: 'flex-start',
    },
    text: {
        color: '#60a5fa', // Blue-400
        fontWeight: '600',
        fontSize: 14,
    },
});
