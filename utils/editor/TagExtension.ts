import { BridgeExtension } from '@10play/tentap-editor';
import TagNode from '../../components/editor/TagNode';

const tiptapExtensionCode = `
const Tag = Node.create({
  name: 'tag',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tag: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="tag"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
        'span', 
        { 
            'data-type': 'tag', 
            'data-tag': node.attrs.tag,
            ...HTMLAttributes 
        },
    ];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /(?:^|\\s)(#[a-zA-Z0-9_\\-]+)(?=$|\\s)/,
        type: this.type,
        getAttributes: (match) => {
          return {
            tag: match[1],
          };
        },
      }),
    ];
  },
});
`;

export const TagExtension = new BridgeExtension({
    tiptapExtension: tiptapExtensionCode as any,
    tiptapExtensionDeps: [],
    NodeEditor: TagNode,
} as any);
