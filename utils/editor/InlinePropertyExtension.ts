import { BridgeExtension } from '@10play/tentap-editor';
import InlinePropertyNode from '../../components/editor/InlinePropertyNode';

// We inject the Tiptap extension code via string.
// Note: We assume 'Node' and 'nodeInputRule' are available in the editor's global scope or TenTap context.
// If TenTap standard bundle doesn't expose them globally, this might require adjustments (e.g. bundle rebuild).
// However, TenTap documentation suggests this pattern for custom nodes.
const tiptapExtensionCode = `
const InlineProperty = Node.create({
  name: 'inlineProperty',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      key: {
        default: '',
      },
      value: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-property"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
        'span', 
        { 
            'data-type': 'inline-property', 
            'data-key': node.attrs.key,
            'data-value': node.attrs.value,
            ...HTMLAttributes 
        },
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\\[([a-zA-Z0-9_]+)::([^\\]]+)\\]$/,
        type: this.type,
        getAttributes: (match) => {
          return {
            key: match[1],
            value: match[2],
          };
        },
      }),
    ];
  },
});
`;

export const InlinePropertyExtension = new BridgeExtension({
    tiptapExtension: tiptapExtensionCode as any,
    tiptapExtensionDeps: [],
    NodeEditor: InlinePropertyNode,
} as any);
