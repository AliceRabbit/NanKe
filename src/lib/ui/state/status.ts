export const STATUS_KINDS = ['idle', 'loading', 'success', 'warning', 'error'] as const;

export type StatusKind = (typeof STATUS_KINDS)[number];
export type AsyncPhase = 'idle' | 'loading' | 'success' | 'error';
export type ToastDismissReason = 'manual' | 'timeout';

export type AppStatus = Readonly<{
  kind: StatusKind;
  message: string;
  detail?: string;
  operation?: string;
  updatedAt: number;
}>;

export type CreateStatusOptions = Readonly<{
  detail?: string;
  operation?: string;
  updatedAt?: number;
}>;

export type AsyncState<T> =
  | Readonly<{ phase: 'idle'; data?: T }>
  | Readonly<{ phase: 'loading'; data?: T; startedAt: number }>
  | Readonly<{ phase: 'success'; data: T; completedAt: number }>
  | Readonly<{ phase: 'error'; data?: T; error: unknown; completedAt: number }>;

export type AppToast = AppStatus &
  Readonly<{
    id: string;
    title?: string;
    duration: number | null;
    dismissible: boolean;
  }>;

export type CreateToastOptions = CreateStatusOptions &
  Readonly<{
    id?: string;
    title?: string;
    /** `null` or `0` keeps the toast visible until it is dismissed. */
    duration?: number | null;
    dismissible?: boolean;
  }>;

const DEFAULT_TOAST_DURATION: Readonly<Record<StatusKind, number | null>> = {
  idle: 4_000,
  loading: null,
  success: 4_000,
  warning: 6_000,
  error: null
};

let toastSequence = 0;

function cleanOptionalText(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function resolveDuration(kind: StatusKind, duration: number | null | undefined): number | null {
  if (duration === null || duration === 0) return null;
  if (duration === undefined) return DEFAULT_TOAST_DURATION[kind];
  if (!Number.isFinite(duration) || duration < 0) return DEFAULT_TOAST_DURATION[kind];
  return Math.round(duration);
}

export function isStatusKind(value: unknown): value is StatusKind {
  return typeof value === 'string' && (STATUS_KINDS as readonly string[]).includes(value);
}

export function createAppStatus(
  kind: StatusKind,
  message: string,
  options: CreateStatusOptions = {}
): AppStatus {
  return {
    kind,
    message: message.trim(),
    detail: cleanOptionalText(options.detail),
    operation: cleanOptionalText(options.operation),
    updatedAt: options.updatedAt ?? Date.now()
  };
}

export const appStatus = {
  idle: (message: string, options?: CreateStatusOptions) => createAppStatus('idle', message, options),
  loading: (message: string, options?: CreateStatusOptions) => createAppStatus('loading', message, options),
  success: (message: string, options?: CreateStatusOptions) => createAppStatus('success', message, options),
  warning: (message: string, options?: CreateStatusOptions) => createAppStatus('warning', message, options),
  error: (message: string, options?: CreateStatusOptions) => createAppStatus('error', message, options)
} as const;

export function createToast(
  kind: StatusKind,
  message: string,
  options: CreateToastOptions = {}
): AppToast {
  const status = createAppStatus(kind, message, options);
  const id = cleanOptionalText(options.id) ?? `toast-${status.updatedAt}-${++toastSequence}`;

  return {
    ...status,
    id,
    title: cleanOptionalText(options.title),
    duration: resolveDuration(kind, options.duration),
    dismissible: options.dismissible ?? true
  };
}

export function statusToToast(status: AppStatus, options: CreateToastOptions = {}): AppToast {
  return createToast(status.kind, status.message, {
    detail: status.detail,
    operation: status.operation,
    updatedAt: status.updatedAt,
    ...options
  });
}

export function idleAsync<T>(data?: T): AsyncState<T> {
  return data === undefined ? { phase: 'idle' } : { phase: 'idle', data };
}

export function loadingAsync<T>(data?: T, startedAt = Date.now()): AsyncState<T> {
  return data === undefined ? { phase: 'loading', startedAt } : { phase: 'loading', data, startedAt };
}

export function successAsync<T>(data: T, completedAt = Date.now()): AsyncState<T> {
  return { phase: 'success', data, completedAt };
}

export function errorAsync<T>(error: unknown, data?: T, completedAt = Date.now()): AsyncState<T> {
  return data === undefined
    ? { phase: 'error', error, completedAt }
    : { phase: 'error', data, error, completedAt };
}

export function isAsyncPending<T>(state: AsyncState<T>): state is Extract<AsyncState<T>, { phase: 'loading' }> {
  return state.phase === 'loading';
}
