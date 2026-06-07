import { describe, expect, it } from 'vitest';
import { createCharacter } from '$lib/schemas/character';
import { createMessage } from '$lib/schemas/message';
import { createWorldBook } from '$lib/schemas/worldbook';
import { WorldBookEngine } from '$lib/core/worldbook/WorldBookEngine';
import { activeCharacterWorldBookIds } from '$lib/server/services/GenerationAppService';

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

  it('normalizes character world book bindings without losing legacy ids', () => {
    const character = createCharacter({
      name: 'Archivist',
      worldBookIds: ['global-lore'],
      worldBookBindings: [{ worldBookId: 'character-lore', enabled: false, primary: true }]
    });

    expect(character.worldBookIds).toEqual(['global-lore', 'character-lore']);
    expect(character.worldBookBindings).toEqual([
      { worldBookId: 'global-lore', enabled: true, primary: false },
      { worldBookId: 'character-lore', enabled: false, primary: true }
    ]);
    expect(activeCharacterWorldBookIds(character)).toEqual(['global-lore']);
  });

  it('treats embedded character books as enabled only until bindings become explicit', () => {
    const embedded = createWorldBook({ id: 'embedded-lore', name: 'Embedded Lore' });
    const imported = createCharacter({ name: 'Card Character', characterBook: embedded });
    expect(imported.worldBookBindings).toEqual([{ worldBookId: 'embedded-lore', enabled: true, primary: true }]);
    expect(activeCharacterWorldBookIds(imported)).toEqual(['embedded-lore']);

    const unbound = createCharacter({
      ...imported,
      worldBookIds: [],
      worldBookBindings: []
    });
    expect(unbound.worldBookBindings).toEqual([]);
    expect(activeCharacterWorldBookIds(unbound)).toEqual([]);
  });
});
