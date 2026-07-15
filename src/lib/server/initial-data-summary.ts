import type { Character } from '$lib/schemas/character';
import type { WorldBook } from '$lib/schemas/worldbook';

export function characterSummary(character: Character): Character {
  const { characterBook: _characterBook, depthPrompt: _depthPrompt, legacy, extensions: _extensions, ...summary } = character;
  return {
    ...summary,
    extensions: {},
    legacy: legacy ? { source: 'sillytavern', raw: null, report: null } : undefined
  };
}

export function worldBookSummary(worldBook: WorldBook): WorldBook {
  const { legacy: _legacy, ...summary } = worldBook;
  return {
    ...summary,
    entries: []
  };
}
