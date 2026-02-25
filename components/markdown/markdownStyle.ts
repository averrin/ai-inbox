import { Platform } from 'react-native';
import type { MarkdownStyle } from '@expensify/react-native-live-markdown';
import { Colors } from '../ui/design-tokens';

const FONT_FAMILY_MONOSPACE = Platform.select({
  ios: 'Courier',
  default: 'monospace',
});

const FONT_FAMILY_EMOJI = Platform.select({
  ios: 'System',
  android: 'Noto Color Emoji',
  default: 'System, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji',
});

export const markdownStyle: MarkdownStyle = {
  syntax: {
    color: Colors.text.tertiary,
  },
  link: {
    color: Colors.primary,
  },
  h1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  blockquote: {
    borderColor: Colors.border,
    borderWidth: 4,
    marginLeft: 0,
    paddingLeft: 12,
    color: Colors.text.secondary,
    backgroundColor: Colors.surface,
  },
  code: {
    fontFamily: FONT_FAMILY_MONOSPACE,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.surfaceHighlight,
  },
  pre: {
    fontFamily: FONT_FAMILY_MONOSPACE,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.surfaceHighlight,
    padding: 12,
    borderRadius: 8,
  },
  mentionHere: {
    color: Colors.success,
    backgroundColor: 'rgba(34, 197, 94, 0.1)', // green-500/10
  },
  mentionUser: {
    color: Colors.info,
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // blue-500/10
  },
  emoji: {
      fontSize: 20,
      fontFamily: FONT_FAMILY_EMOJI
  }
};
