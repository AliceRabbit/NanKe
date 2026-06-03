import { json } from '@sveltejs/kit';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly code = 'app_error'
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return json({ error: { code: 'internal_error', message } }, { status: 500 });
}
