import { Buffer } from 'node:buffer';
import {
  importSillyTavernChatJsonl,
  importSillyTavernCharacterCard,
  importSillyTavernPreset,
  importSillyTavernWorldBook,
  readSillyTavernCardJsonFromPng
} from '$lib/compat/sillytavern';
import { createConversation } from '$lib/schemas/conversation';
import type { Character } from '$lib/schemas/character';
import type { WorldBook } from '$lib/schemas/worldbook';
import type { createRequestContext } from '$lib/server/request-context';
import { AppError } from '$lib/server/errors';
import { AssetStore } from '$lib/storage/assets/AssetStore';

export type ImportKind = 'character-card-json' | 'character-card-png' | 'worldbook' | 'preset' | 'chat-jsonl';

export class ImportAppService {
  constructor(
    private readonly context: ReturnType<typeof createRequestContext>,
    private readonly assets = new AssetStore()
  ) {}

  private saveCharacterWithBoundWorldBooks(character: Character): Character {
    const worldBookIds = new Set(character.worldBookIds ?? []);
    let embeddedBook = character.characterBook;

    if (embeddedBook) {
      const sourceBook = embeddedBook;
      const worldBook: WorldBook = {
        ...sourceBook,
        metadata: {
          ...sourceBook.metadata,
          source: 'character-card',
          characterId: character.id,
          characterName: character.name
        },
        entries: sourceBook.entries.map((entry) => ({ ...entry, worldBookId: sourceBook.id }))
      };
      const savedBook = this.context.worldBooks.save(worldBook);
      embeddedBook = savedBook;
      worldBookIds.add(savedBook.id);
    }

    return this.context.characters.save({
      ...character,
      worldBookIds: [...worldBookIds],
      characterBook: embeddedBook
    });
  }

  import(kind: ImportKind, data: unknown, name?: string) {
    if (kind === 'character-card-json') {
      const { character, report } = importSillyTavernCharacterCard(data);
      const saved = this.saveCharacterWithBoundWorldBooks(character);
      this.context.importReports.save(report);
      return { type: 'character', item: saved, report };
    }

    if (kind === 'character-card-png') {
      if (typeof data !== 'string') throw new AppError('PNG import expects base64 data.', 400, 'invalid_import_data');
      const base64 = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
      const pngBytes = Buffer.from(base64, 'base64');
      const raw = readSillyTavernCardJsonFromPng(pngBytes);
      const { character, report } = importSillyTavernCharacterCard(raw);
      const asset = this.assets.save(pngBytes, `${name ?? character.name}.png`);
      const saved = this.saveCharacterWithBoundWorldBooks({ ...character, avatarAssetId: asset.id });
      this.context.importReports.save(report);
      return { type: 'character', item: saved, report };
    }

    if (kind === 'worldbook') {
      const { worldBook, report } = importSillyTavernWorldBook(data, name);
      const saved = this.context.worldBooks.save(worldBook);
      this.context.importReports.save(report);
      return { type: 'worldbook', item: saved, report };
    }

    if (kind === 'preset') {
      const { profile, report, kind: presetKind } = importSillyTavernPreset(data, name);
      const saved = this.context.profiles.save(profile);
      this.context.importReports.save(report);
      return { type: 'profile', presetKind, item: saved, report };
    }

    if (kind === 'chat-jsonl') {
      if (typeof data !== 'string') throw new AppError('Chat JSONL import expects string data.', 400, 'invalid_import_data');
      const conversation = this.context.conversations.save(createConversation({ title: name ?? 'Imported Chat' }));
      const { messages, metadata, report } = importSillyTavernChatJsonl(data, conversation.id);
      for (const message of messages) this.context.conversations.appendMessage(message);
      const saved = this.context.conversations.save({ ...conversation, metadata });
      this.context.importReports.save(report);
      return { type: 'conversation', item: saved, messages, report };
    }

    throw new AppError(`Unsupported import kind: ${kind}`, 400, 'unsupported_import_kind');
  }
}
