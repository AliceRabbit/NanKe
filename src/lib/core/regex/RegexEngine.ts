import type { RegexPlacement, RegexScript } from '$lib/schemas/regex';

export const REGEX_PLACEMENT = {
  MD_DISPLAY: 0,
  USER_INPUT: 1,
  AI_OUTPUT: 2,
  SLASH_COMMAND: 3,
  WORLD_INFO: 5,
  REASONING: 6
} as const satisfies Record<string, RegexPlacement>;

export type RegexApplyOptions = {
  placement: RegexPlacement;
  isMarkdown?: boolean;
  isPrompt?: boolean;
  isEdit?: boolean;
  depth?: number;
  macros?: Record<string, string | undefined>;
};

function renderMacros(value: string, macros: Record<string, string | undefined> = {}, escape = false): string {
  return value.replace(/\{\{([\w.-]+)\}\}/g, (match, key: string) => {
    const replacement = macros[key];
    if (replacement === undefined) return match;
    return escape ? escapeRegExp(replacement) : replacement;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function splitRegexLiteral(value: string): { pattern: string; flags: string } | undefined {
  if (!value.startsWith('/')) return undefined;
  let escaped = false;
  for (let index = value.length - 1; index > 0; index -= 1) {
    const char = value[index];
    if (char === '/' && !escaped) {
      return {
        pattern: value.slice(1, index),
        flags: value.slice(index + 1)
      };
    }
    escaped = char === '\\' && !escaped;
    if (char !== '\\') escaped = false;
  }
  return undefined;
}

function normalizeFlags(flags: string): string {
  const supported = new Set(['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']);
  const result: string[] = [];
  for (const flag of flags) {
    if (!supported.has(flag) || result.includes(flag)) continue;
    result.push(flag);
  }
  return result.join('');
}

export function regexFromSillyTavernString(value: string, options: Pick<RegexApplyOptions, 'macros'> = {}, substituteRegex = 0): RegExp | undefined {
  const substituted =
    substituteRegex === 1 ? renderMacros(value, options.macros, false) : substituteRegex === 2 ? renderMacros(value, options.macros, true) : value;
  const literal = splitRegexLiteral(substituted.trim());
  const pattern = literal?.pattern ?? substituted;
  const flags = normalizeFlags(literal?.flags ?? 'gmu');

  try {
    return new RegExp(pattern, flags);
  } catch {
    return undefined;
  }
}

function trimCapture(value: string, trimStrings: string[]): string {
  let result = value;
  for (const trim of trimStrings) {
    if (trim) result = result.replaceAll(trim, '');
  }
  return result;
}

function replacementValue(token: string, match: string, captures: string[], groups: Record<string, string> | undefined, trimStrings: string[]): string {
  if (token === '$$') return '$';
  if (token === '$&' || token === '$0') return trimCapture(match, trimStrings);
  const named = /^\$<([^>]+)>$/.exec(token);
  if (named) return trimCapture(groups?.[named[1]] ?? '', trimStrings);
  const numbered = /^\$(\d{1,2})$/.exec(token);
  if (numbered) {
    const index = Number(numbered[1]) - 1;
    return trimCapture(captures[index] ?? '', trimStrings);
  }
  return token;
}

function renderReplacement(template: string, args: unknown[], trimStrings: string[], macros: Record<string, string | undefined> | undefined): string {
  const match = String(args[0] ?? '');
  const groups = typeof args.at(-1) === 'object' ? (args.at(-1) as Record<string, string> | undefined) : undefined;
  const captures = args.slice(1, groups ? -3 : -2).map((item) => String(item ?? ''));
  const rendered = renderMacros(template, macros).replace(/\{\{match\}\}/gi, '$0');

  return rendered.replace(/\$\$|\$&|\$0|\$\d{1,2}|\$<[^>]+>/g, (token) => replacementValue(token, match, captures, groups, trimStrings));
}

function scriptAppliesToSurface(script: RegexScript, options: RegexApplyOptions): boolean {
  if (script.markdownOnly && options.isMarkdown) return true;
  if (script.promptOnly && options.isPrompt) return true;
  return !script.markdownOnly && !script.promptOnly && !options.isMarkdown && !options.isPrompt;
}

export function shouldApplyRegexScript(script: RegexScript, options: RegexApplyOptions): boolean {
  if (script.disabled) return false;
  if (!script.findRegex.trim()) return false;
  if (!script.placement.includes(options.placement)) return false;
  if (options.isEdit && !script.runOnEdit) return false;
  if (options.depth !== undefined) {
    if (script.minDepth !== undefined && script.minDepth !== null && options.depth < script.minDepth) return false;
    if (script.maxDepth !== undefined && script.maxDepth !== null && options.depth > script.maxDepth) return false;
  }
  return scriptAppliesToSurface(script, options);
}

export function hasRegexScriptForPlacement(scripts: RegexScript[], options: RegexApplyOptions): boolean {
  return scripts.some((script) => shouldApplyRegexScript(script, options));
}

export function applyRegexScripts(value: string, scripts: RegexScript[], options: RegexApplyOptions): string {
  let result = value;
  for (const script of scripts) {
    if (!shouldApplyRegexScript(script, options)) continue;
    const regex = regexFromSillyTavernString(script.findRegex, options, script.substituteRegex);
    if (!regex) continue;
    result = result.replace(regex, (...args: unknown[]) => renderReplacement(script.replaceString, args, script.trimStrings, options.macros));
  }
  return result;
}
