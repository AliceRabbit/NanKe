import { Buffer } from 'node:buffer';
import { inflateSync } from 'node:zlib';
import { createCharacter } from '$lib/schemas/character';
import { createWorldBook } from '$lib/schemas/worldbook';
import { sillyTavernCharacterBookSchema, sillyTavernCharacterV1Schema, sillyTavernCharacterV2Schema } from '$lib/schemas/legacy-sillytavern';
import { mapSillyTavernWorldBookEntry } from './worldbook';
import { createCompatReport } from './report';

function extractPngTextChunks(buffer: Uint8Array): Array<{ keyword: string; text: string }> {
  const bytes = Buffer.from(buffer);
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('Not a PNG file.');

  const chunks: Array<{ keyword: string; text: string }> = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === 'tEXt') {
      const data = bytes.subarray(dataStart, dataEnd);
      const separator = data.indexOf(0);
      if (separator > -1) {
        chunks.push({
          keyword: data.subarray(0, separator).toString('latin1'),
          text: data.subarray(separator + 1).toString('latin1')
        });
      }
    } else if (type === 'zTXt') {
      const data = bytes.subarray(dataStart, dataEnd);
      const separator = data.indexOf(0);
      if (separator > -1) {
        chunks.push({
          keyword: data.subarray(0, separator).toString('latin1'),
          text: inflateSync(data.subarray(separator + 2)).toString('utf8')
        });
      }
    } else if (type === 'iTXt') {
      const data = bytes.subarray(dataStart, dataEnd);
      const keywordEnd = data.indexOf(0);
      if (keywordEnd > -1 && data.length > keywordEnd + 3) {
        const compressionFlag = data[keywordEnd + 1];
        let cursor = keywordEnd + 3;
        const languageEnd = data.indexOf(0, cursor);
        if (languageEnd < 0) {
          offset = dataEnd + 4;
          continue;
        }
        cursor = languageEnd + 1;
        const translatedEnd = data.indexOf(0, cursor);
        if (translatedEnd < 0) {
          offset = dataEnd + 4;
          continue;
        }
        cursor = translatedEnd + 1;
        const textBytes = data.subarray(cursor);
        chunks.push({
          keyword: data.subarray(0, keywordEnd).toString('utf8'),
          text: compressionFlag ? inflateSync(textBytes).toString('utf8') : textBytes.toString('utf8')
        });
      }
    }
    offset = dataEnd + 4;
  }
  return chunks;
}

export function readSillyTavernCardJsonFromPng(buffer: Uint8Array): unknown {
  const chunks = extractPngTextChunks(buffer);
  const chunk = chunks.find((item) => item.keyword.toLowerCase() === 'ccv3') ?? chunks.find((item) => item.keyword.toLowerCase() === 'chara');
  if (!chunk) throw new Error('PNG card does not contain chara or ccv3 metadata.');
  const json = Buffer.from(chunk.text, 'base64').toString('utf8');
  return JSON.parse(json);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function mapRole(role: unknown): 'system' | 'user' | 'assistant' {
  if (role === 'user' || role === 1) return 'user';
  if (role === 'assistant' || role === 2) return 'assistant';
  return 'system';
}

export function importSillyTavernCharacterCard(raw: unknown) {
  const report = createCompatReport('character-card');
  const v2 = sillyTavernCharacterV2Schema.safeParse(raw);
  if (v2.success) {
    const data = asRecord(v2.data.data);
    const extensions = asRecord(data.extensions);
    const characterBookRaw = data.character_book;
    const characterBookParsed = characterBookRaw ? sillyTavernCharacterBookSchema.safeParse(characterBookRaw) : undefined;
    const characterBook = characterBookParsed?.success
      ? createWorldBook({
          name: characterBookParsed.data.name ?? `${v2.data.data.name} Character Book`,
          entries: characterBookParsed.data.entries.map(mapSillyTavernWorldBookEntry),
          legacy: { source: 'sillytavern', raw: characterBookRaw, report }
        })
      : undefined;
    const depthPrompt = asRecord(extensions.depth_prompt);

    report.mapped.push(
      'data.name',
      'data.description',
      'data.personality',
      'data.scenario',
      'data.first_mes',
      'data.mes_example',
      'data.creator_notes',
      'data.system_prompt',
      'data.post_history_instructions',
      'data.alternate_greetings',
      'data.group_only_greetings',
      'data.tags',
      'data.creator',
      'data.character_version',
      'data.character_book',
      'data.extensions.depth_prompt',
      'data.extensions.talkativeness',
      'data.extensions.fav'
    );
    report.preservedAsExtras.push('data.extensions', 'top-level legacy fields');
    if (characterBookRaw && !characterBookParsed?.success) {
      report.unsupported.push('data.character_book');
      report.warnings.push('Character book metadata was present but did not match a supported Tavern Book shape.');
    }

    return {
      character: createCharacter({
        name: v2.data.data.name,
        description: v2.data.data.description,
        personality: v2.data.data.personality,
        scenario: v2.data.data.scenario,
        firstMessage: v2.data.data.first_mes,
        exampleMessages: v2.data.data.mes_example,
        creatorNotes: v2.data.data.creator_notes,
        systemPrompt: v2.data.data.system_prompt,
        postHistoryInstructions: v2.data.data.post_history_instructions,
        alternateGreetings: v2.data.data.alternate_greetings,
        groupOnlyGreetings: asStringArray(data.group_only_greetings),
        tags: v2.data.data.tags,
        creator: v2.data.data.creator,
        creatorComment: String(asRecord(raw).creatorcomment ?? ''),
        characterVersion: v2.data.data.character_version,
        talkativeness: asNumber(extensions.talkativeness ?? asRecord(raw).talkativeness),
        favorite: Boolean(extensions.fav ?? asRecord(raw).fav ?? false),
        extensions,
        characterBook,
        depthPrompt: depthPrompt.prompt
          ? {
              prompt: String(depthPrompt.prompt),
              depth: asNumber(depthPrompt.depth) ?? 4,
              role: mapRole(depthPrompt.role)
            }
          : undefined,
        legacy: { source: 'sillytavern', raw, report }
      }),
      report
    };
  }

  const v1 = sillyTavernCharacterV1Schema.parse(raw);
  report.mapped.push('name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creatorcomment', 'tags', 'talkativeness', 'fav');
  report.warnings.push('Imported a v1 card; structured Tavern Card v2/v3 metadata was not available.');
  return {
    character: createCharacter({
      name: v1.name,
      description: v1.description,
      personality: v1.personality,
      scenario: v1.scenario,
      firstMessage: v1.first_mes,
      exampleMessages: v1.mes_example,
      creatorComment: v1.creatorcomment,
      tags: v1.tags,
      talkativeness: asNumber(v1.talkativeness),
      favorite: v1.fav ?? false,
      legacy: { source: 'sillytavern', raw, report }
    }),
    report
  };
}
