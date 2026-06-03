import type { WorldBookEntry } from '$lib/schemas/worldbook';

export type WorldBookMatchOptions = {
  caseSensitive?: boolean;
  wholeWords?: boolean;
};

function normalize(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLowerCase();
}

function keyMatches(text: string, key: string, options: Required<WorldBookMatchOptions>): boolean {
  if (!key.trim()) return false;
  const haystack = normalize(text, options.caseSensitive);
  const needle = normalize(key, options.caseSensitive);
  if (!options.wholeWords) return haystack.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, options.caseSensitive ? '' : 'i').test(text);
}

export function matchWorldBookEntry(entry: WorldBookEntry, scanText: string, options: WorldBookMatchOptions = {}): string[] {
  if (entry.constant) return ['constant'];
  if (!entry.enabled || entry.keys.length === 0) return [];

  const resolvedOptions = {
    caseSensitive: options.caseSensitive ?? false,
    wholeWords: options.wholeWords ?? false
  };

  const primaryMatches = entry.keys.filter((key) => keyMatches(scanText, key, resolvedOptions));
  if (primaryMatches.length === 0) return [];
  if (!entry.selective || entry.secondaryKeys.length === 0) return primaryMatches;

  const secondaryMatches = entry.secondaryKeys.filter((key) => keyMatches(scanText, key, resolvedOptions));
  return secondaryMatches.length > 0 ? [...primaryMatches, ...secondaryMatches] : [];
}
