import { sillyTavernWorldInfoSchema } from '$lib/schemas/legacy-sillytavern';
import { createWorldBook, type WorldBookEntry } from '$lib/schemas/worldbook';
import { createCompatReport } from './report';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function mapPosition(position: unknown, extensions: Record<string, unknown> = {}): WorldBookEntry['position'] {
  if (position === undefined || position === null) {
    return extensions.position === undefined || extensions.position === null ? 'before' : mapPosition(extensions.position);
  }
  if (typeof position === 'string') {
    if (position === 'after_char' || position === 'after') return 'after';
    if (position === 'at_depth' || position === 'depth') return 'depth';
    return 'before';
  }
  if (position === 1) return 'after';
  if (position === 4) return 'depth';
  return 'before';
}

function mapRole(role: unknown, extensions: Record<string, unknown> = {}): WorldBookEntry['role'] {
  if (role === undefined || role === null) {
    return extensions.role === undefined || extensions.role === null ? 'system' : mapRole(extensions.role);
  }
  if (role === 'user' || role === 1) return 'user';
  if (role === 'assistant' || role === 2) return 'assistant';
  return 'system';
}

export function mapSillyTavernWorldBookEntry(rawEntry: unknown, index: number): WorldBookEntry {
  const entry = asRecord(rawEntry);
  const extensions = asRecord(entry.extensions);
  const enabled = typeof entry.enabled === 'boolean' ? entry.enabled : entry.disable !== true;
  const probability = asNumber(entry.probability, asNumber(extensions.probability, 100));

  return {
    id: String(entry.uid ?? entry.id ?? index),
    keys: asStringArray(entry.key ?? entry.keys),
    secondaryKeys: asStringArray(entry.keysecondary ?? entry.secondary_keys),
    comment: String(entry.comment ?? ''),
    content: String(entry.content ?? ''),
    constant: entry.constant === true,
    selective: entry.selective === true,
    enabled,
    order: asNumber(entry.order, asNumber(entry.insertion_order, 100)),
    position: mapPosition(entry.position, extensions),
    depth: asNumber(entry.depth, asNumber(extensions.depth, 4)),
    role: mapRole(entry.role, extensions),
    probability,
    extensions: {
      ...extensions,
      ...(entry.use_regex !== undefined ? { use_regex: entry.use_regex } : {}),
      ...(entry.position !== undefined ? { position_name: entry.position } : {})
    }
  };
}

export function importSillyTavernWorldBook(raw: unknown, fallbackName = 'Imported World Book') {
  const parsed = sillyTavernWorldInfoSchema.parse(raw);
  const report = createCompatReport('worldbook');
  const entriesSource = Array.isArray(parsed.entries) ? parsed.entries : Object.values(parsed.entries);

  const entries: WorldBookEntry[] = entriesSource.map(mapSillyTavernWorldBookEntry);

  report.mapped.push('entries', 'key/keys', 'keysecondary/secondary_keys', 'content', 'position', 'depth', 'role', 'extensions.probability');
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
