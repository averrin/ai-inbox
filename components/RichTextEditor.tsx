import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { RichText, useEditorBridge, TenTapStartKit } from '@10play/tentap-editor';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { Ionicons } from '@expo/vector-icons';
import { InlinePropertyExtension } from '../utils/editor/InlinePropertyExtension';
import { TagExtension } from '../utils/editor/TagExtension';
import { DOMParser } from '@xmldom/xmldom';

// Polyfill DOM for Turndown (React Native environment)
if (!global.DOMParser) {
    (global as any).DOMParser = DOMParser;
}

// Robust document polyfill for Turndown
if (!(global as any).document) {
    try {
        const createPolyfilledDoc = (html: string) => {
             const baseDoc = new DOMParser().parseFromString(html, 'text/html');
             // Add missing methods expected by Turndown (HTMLDocument interface)
             (baseDoc as any).open = () => {};
             (baseDoc as any).close = () => {};
             (baseDoc as any).write = () => {};
             
             // Shim .body property for xmldom
             Object.defineProperty(baseDoc, 'body', {
                 get: () => {
                     const bodies = baseDoc.getElementsByTagName('body');
                     return bodies && bodies.length > 0 ? bodies[0] : null;
                 }
             });
             
             return baseDoc;
        };

        const initialDoc = createPolyfilledDoc('<!DOCTYPE html><html><body></body></html>');

        (global as any).document = {
            createElement: (tagName: string) => {
                // @ts-ignore
                return initialDoc.createElement(tagName);
            },
            implementation: {
                 createHTMLDocument: (title?: string) => {
                     return createPolyfilledDoc(`<!DOCTYPE html><html><head><title>${title}</title></head><body></body></html>`);
                 }
            },
            body: initialDoc.getElementsByTagName('body')[0],
        };
    } catch (e) {
        console.warn('[RichTextEditor] Failed to polyfill document:', e);
    }
}

// Global configuration flag for marked extensions
let markedConfigured = false;

// Custom CSS to enforce dark mode / styling in the WebView
const customCSS = `
* { box-sizing: border-box; }
html, body { 
    background-color: #1e293b !important; 
    color: #ffffff !important; 
    margin: 0; 
    padding: 20px; 
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px; 
    line-height: 1.6;
    min-height: 100vh;
}
.ProseMirror { min-height: 100%; outline: none; }
a { color: #60a5fa !important; text-decoration: underline; }
p { margin: 0 0 1em 0; position: relative; }
p:last-child { margin-bottom: 0; }
/* Placeholder styling matching TenTap structure */
p.is-editor-empty:first-child::before {
    color: #94a3b8;
    content: attr(data-placeholder);
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    height: 100%;
}
`;

const theme = {
    webview: { backgroundColor: 'transparent' },
    editor: {
        backgroundColor: 'transparent',
        color: '#ffffff',
        placeholder: '#94a3b8'
    }
};

interface RichTextEditorProps {
    value?: string;
    onChangeText?: (markdown: string) => void;
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
    onCamera,
    onRecord,
    recording,
    onFocus, // Exposed but bridge specific focus handling might be needed
    onBlur,
}: RichTextEditorProps) {
    // Initialize Turndown Service
    const turndownService = useRef(new TurndownService({
         headingStyle: 'atx',
         codeBlockStyle: 'fenced'
    })).current;

    // Configure Turndown Rules (Idempotent check via internal flag on instance)
    if ((turndownService as any)._customRulesAdded !== true) {
         turndownService.addRule('inlineProperty', {
            filter: (node) => {
                return node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'inline-property';
            },
            replacement: (content, node) => {
                const element = node as HTMLElement;
                const key = element.getAttribute('data-key') || '';
                const val = element.getAttribute('data-value') || '';
                return `[${key}::${val}]`;
            }
        });
        turndownService.addRule('tag', {
            filter: (node) => {
                return node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'tag';
            },
            replacement: (content, node) => {
                const element = node as HTMLElement;
                const tag = element.getAttribute('data-tag') || '';
                return tag ? ` ${tag} ` : content;
            }
        });
        (turndownService as any)._customRulesAdded = true;
    }

    // Configure Marked (Global)
    if (!markedConfigured) {
        marked.use({
            extensions: [
                {
                    name: 'inlineProperty',
                    level: 'inline',
                    start(src) { return src.match(/\[/)?.index; },
                    tokenizer(src, tokens) {
                        const rule = /^\[([a-zA-Z0-9_]+)::([^\]]+)\]/;
                        const match = rule.exec(src);
                        if (match) {
                            return {
                                type: 'inlineProperty',
                                raw: match[0],
                                key: match[1],
                                value: match[2],
                            };
                        }
                    },
                    renderer(token) {
                        return `<span data-type="inline-property" data-key="${token.key}" data-value="${token.value}"></span>`;
                    }
                },
                {
                    name: 'tag',
                    level: 'inline',
                    start(src) { return src.match(/#/)?.index; },
                    tokenizer(src, tokens) {
                        const rule = /^#[a-zA-Z0-9_\-]+/;
                        const match = rule.exec(src);
                        if (match) {
                            return {
                                type: 'tag',
                                raw: match[0],
                                tag: match[0],
                            };
                        }
                    },
                    renderer(token) {
                        return `<span data-type="tag" data-tag="${token.tag}"></span>`;
                    }
                }
            ]
        });
        markedConfigured = true;
    }

    // Convert Markdown to HTML
    const toHtml = (md: string) => {
        try {
            return marked.parse(md, { async: false }) as string;
        } catch (e) {
            console.warn('[RichTextEditor] Marked conversion failed:', e);
            return md;
        }
    };
    
    // Initial content with custom CSS injection
    const initialHtml = useMemo(() => {
        const contentHtml = toHtml(value);
        return `<style>${customCSS}</style>${contentHtml}`;
    }, []); 

    const lastEmittedRef = useRef<string>(value);
    const editorInstanceRef = useRef<any>(null);

    const editor = useEditorBridge({
        autofocus: autoFocus,
        avoidIosKeyboard: true,
        initialContent: initialHtml,
        dynamicHeight: false, // DISABLED due to infinite growth bug on Android
        theme,
        bridgeExtensions: [
            ...TenTapStartKit,
            InlinePropertyExtension,
            TagExtension,
        ],
        onChange: async () => {
             // onChange fires when content changes in WebView
             if (editorInstanceRef.current && onChangeText) {
                 try {
                     const content = await editorInstanceRef.current.getHTML();
                     // Convert HTML -> Markdown using Turndown
                     // Ensure content is not null/empty to avoid parser errors
                     const cleanContent = content || '';
                     
                     if (!cleanContent.trim()) {
                         lastEmittedRef.current = '';
                         onChangeText('');
                         return;
                     }

                     // Explicitly parse to DOM to avoid internal Turndown string parsing issues
                     const doc = new DOMParser().parseFromString(cleanContent, 'text/html');
                     const markdown = turndownService.turndown(doc);
                     
                     lastEmittedRef.current = markdown;
                     onChangeText(markdown);
                 } catch (e) {
                     console.error('[RichTextEditor] Sync Failed:', e);
                 }
             }
        }
    });

    editorInstanceRef.current = editor;

    // Sync external value changes to editor (e.g. prompt result)
    useEffect(() => {
        if (editor && value !== lastEmittedRef.current) {
             const newHtml = `<style>${customCSS}</style>` + toHtml(value);
             editor.setContent(newHtml);
             lastEmittedRef.current = value;
        }
    }, [value, editor]);

    return (
         <View style={[styles.container, containerStyle]}>
            <View style={styles.editorContainer}>
                <RichText
                    editor={editor}
                    style={[styles.editor, inputStyle]}
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
        padding: 8,
        paddingVertical: 4,
        // alignItems: 'flex-start', // REMOVED to allow stretch (default) so toolbar fills height
    },
    editor: {
        flex: 1,
        backgroundColor: 'transparent',
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
