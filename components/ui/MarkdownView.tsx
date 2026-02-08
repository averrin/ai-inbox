import React from 'react';
import { Text, View, StyleSheet, Linking, Platform } from 'react-native';
import { marked } from 'marked';

interface MarkdownViewProps {
    text: string;
    style?: any;
    baseFontSize?: number;
    baseColor?: string;
}

export function MarkdownView({ text, style, baseFontSize = 16, baseColor = 'white' }: MarkdownViewProps) {
    const tokens = marked.lexer(text);

    const renderText = (tokens: any[], keyPrefix: string = '', parentStyles: any = []): React.ReactNode[] => {
        return tokens.map((token, index) => {
            const key = `${keyPrefix}${token.type}-${index}`;

            if (token.type === 'text' || token.type === 'escape') {
                return (
                    <Text key={key} style={parentStyles}>
                        {token.text}
                    </Text>
                );
            }

            if (token.type === 'strong') {
                return renderText(token.tokens || [], `${key}-strong-`, [...parentStyles, styles.bold]);
            }

            if (token.type === 'em') {
                return renderText(token.tokens || [], `${key}-em-`, [...parentStyles, styles.italic]);
            }

            if (token.type === 'link') {
                return (
                    <Text
                        key={key}
                        style={[...parentStyles, styles.link]}
                        onPress={() => Linking.openURL(token.href)}
                    >
                        {renderText(token.tokens || [], `${key}-link-`, [])}
                    </Text>
                );
            }

            if (token.type === 'codespan') {
                return (
                    <Text key={key} style={[...parentStyles, styles.code]}>
                        {token.text}
                    </Text>
                );
            }

            if (token.type === 'br') {
                return <Text key={key}>{'\n'}</Text>;
            }

            return null;
        });
    };

    const renderBlocks = (tokens: any[]): React.ReactNode[] => {
        return tokens.map((token, index) => {
            const key = `block-${token.type}-${index}`;

            switch (token.type) {
                case 'paragraph':
                    return (
                        <View key={key} style={styles.paragraph}>
                            <Text style={{ fontSize: baseFontSize, color: baseColor, lineHeight: baseFontSize * 1.5 }}>
                                {renderText(token.tokens || [], `${key}-inline-`)}
                            </Text>
                        </View>
                    );

                case 'heading':
                    const headingSize = baseFontSize + (7 - token.depth) * 2;
                    return (
                        <View key={key} style={styles.heading}>
                            <Text style={[styles.bold, { fontSize: headingSize, color: baseColor }]}>
                                {renderText(token.tokens || [], `${key}-inline-`)}
                            </Text>
                        </View>
                    );

                case 'list':
                    return (
                        <View key={key} style={styles.list}>
                            {token.items.map((item: any, idx: number) => (
                                <View key={`${key}-item-${idx}`} style={styles.listItem}>
                                    <Text style={{ fontSize: baseFontSize, color: baseColor, marginRight: 8 }}>
                                        {token.ordered ? `${idx + 1}.` : '•'}
                                    </Text>
                                    <View style={{ flex: 1 }}>
                                        {renderBlocks(item.tokens)}
                                    </View>
                                </View>
                            ))}
                        </View>
                    );

                case 'space':
                    return <View key={key} style={{ height: 8 }} />;

                default:
                    return null;
            }
        });
    };

    return (
        <View style={style}>
            {renderBlocks(tokens)}
        </View>
    );
}

const styles = StyleSheet.create({
    paragraph: {
        marginBottom: 8,
    },
    heading: {
        marginTop: 12,
        marginBottom: 8,
    },
    bold: {
        fontWeight: 'bold',
    },
    italic: {
        fontStyle: 'italic',
    },
    link: {
        color: '#60a5fa',
        textDecorationLine: 'underline',
    },
    code: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 4,
        borderRadius: 4,
    },
    list: {
        marginBottom: 8,
    },
    listItem: {
        flexDirection: 'row',
        marginBottom: 4,
        alignItems: 'flex-start',
    },
});
