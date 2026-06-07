import { describe, expect, it } from 'vitest';
import { getLocale, t } from '../../src/lib/i18n';

describe('i18n', () => {
  it('uses zh-CN as the default locale', () => {
    expect(getLocale()).toBe('zh-CN');
  });

  it('interpolates Chinese UI strings', () => {
    expect(t('chat.deleteConfirm', { title: '测试聊天' })).toBe('删除“测试聊天”？此操作无法撤销。');
  });
});
