import { describe, expect, it } from 'vitest';
import { createCharacter } from '../../src/lib/schemas/character';
import { createWorldBook } from '../../src/lib/schemas/worldbook';
import { characterSummary, worldBookSummary } from '../../src/lib/server/initial-data-summary';

const entry = {
  id: 'entry',
  keys: [],
  secondaryKeys: [],
  comment: '',
  content: 'large lore',
  constant: false,
  selective: false,
  enabled: true,
  order: 100,
  position: 'before' as const,
  depth: 4,
  role: 'system' as const,
  probability: 100,
  extensions: {}
};

describe('initial data summaries', () => {
  it('keeps home and chat fields while removing large character payloads', () => {
    const worldBook = createWorldBook({ name: 'Embedded', entries: [entry] });
    const character = createCharacter({
      name: 'Alice',
      description: 'description',
      firstMessage: 'hello',
      avatarAssetId: 'avatar',
      characterBook: worldBook,
      extensions: { large: 'payload' },
      legacy: { source: 'sillytavern', raw: { large: 'raw' }, report: { warnings: [] } }
    });

    const summary = characterSummary(character);

    expect(summary).toMatchObject({
      id: character.id,
      name: 'Alice',
      description: 'description',
      firstMessage: 'hello',
      avatarAssetId: 'avatar',
      extensions: {},
      legacy: { source: 'sillytavern', raw: null, report: null }
    });
    expect(summary.characterBook).toBeUndefined();
    expect(summary.depthPrompt).toBeUndefined();
  });

  it('keeps world-book identity and metadata while deferring entries and legacy data', () => {
    const worldBook = createWorldBook({
      name: 'Lore',
      entries: [entry],
      metadata: { source: 'sillytavern-import', characterId: 'character' },
      legacy: { source: 'sillytavern', raw: { large: 'raw' }, report: { warnings: [] } }
    });

    const summary = worldBookSummary(worldBook);

    expect(summary.id).toBe(worldBook.id);
    expect(summary.name).toBe('Lore');
    expect(summary.metadata).toEqual(worldBook.metadata);
    expect(summary.entries).toEqual([]);
    expect(summary.legacy).toBeUndefined();
  });
});
