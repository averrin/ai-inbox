import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface ProseMarkEditorProps {
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    containerStyle?: any;
    editorStyle?: any;
    inputStyle?: any;

    // Toolbar actions
    onAttach?: () => Promise<void>;
    onReminder?: () => void;
    onCreateReminder?: () => void;
    onCamera?: () => Promise<void>;
    onRecord?: () => void;
    recording?: boolean;
    // Focus callbacks
    onFocus?: () => void;
    onBlur?: () => void;
}

export const ProseMarkEditor = ({
    value = '',
    onChangeText,
    placeholder = 'Start typing...',
    autoFocus = false,
    disabled = false,
    containerStyle,
    editorStyle,
    inputStyle,
    onAttach,
    onReminder,
    onCreateReminder,
    onCamera,
    onRecord,
    recording,
    onFocus,
    onBlur,
}: ProseMarkEditorProps) => {
    const webViewRef = useRef<WebView>(null);
    const [isWebViewLoaded, setIsWebViewLoaded] = useState(false);
    const lastValueRef = useRef(value);

    const showToolbar = !!(onAttach || onReminder || onCreateReminder || onCamera || onRecord);

    const htmlContent = useMemo(() => `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          body { margin: 0; padding: 0; background-color: transparent; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          .cm-editor { height: 100vh; background-color: transparent !important; outline: none !important; }
          .cm-scroller { overflow: auto; font-family: inherit; }
          .cm-content { padding: 16px; font-family: inherit; font-size: 16px; line-height: 1.5; }
          .cm-line { padding: 0; }

          /* ProseMark Theme Overrides for Dark Mode */
          :root {
              --pm-header-mark-color: #6366f1; /* indigo-500 */
              --pm-link-color: #818cf8; /* indigo-400 */
              --pm-muted-color: #64748b; /* slate-500 */
              --pm-code-background-color: #1e293b; /* slate-800 */
              --pm-code-btn-background-color: #334155; /* slate-700 */
              --pm-blockquote-vertical-line-background-color: #334155; /* slate-700 */
              --pm-cursor-color: #f8fafc;
          }
        </style>
        <script type="module">
          import {EditorView, basicSetup} from "https://esm.sh/codemirror";
          import {markdown} from "https://esm.sh/@codemirror/lang-markdown";
          import {languages} from "https://esm.sh/@codemirror/language-data";
          import {
             prosemarkBasicSetup,
             prosemarkBaseThemeSetup,
             prosemarkMarkdownSyntaxExtensions
          } from "https://esm.sh/@prosemark/core";

          let editor;

          function initEditor(initialDoc) {
              if (editor) return;

              const extensions = [
                  basicSetup, // CodeMirror basic setup
                  markdown({
                      codeLanguages: languages,
                      extensions: [prosemarkMarkdownSyntaxExtensions]
                  }),
                  prosemarkBasicSetup(),
                  prosemarkBaseThemeSetup(),
                  EditorView.updateListener.of((update) => {
                      if (update.docChanged) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                              type: 'onChange',
                              payload: update.state.doc.toString()
                          }));
                      }
                      if (update.focusChanged) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                              type: update.view.hasFocus ? 'focus' : 'blur'
                          }));
                      }
                  }),
                   EditorView.theme({
                      "&": { backgroundColor: "transparent", color: "#f8fafc" },
                      ".cm-content": { caretColor: "#f8fafc" },
                      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#f8fafc" },
                      "&.cm-focused": { outline: "none" }
                  }, {dark: true})
              ];

              editor = new EditorView({
                  doc: initialDoc || "",
                  parent: document.getElementById('editor'),
                  extensions: extensions
              });
          }

          window.addEventListener('message', (event) => {
              try {
                  const data = JSON.parse(event.data);
                  if (data.type === 'init') {
                      initEditor(data.payload);
                  } else if (data.type === 'setValue') {
                      if (editor) {
                          const currentDoc = editor.state.doc.toString();
                          if (currentDoc !== data.payload) {
                              editor.dispatch({
                                  changes: {from: 0, to: currentDoc.length, insert: data.payload}
                              });
                          }
                      }
                  }
              } catch (e) {
                  // console.error(e);
              }
          });

          // Signal ready
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        </script>
        </head>
        <body>
        <div id="editor"></div>
        </body>
        </html>
    `, []);

    const onMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'ready') {
                setIsWebViewLoaded(true);
                webViewRef.current?.postMessage(JSON.stringify({
                    type: 'init',
                    payload: value
                }));
            } else if (data.type === 'onChange') {
                const text = data.payload;
                if (text !== lastValueRef.current) {
                    lastValueRef.current = text;
                    onChangeText?.(text);
                }
            } else if (data.type === 'focus') {
                onFocus?.();
            } else if (data.type === 'blur') {
                onBlur?.();
            }
        } catch (e) {
            console.error('[ProseMarkEditor] Message Error:', e);
        }
    };

    useEffect(() => {
        if (isWebViewLoaded && value !== lastValueRef.current) {
            webViewRef.current?.postMessage(JSON.stringify({
                type: 'setValue',
                payload: value
            }));
            lastValueRef.current = value;
        }
    }, [value, isWebViewLoaded]);

    return (
        <View style={[styles.container, containerStyle]}>
            <View style={[styles.editorContainer, editorStyle]}>
                <View style={[styles.webViewContainer, inputStyle]}>
                    <WebView
                        ref={webViewRef}
                        source={{ html: htmlContent }}
                        style={styles.webView}
                        onMessage={onMessage}
                        originWhitelist={['*']}
                        hideKeyboardAccessoryView={true}
                        scrollEnabled={true}
                        nestedScrollEnabled={true}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        pointerEvents={disabled ? 'none' : 'auto'}
                    />
                     {!isWebViewLoaded && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="small" color="#818cf8" />
                        </View>
                    )}
                </View>

                {/* Toolbar */}
                {showToolbar && (
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
                )}
            </View>
        </View>
    );
};

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
    },
    webViewContainer: {
        flex: 1,
        backgroundColor: 'transparent', // webview is transparent
    },
    webView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
    },
    toolbar: {
        width: 44,
        paddingTop: 6,
        paddingBottom: 6,
        alignItems: 'center',
        gap: 6,
        borderLeftWidth: 1,
        borderLeftColor: '#334155', // slate-700
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
