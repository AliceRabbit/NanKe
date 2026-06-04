import { describe, expect, it } from 'vitest';
import { renderMessageMarkdown } from '$lib/ui/markdown';

describe('message markdown rendering', () => {
  it('renders markdown and trims leading display whitespace', () => {
    const html = renderMessageMarkdown('\n\n*该回去了。*');

    expect(html).toContain('<em>该回去了。</em>');
    expect(html.startsWith('\n')).toBe(false);
  });

  it('sanitizes scripts while preserving compatible style selectors', () => {
    const html = renderMessageMarkdown('<style>.kz-w>summary{display:block}</style><script>alert(1)</script>ok');

    expect(html).toContain('.kz-w>summary');
    expect(html).not.toContain('<script>');
  });
});
