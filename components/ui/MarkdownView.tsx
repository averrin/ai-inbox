import React, { useMemo } from 'react';
import { View, Platform, ViewStyle } from 'react-native';
import Markdown, { type MarkdownStyles } from 'react-native-markdown-renderer';

interface MarkdownViewProps {
    text: string;
    style?: ViewStyle;
    baseFontSize?: number;
    baseColor?: string;
}

export function MarkdownView({ text, style, baseFontSize = 16, baseColor = 'white' }: MarkdownViewProps) {
    const markdownStyles: Partial<MarkdownStyles> = useMemo(() => ({
        text: {
            fontSize: baseFontSize,
            color: baseColor,
            lineHeight: baseFontSize * 1.5,
        },
        heading1: {
            fontSize: baseFontSize + 12,
            color: baseColor,
            fontWeight: 'bold',
            marginTop: 12,
            marginBottom: 8,
        },
        heading2: {
            fontSize: baseFontSize + 10,
            color: baseColor,
            fontWeight: 'bold',
            marginTop: 12,
            marginBottom: 8,
        },
        heading3: {
            fontSize: baseFontSize + 8,
            color: baseColor,
            fontWeight: 'bold',
            marginTop: 12,
            marginBottom: 8,
        },
        heading4: {
            fontSize: baseFontSize + 6,
            color: baseColor,
            fontWeight: 'bold',
            marginTop: 12,
            marginBottom: 8,
        },
        heading5: {
            fontSize: baseFontSize + 4,
            color: baseColor,
            fontWeight: 'bold',
            marginTop: 12,
            marginBottom: 8,
        },
        heading6: {
            fontSize: baseFontSize + 2,
            color: baseColor,
            fontWeight: 'bold',
            marginTop: 12,
            marginBottom: 8,
        },
        strong: {
            fontWeight: 'bold',
        },
        em: {
            fontStyle: 'italic',
        },
        link: {
            color: '#60a5fa',
            textDecorationLine: 'underline',
        },
        codeInline: {
            fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
            color: baseColor,
        },
        codeBlock: {
            fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: 8,
            borderRadius: 4,
            color: baseColor,
            marginVertical: 4,
        },
        listUnorderedItemIcon: {
            color: baseColor,
            fontSize: baseFontSize,
            marginRight: 8,
            lineHeight: baseFontSize * 1.5,
        },
        listOrderedItemIcon: {
            color: baseColor,
            fontSize: baseFontSize,
            marginRight: 8,
            lineHeight: baseFontSize * 1.5,
        },
        paragraph: {
            marginBottom: 8,
            flexWrap: 'wrap',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
        },
        list: {
            marginBottom: 8,
        },
        listItem: {
            flexDirection: 'row',
            marginBottom: 4,
            alignItems: 'flex-start',
        },
    }), [baseFontSize, baseColor]);

    return (
        <View style={style}>
            <Markdown style={markdownStyles}>
                {text}
            </Markdown>
        </View>
    );
}
