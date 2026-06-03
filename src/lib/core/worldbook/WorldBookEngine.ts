import type { NankeMessage } from '$lib/schemas/message';
import type { WorldBook } from '$lib/schemas/worldbook';
import { matchWorldBookEntry } from './WorldBookMatcher';
import type { ActivatedWorldEntry } from './WorldBookActivation';

export type WorldBookEngineOptions = {
  scanDepth?: number;
  includeNames?: boolean;
  caseSensitive?: boolean;
  wholeWords?: boolean;
  maxEntries?: number;
};

export class WorldBookEngine {
  activate(worldBooks: WorldBook[], messages: NankeMessage[], options: WorldBookEngineOptions = {}): ActivatedWorldEntry[] {
    const scanDepth = options.scanDepth ?? 8;
    const scanMessages = messages.slice(-scanDepth);
    const scanText = scanMessages
      .map((message) => (options.includeNames && message.name ? `${message.name}: ${message.content}` : message.content))
      .join('\n');

    const activated: ActivatedWorldEntry[] = [];
    for (const worldBook of worldBooks) {
      for (const entry of worldBook.entries) {
        const matchedKeys = matchWorldBookEntry(entry, scanText, {
          caseSensitive: options.caseSensitive,
          wholeWords: options.wholeWords
        });
        if (matchedKeys.length === 0) continue;
        activated.push({
          worldBookId: worldBook.id,
          worldBookName: worldBook.name,
          entry,
          matchedKeys,
          reason: entry.constant ? 'constant entry' : `matched ${matchedKeys.join(', ')}`
        });
      }
    }

    return activated
      .sort((a, b) => a.entry.order - b.entry.order)
      .slice(0, options.maxEntries ?? Number.POSITIVE_INFINITY);
  }
}
