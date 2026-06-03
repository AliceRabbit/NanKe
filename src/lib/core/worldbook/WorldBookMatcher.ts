import type { WorldBookEntry } from '$lib/schemas/worldbook';

export type WorldBookMatchOptions = {
  caseSensitive?: boolean;
  wholeWords?: boolean;
};

function normalize(value: string, caseSensitive: boolean): string {
  return caseSensitive ? value : value.toLowerCase();
}

function boolExtension(entry: WorldBookEntry, key: string): boolean | undefined {
  const value = entry.extensions[key];
  return typeof value === 'boolean' ? value : undefined;
}

function keyMatches(text: string, key: string, options: Required<WorldBookMatchOptions>, useRegex: boolean): boolean {
  if (!key.trim()) return false;
  if (useRegex) {
    try {
      return new RegExp(key, options.caseSensitive ? 'u' : 'iu').test(text);
    } catch {
      return false;
    }
  }
  const haystack = normalize(text, options.caseSensitive);
  const needle = normalize(key, options.caseSensitive);
  if (!options.wholeWords) return haystack.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, options.caseSensitive ? '' : 'i').test(text);
}

export function matchWorldBookEntry(entry: WorldBookEntry, scanText: string, options: WorldBookMatchOptions = {}): string[] {
  if (entry.constant) return ['constant'];
  if (!entry.enabled || entry.keys.length === 0) return [];
  const useProbability = boolExtension(entry, 'useProbability') ?? boolExtension(entry, 'use_probability') ?? true;
  if (useProbability) {
    if (entry.probability <= 0) return [];
    if (entry.probability < 100 && Math.random() * 100 >= entry.probability) return [];
  }

  const resolvedOptions = {
    caseSensitive: boolExtension(entry, 'case_sensitive') ?? options.caseSensitive ?? false,
    wholeWords: boolExtension(entry, 'match_whole_words') ?? options.wholeWords ?? false
  };
  const useRegex = boolExtension(entry, 'use_regex') ?? false;

  const primaryMatches = entry.keys.filter((key) => keyMatches(scanText, key, resolvedOptions, useRegex));
  if (primaryMatches.length === 0) return [];
  if (!entry.selective || entry.secondaryKeys.length === 0) return primaryMatches;

  const secondaryMatches = entry.secondaryKeys.filter((key) => keyMatches(scanText, key, resolvedOptions, useRegex));
  return secondaryMatches.length > 0 ? [...primaryMatches, ...secondaryMatches] : [];
}
