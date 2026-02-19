
import { parseTaskLine, serializeTaskLine } from './taskParser';

describe('TaskParser', () => {

    it('should parse basic task', () => {
        const line = '- [ ] Basic Task';
        const parsed = parseTaskLine(line);
        expect(parsed).toBeTruthy();
        expect(parsed!.title).toBe('Basic Task');
        expect(parsed!.completed).toBe(false);
        expect(serializeTaskLine(parsed!)).toBe(line);
    });

    it('should parse task with properties', () => {
        const line = '- [ ] Task [p:: 1]';
        const parsed = parseTaskLine(line);
        expect(parsed!.properties['p']).toBe('1');
        expect(parsed!.title).toBe('Task');
        // Serialization normalizes
        expect(serializeTaskLine(parsed!)).toBe('- [ ] Task [p:: 1]');
    });

    it('should handle duplicate properties in input', () => {
        // Input has dups
        const line = '- [ ] Task [p:: 1] [p:: 2]';
        const parsed = parseTaskLine(line);
        // Last one wins usually, or first one?
        // In my logic: first one found? No, I iterate through string.
        // keys loop: if I set properties[key], it overwrites.
        // So last propert wins.
        expect(parsed!.properties['p']).toBe('2');
        expect(parsed!.title).toBe('Task');

        const serialized = serializeTaskLine(parsed!);
        // Should only have one
        const count = (serialized.match(/\[p::/g) || []).length;
        expect(count).toBe(1);
    });

    it('should handle nested brackets in properties (e.g. links)', () => {
        const line = '- [ ] Task [link:: [Google](https://google.com)]';
        const parsed = parseTaskLine(line);

        expect(parsed!.properties['link']).toBe('[Google](https://google.com)');
        expect(parsed!.title).toBe('Task');

        const serialized = serializeTaskLine(parsed!);
        expect(serialized).toBe(line);
    });

    it('should handle property neighbors correctly', () => {
        const line = '- [ ] Task [key:: value]neighbor';
        const parsed = parseTaskLine(line);
        // "neighbor" is NOT inside the property bracket [ ... ]
        // So it should be part of the title.

        expect(parsed!.properties['key']).toBe('value');
        expect(parsed!.title).toBe('Task neighbor');

        // Serialization puts properties at the end.
        const serialized = serializeTaskLine(parsed!);
        expect(serialized).toBe('- [ ] Task neighbor [key:: value]');
    });

    it('should handle multiple interspersed properties', () => {
        const line = '- [ ] Start [p:: 1] Middle [q:: 2] End';
        const parsed = parseTaskLine(line);
        expect(parsed!.title).toBe('Start Middle End');
        expect(parsed!.properties['p']).toBe('1');
        expect(parsed!.properties['q']).toBe('2');

        const serialized = serializeTaskLine(parsed!);
        expect(serialized).toContain('Start Middle End');
        expect(serialized).toContain('[p:: 1]');
        expect(serialized).toContain('[q:: 2]');
    });

});
