export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: number;
  maxDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    maxDelay = 30000,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const retryDelay = Math.min(delay * Math.pow(backoff, attempt - 1), maxDelay);
      
      if (onRetry) {
        onRetry(lastError, attempt);
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError!;
}

export function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND') {
    return true;
  }

  // HTTP errors that are retryable
  if (error.status === 429 || // Too Many Requests
      error.status === 502 || // Bad Gateway
      error.status === 503 || // Service Unavailable
      error.status === 504) { // Gateway Timeout
    return true;
  }

  // Fetch errors
  if (error.message?.includes('fetch failed') ||
      error.message?.includes('network')) {
    return true;
  }

  return false;
}