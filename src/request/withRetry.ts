import type { RetryOptions } from '../types';

const DEFAULT_RETRY_ON = [408, 429, 500, 502, 503, 504];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };

  const status = record.status ?? record.statusCode ?? record.response?.status;

  return typeof status === 'number' ? status : undefined;
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = Math.max(0, options.retries ?? 0);
  const delayMs = Math.max(0, options.delayMs ?? 100);
  const retryOn = options.retryOn ?? DEFAULT_RETRY_ON;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      const status = getErrorStatus(error);
      const canRetry = attempt < retries && status !== undefined && retryOn.includes(status);

      if (!canRetry) {
        throw error;
      }

      await delay(delayMs * (attempt + 1));
    }
  }
}
