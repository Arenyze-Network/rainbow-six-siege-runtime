import { R6RuntimeTimeoutError } from '../types';

export function withTimeout<T>(promise: Promise<T>, timeout?: number): Promise<T> {
  if (typeof timeout !== 'number' || timeout <= 0) {
    return promise;
  }

  let timer: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new R6RuntimeTimeoutError(timeout));
    }, timeout);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}
