import { sillyTavernWorldInfoSchema } from '$lib/schemas/legacy-sillytavern';
import { createWorldBook, type WorldBookEntry } from '$lib/schemas/worldbook';
import { createCompatReport } from './report';

function mapPosition(position: number): WorldBookEntry['position'] {
  if (position === 1) return 'after';
  if (position === 4) return 'depth';
  return 'before';
}

function mapRole(role: unknown): WorldBookEntry['role'] {
  if (role === 'user' || role === 1) return 'user';
  if (role === 'assistant' || role === 2) return 'assistant';
  return 'system';
}

export function importSillyTavernWorldBook(raw: unknown, fallbackName = 'Imported World Book') {
  const parsed = sillyTavernWorldInfoSchema.parse(raw);
  const report = createCompatReport('worldbook');
  const entriesSource = Array.isArray(parsed.entries) ? parsed.entries : Object.values(parsed.entries);

  const entries: WorldBookEntry[] = entriesSource.map((entry, index) => ({
    id: String(entry.uid ?? index),
    keys: entry.key,
    secondaryKeys: entry.keysecondary,
    comment: entry.comment,
    content: entry.content,
    constant: entry.constant,
    selective: entry.selective,
    enabled: !entry.disable,
    order: entry.order,
    position: mapPosition(entry.position),
    depth: entry.depth,
    role: mapRole(entry.role),
    probability: entry.probability,
    extensions: {}
  }));

  report.mapped.push('entries', 'key', 'keysecondary', 'content', 'position', 'depth', 'role');
  if (parsed.extensions) report.preservedAsExtras.push('extensions');

  return {
    worldBook: createWorldBook({
      name: parsed.name ?? fallbackName,
      entries,
      legacy: { source: 'sillytavern', raw, report }
    }),
    report
  };
}
