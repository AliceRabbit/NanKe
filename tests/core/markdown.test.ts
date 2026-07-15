import { describe, expect, it } from 'vitest';
import { renderMessageMarkdown } from '$lib/ui/markdown';

describe('message markdown rendering', () => {
  it('renders markdown and trims leading display whitespace', () => {
    const html = renderMessageMarkdown('\n\n*该回去了。*');

    expect(html).toContain('<em>该回去了。</em>');
    expect(html.startsWith('\n')).toBe(false);
  });

  it('sanitizes scripts while preserving and scoping compatible style selectors', () => {
    const html = renderMessageMarkdown(
      '<style>.kz-w>summary, .card:is(.open, .focused){display:block;color:tomato}</style><script>alert(1)</script>ok'
    );
    const scope = html.match(/data-message-style-scope="([^"]+)"/)?.[1];

    expect(scope).toMatch(/^nk-[a-z0-9]+$/);
    expect(html).toContain(`[data-message-style-scope="${scope}"] .kz-w>summary`);
    expect(html).toContain(`[data-message-style-scope="${scope}"] .card:is(.open, .focused)`);
    expect(html).toContain('display: block');
    expect(html).toContain('color: tomato');
    expect(html).not.toContain('<script>');
  });

  it('drops global selectors but keeps safe selectors from the same rule', () => {
    const html = renderMessageMarkdown(`
      <style>
        body, html .outside, :root, #app, [id="svelte"] .outside, .inside { color: red; }
      </style>
      <div class="inside">safe</div>
    `);
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

    expect(css).toContain('] .inside { color: red; }');
    expect(css).not.toMatch(/\bbody\b|\bhtml\b|:root|#app|id="svelte"/);
  });

  it('drops at-rules and their nested global side effects', () => {
    const html = renderMessageMarkdown(`
      <style>
        @import url("https://example.com/theme.css");
        @font-face { font-family: attack; src: url("https://example.com/font.woff2"); }
        @keyframes takeover { from { opacity: 0 } to { opacity: 1 } }
        @media (min-width: 1px) { body { display: none } }
        .inside { border: 1px solid currentColor; }
      </style>
      <div class="inside">safe</div>
    `);
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

    expect(css).toContain('border: 1px solid currentColor');
    expect(css).not.toMatch(/@import|@font-face|@keyframes|@media|takeover|example\.com/);
  });

  it('removes declarations that can load resources or escape the message viewport', () => {
    const html = renderMessageMarkdown(`
      <style>
        .inside {
          color: rgb(1 2 3);
          position: fixed;
          inset: 0;
          z-index: 999999;
          width: 100vw;
          background-image: url("https://example.com/tracker.png");
          transform: translateX(-1000px);
          border-radius: 12px;
        }
      </style>
      <div class="inside">safe</div>
    `);
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

    expect(css).toContain('color: rgb(1 2 3)');
    expect(css).toContain('border-radius: 12px');
    expect(css).not.toMatch(/position:|inset:|z-index:|100vw|url\(|translateX/i);
  });

  it('detects comment, CSS escape and HTML entity obfuscation', () => {
    const markdown = String.raw`
      <style>
        b\6f dy { color: red; }
        .inside { background-image: u/**/rl("https://example.com/a"); position: f\69xed; color: green; }
      </style>
      <div class="inside" style="color: green&#59; position: fixed">safe</div>
    `;
    const html = renderMessageMarkdown(markdown);
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

    expect(css).toContain('color: green');
    expect(css).not.toMatch(/body|background-image|position|example\.com/i);
    expect(html).not.toContain('style="color: green&#59; position: fixed"');
  });

  it('sanitizes dangerous inline styles without removing ordinary presentation', () => {
    const html = renderMessageMarkdown(
      '<div style="color: tomato; position: sticky; z-index: 10; background: url(https://example.com/a.png); padding: 4px">safe</div>'
    );

    expect(html).toContain('style="color: tomato; padding: 4px"');
    expect(html).not.toMatch(/position:|z-index:|url\(|example\.com/);
  });

  it('removes an empty unsafe style block without adding a scope wrapper', () => {
    const html = renderMessageMarkdown('<style>body { display: none }</style>still visible');

    expect(html).toContain('still visible');
    expect(html).not.toContain('<style>');
    expect(html).not.toContain('data-message-style-scope');
  });
});
