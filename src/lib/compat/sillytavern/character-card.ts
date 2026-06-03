import { Buffer } from 'node:buffer';
import { createCharacter } from '$lib/schemas/character';
import { sillyTavernCharacterV1Schema, sillyTavernCharacterV2Schema } from '$lib/schemas/legacy-sillytavern';
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

export function importSillyTavernCharacterCard(raw: unknown) {
  const report = createCompatReport('character-card');
  const v2 = sillyTavernCharacterV2Schema.safeParse(raw);
  if (v2.success) {
    report.mapped.push('data.name', 'data.description', 'data.personality', 'data.scenario', 'data.first_mes', 'data.mes_example');
    report.preservedAsExtras.push('data.extensions');
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
        tags: v2.data.data.tags,
        legacy: { source: 'sillytavern', raw, report }
      }),
      report
    };
  }

  const v1 = sillyTavernCharacterV1Schema.parse(raw);
  report.mapped.push('name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example');
  report.warnings.push('Imported a v1 card; creator notes and extension fields were not available.');
  return {
    character: createCharacter({
      name: v1.name,
      description: v1.description,
      personality: v1.personality,
      scenario: v1.scenario,
      firstMessage: v1.first_mes,
      exampleMessages: v1.mes_example,
      legacy: { source: 'sillytavern', raw, report }
    }),
    report
  };
}
