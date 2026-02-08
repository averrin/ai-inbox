import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

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
    const webViewRef = useRef<WebView>(null);
    const [isWebViewLoaded, setIsWebViewLoaded] = useState(false);
    const lastValueRef = useRef(value);

    // HTML Template for Tiptap
    const htmlContent = useMemo(() => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <style>
                * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
                html, body {
                    background-color: #0f172a;
                    color: #f8fafc;
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 16px;
                    line-height: 1.6;
                    min-height: 100vh;
                }
                #editor {
                    min-height: 100vh;
                    padding: 20px;
                    outline: none;
                }
                .ProseMirror {
                    min-height: 100vh;
                }
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #64748b;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
                /* Additional Tiptap styles */
                .ProseMirror blockquote { border-left: 3px solid #334155; padding-left: 1rem; margin-left: 0; color: #94a3b8; }
                .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; }
                .ProseMirror code { background-color: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
                .ProseMirror pre { background: #1e293b; color: #e2e8f0; padding: 0.75rem 1rem; border-radius: 0.5rem; }
                .ProseMirror pre code { background: none; color: inherit; padding: 0; }
            </style>
            <script src="https://unpkg.com/@tiptap/standalone@latest"></script>
        </head>
        <body>
            <div id="editor"></div>
            <script>
                const { Editor } = Tiptap;
                const { StarterKit } = Tiptap.extensions;
                const { Placeholder } = Tiptap.extensions;

                let isUpdating = false;

                const editor = new Editor({
                    element: document.querySelector('#editor'),
                    extensions: [
                        StarterKit,
                        Placeholder.configure({
                            placeholder: '${placeholder}',
                        }),
                    ],
                    content: '',
                    autofocus: true,
                    onUpdate({ editor }) {
                        if (isUpdating) return;
                        const html = editor.getHTML();
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'onChange',
                            payload: html
                        }));
                    },
                });

                window.addEventListener('message', (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'setContent') {
                            isUpdating = true;
                            editor.commands.setContent(data.payload, false);
                            isUpdating = false;
                        }
                    } catch (e) {
                        console.error('Error handling message:', e);
                    }
                });

                // Signal that we are ready
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
            </script>
        </body>
        </html>
    `, [placeholder]);

    // Handle messages from WebView
    const onMessage = async (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'ready') {
                setIsWebViewLoaded(true);
                // Send initial content
                if (value) {
                    webViewRef.current?.postMessage(JSON.stringify({
                        type: 'setContent',
                        payload: value // In this version, we might want to convert MD -> HTML if value is MD
                    }));
                }
            } else if (data.type === 'onChange') {
                // For "Dump" we might just keep HTML or convert to MD
                // Given the existing useDumpFile logic expects markdown, let's stick to that if possible
                // But simpler raw tiptap might just save HTML for now or we use Turndown in React Native side
                const html = data.payload;
                
                // We'll need to convert HTML to Markdown to maintain compatibility with useDumpFile
                const TurndownService = (await import('turndown')).default;
                const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
                const markdown = turndown.turndown(html);
                
                if (markdown !== lastValueRef.current) {
                    lastValueRef.current = markdown;
                    onChange(markdown);
                }
            }
        } catch (e) {
            console.error('[DumpEditor] WebView Message Error:', e);
        }
    };

    // Sync external value changes
    useEffect(() => {
        if (isWebViewLoaded && value !== lastValueRef.current) {
            // Need MD -> HTML conversion
            const convertMdToHtml = async (md: string) => {
                const { marked } = await import('marked');
                return marked.parse(md, { async: false }) as string;
            };

            convertMdToHtml(value).then(html => {
                webViewRef.current?.postMessage(JSON.stringify({
                    type: 'setContent',
                    payload: html
                }));
            });
            lastValueRef.current = value;
        }
    }, [value, isWebViewLoaded]);

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#818cf8" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                source={{ html: htmlContent }}
                style={styles.webView}
                onMessage={onMessage}
                originWhitelist={['*']}
                hideKeyboardAccessoryView={true} // Cleaner mobile feel
                keyboardDisplayRequiresUserAction={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webView: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    }
});

