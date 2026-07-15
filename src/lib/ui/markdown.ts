import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import { marked } from 'marked';

marked.use({
  async: false,
  breaks: false,
  gfm: true
});

const sanitizerConfig: Config = {
  ADD_TAGS: ['style'],
  ADD_ATTR: ['class', 'style', 'open', 'aria-label', 'aria-hidden', 'role', 'target', 'rel'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onmouseenter', 'onmouseleave']
};

const MAX_EMBEDDED_CSS_LENGTH = 20_000;
const MAX_RULE_COUNT = 128;
const MAX_SELECTOR_LENGTH = 1_024;
const MAX_DECLARATION_COUNT = 128;
const MAX_DECLARATION_VALUE_LENGTH = 2_048;
const colonTarget = new Set([':']);
const ruleBoundaryTargets = new Set(['{', ';']);

const deniedProperties = new Set([
  'animation',
  'animation-delay',
  'animation-direction',
  'animation-duration',
  'animation-fill-mode',
  'animation-iteration-count',
  'animation-name',
  'animation-play-state',
  'animation-timing-function',
  'behavior',
  'inset',
  'inset-block',
  'inset-block-end',
  'inset-block-start',
  'inset-inline',
  'inset-inline-end',
  'inset-inline-start',
  'left',
  '-moz-binding',
  'right',
  'top',
  'bottom',
  '-webkit-user-modify',
  'z-index'
]);

function hardenLinks(html: string): string {
  return html.replace(/<a\s/gi, '<a target="_blank" rel="noreferrer noopener" ');
}

function fallbackSanitize(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '');
}

function sanitizeHtml(html: string): string {
  const purifier = DOMPurify as unknown as { sanitize?: (dirty: string, config?: Config) => string };
  if (typeof purifier.sanitize === 'function') return purifier.sanitize(html, sanitizerConfig);
  return fallbackSanitize(html);
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, '');
}

function decodeCssEscapesForInspection(value: string): string {
  return value
    .replace(/\\(?:\r\n|[\r\n\f])/g, '')
    .replace(/\\([0-9a-f]{1,6})(?:\s)?/gi, (_match, hex: string) => {
      const point = Number.parseInt(hex, 16);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .replace(/\\([^\r\n])/g, '$1');
}

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote = '';
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') parentheses += 1;
    else if (character === ')' && parentheses > 0) parentheses -= 1;
    else if (character === '[') brackets += 1;
    else if (character === ']' && brackets > 0) brackets -= 1;
    else if (character === separator && parentheses === 0 && brackets === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

function findTopLevelCharacter(value: string, start: number, targets: ReadonlySet<string>): number {
  let quote = '';
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;

  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') parentheses += 1;
    else if (character === ')' && parentheses > 0) parentheses -= 1;
    else if (character === '[') brackets += 1;
    else if (character === ']' && brackets > 0) brackets -= 1;
    else if (parentheses === 0 && brackets === 0 && targets.has(character)) return index;
  }

  return -1;
}

function findClosingBrace(value: string, openIndex: number): number {
  let quote = '';
  let escaped = false;
  let depth = 1;

  for (let index = openIndex + 1; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function selectorIsSafe(selector: string): boolean {
  if (!selector || selector.length > MAX_SELECTOR_LENGTH) return false;
  const inspected = decodeCssEscapesForInspection(selector).toLowerCase();

  if (/[\u0000-\u001f<{}@&]/.test(inspected)) return false;
  if (/(^|[\s>+~,(])(?:html|body)(?=$|[\s>+~.#:[,)])/.test(inspected)) return false;
  if (/:root\b|:host\b|:global\b|::slotted\b|::part\b/.test(inspected)) return false;
  if (/:has\s*\(/.test(inspected)) return false;
  if (/#(?:app|svelte)(?=$|[\s>+~.#:[,)])/.test(inspected)) return false;
  if (/\[\s*id\s*[*^$|~]?=\s*["']?(?:app|svelte)/.test(inspected)) return false;
  return true;
}

function declarationIsSafe(property: string, value: string): boolean {
  const normalizedProperty = property.toLowerCase();
  if (deniedProperties.has(normalizedProperty)) return false;
  const inspected = decodeCssEscapesForInspection(stripCssComments(value)).toLowerCase().replace(/\s+/g, '');

  if (normalizedProperty === 'position' && !/^(?:static|relative)(?:!important)?$/.test(inspected)) return false;
  if (normalizedProperty === 'background-attachment' && /\bfixed\b/.test(inspected)) return false;

  if (
    /(?:url|image-set|-webkit-image-set|cross-fade|element|expression)\(/.test(inspected) ||
    /(?:javascript|vbscript|data):/.test(inspected) ||
    inspected.includes('@import') ||
    inspected.includes('-moz-binding')
  ) {
    return false;
  }
  // Character references are meaningful in style attributes after HTML parsing and can hide a denied token.
  if (/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(value)) return false;

  // Viewport-sized decorations can visually leave a message even when their selector cannot.
  if (/(?:^|[^a-z0-9_.-])(?:\d*\.)?\d+(?:d|s|l)?v(?:w|h|min|max)\b/.test(inspected)) return false;
  if (
    normalizedProperty === 'transform' &&
    /(?:translate(?:3d|[xyz])?|matrix(?:3d)?|perspective|var)\(/.test(inspected)
  ) {
    return false;
  }
  return true;
}

function sanitizeDeclarations(block: string): string {
  const safeDeclarations: string[] = [];

  for (const rawDeclaration of splitTopLevel(block, ';').slice(0, MAX_DECLARATION_COUNT)) {
    const colonIndex = findTopLevelCharacter(rawDeclaration, 0, colonTarget);
    if (colonIndex < 1) continue;

    const property = rawDeclaration.slice(0, colonIndex).trim();
    const value = rawDeclaration.slice(colonIndex + 1).trim();
    if (!/^(?:--[a-z0-9_-]+|-?[a-z][a-z0-9-]*)$/i.test(property)) continue;
    if (!value || value.length > MAX_DECLARATION_VALUE_LENGTH) continue;
    if (!declarationIsSafe(property, value)) continue;
    safeDeclarations.push(`${property.toLowerCase()}: ${value}`);
  }

  return safeDeclarations.join('; ');
}

function scopeSelectorList(selectorList: string, scopeSelector: string): string {
  return splitTopLevel(selectorList, ',')
    .map((selector) => selector.trim())
    .filter(selectorIsSafe)
    .map((selector) => `${scopeSelector} ${selector}`)
    .join(', ');
}

function sanitizeEmbeddedCss(css: string, scopeSelector: string): string {
  const source = stripCssComments(css).slice(0, MAX_EMBEDDED_CSS_LENGTH);
  const safeRules: string[] = [];
  let index = 0;

  while (index < source.length && safeRules.length < MAX_RULE_COUNT) {
    while (/\s/.test(source[index] ?? '')) index += 1;
    if (index >= source.length) break;

    const boundary = findTopLevelCharacter(source, index, ruleBoundaryTargets);
    if (boundary < 0) break;
    const header = source.slice(index, boundary).trim();

    if (source[boundary] === ';') {
      // Top-level statements (notably @import and @namespace) are never retained.
      index = boundary + 1;
      continue;
    }

    const closeIndex = findClosingBrace(source, boundary);
    if (closeIndex < 0) break;
    const block = source.slice(boundary + 1, closeIndex);
    index = closeIndex + 1;

    // All at-rules are dropped. This prevents global keyframes, fonts, imports and nested escape hatches.
    if (!header || header.startsWith('@') || /[{}]/.test(block)) continue;

    const scopedSelectors = scopeSelectorList(header, scopeSelector);
    const declarations = sanitizeDeclarations(block);
    if (scopedSelectors && declarations) safeRules.push(`${scopedSelectors} { ${declarations}; }`);
  }

  return safeRules.join('\n');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function sanitizeInlineStyleAttributes(html: string): string {
  return html.replace(
    /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (_match, doubleQuoted: string | undefined, singleQuoted: string | undefined, unquoted: string | undefined) => {
      const declarations = sanitizeDeclarations(doubleQuoted ?? singleQuoted ?? unquoted ?? '');
      return declarations ? ` style="${escapeAttribute(declarations)}"` : '';
    }
  );
}

function stableScopeToken(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `nk-${(hash >>> 0).toString(36)}`;
}

function scopeEmbeddedStyleTags(html: string, scopeToken: string): { html: string; hasScopedStyles: boolean } {
  const scopeSelector = `[data-message-style-scope="${scopeToken}"]`;
  let hasScopedStyles = false;
  const scopedHtml = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    const normalizedCss = css.replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const safeCss = sanitizeEmbeddedCss(normalizedCss, scopeSelector);
    if (!safeCss) return '';
    hasScopedStyles = true;
    return `<style>${safeCss}</style>`;
  });
  return { html: scopedHtml, hasScopedStyles };
}

export function renderMessageMarkdown(markdown: string): string {
  const parsedHtml = marked.parse(markdown.trim(), { async: false }) as string;
  const sanitizedHtml = sanitizeInlineStyleAttributes(hardenLinks(sanitizeHtml(parsedHtml)));
  const scopeToken = stableScopeToken(sanitizedHtml);
  const scoped = scopeEmbeddedStyleTags(sanitizedHtml, scopeToken);

  if (!scoped.hasScopedStyles) return scoped.html;
  return `<div class="nanke-message-scope" data-message-style-scope="${scopeToken}" style="display: contents">${scoped.html}</div>`;
}
