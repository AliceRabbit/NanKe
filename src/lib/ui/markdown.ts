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

function hardenLinks(html: string): string {
  return html.replace(/<a\s/gi, '<a target="_blank" rel="noreferrer noopener" ');
}

function normalizeStyleTags(html: string): string {
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs: string, css: string) => {
    const normalizedCss = css.replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return `<style${attrs}>${normalizedCss}</style>`;
  });
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

export function renderMessageMarkdown(markdown: string): string {
  const html = marked.parse(markdown.trim(), { async: false }) as string;
  return normalizeStyleTags(hardenLinks(sanitizeHtml(html)));
}
