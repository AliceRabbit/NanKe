import { describe, expect, it } from 'vitest';
import { createMessage } from '$lib/schemas/message';
import { createWorldBook } from '$lib/schemas/worldbook';
import { WorldBookEngine } from '$lib/core/worldbook/WorldBookEngine';

describe('WorldBookEngine', () => {
  it('activates entries when primary keys match recent chat', () => {
    const worldBook = createWorldBook({
      name: 'Lore',
      entries: [
        {
          id: 'eldoria',
          keys: ['Eldoria'],
          secondaryKeys: [],
          comment: 'Eldoria',
          content: 'Eldoria is a forest.',
          constant: false,
          selective: false,
          enabled: true,
          order: 100,
          position: 'before',
          depth: 4,
          role: 'system',
          probability: 100,
          extensions: {}
        }
      ]
    });

    const engine = new WorldBookEngine();
    const result = engine.activate([worldBook], [createMessage({ role: 'user', content: 'Tell me about eldoria.' })]);

    expect(result).toHaveLength(1);
    expect(result[0].matchedKeys).toEqual(['Eldoria']);
  });
});
