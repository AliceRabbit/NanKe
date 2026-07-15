import { describe, expect, it } from 'vitest';
import {
  appStatus,
  createToast,
  errorAsync,
  idleAsync,
  isAsyncPending,
  loadingAsync,
  statusToToast,
  successAsync
} from '$lib/ui/state/status';

describe('application status primitives', () => {
  it('builds immutable-shaped, timestamped status values', () => {
    const status = appStatus.loading('  正在保存  ', {
      operation: 'save-profile',
      detail: '  请稍候  ',
      updatedAt: 42
    });

    expect(status).toEqual({
      kind: 'loading',
      message: '正在保存',
      operation: 'save-profile',
      detail: '请稍候',
      updatedAt: 42
    });
  });

  it('uses sensible toast lifetimes and preserves source status metadata', () => {
    const success = appStatus.success('已保存', { operation: 'save', updatedAt: 100 });
    const successToast = statusToToast(success, { id: 'save-success' });
    const errorToast = createToast('error', '保存失败', { id: 'save-error', updatedAt: 101 });

    expect(successToast).toMatchObject({
      id: 'save-success',
      kind: 'success',
      message: '已保存',
      operation: 'save',
      duration: 4_000
    });
    expect(errorToast.duration).toBeNull();
  });

  it('represents async lifecycle states without losing existing data', () => {
    const idle = idleAsync({ value: 1 });
    const loading = loadingAsync(idle.data, 10);
    const success = successAsync({ value: 2 }, 20);
    const failure = errorAsync(new Error('failed'), success.data, 30);

    expect(isAsyncPending(loading)).toBe(true);
    expect(isAsyncPending(success)).toBe(false);
    expect(failure).toMatchObject({ phase: 'error', data: { value: 2 }, completedAt: 30 });
  });
});
