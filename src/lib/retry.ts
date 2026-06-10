/**
 * Retry utility with exponential backoff.
 * Default: 3 attempts with delays of 1s, 2s, 4s.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delays = [1000, 2000, 4000]
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a rate limit error
      if (isRateLimitError(error)) {
        const waitTime = getRetryAfter(error) || 60000;
        await sleep(waitTime);
        continue;
      }

      // Don't retry on validation errors
      if (isValidationError(error)) {
        throw error;
      }

      // Wait with backoff before next attempt
      if (attempt < maxAttempts - 1) {
        const delay = delays[attempt] || delays[delays.length - 1];
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retry attempts exhausted');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') || error.message.includes('rate limit');
  }
  return false;
}

function isValidationError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('validation') || error.message.includes('400');
  }
  return false;
}

function getRetryAfter(error: unknown): number | null {
  // Extract Retry-After header value if present
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as any).headers;
    const retryAfter = headers?.get?.('retry-after') || headers?.['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
  }
  return null;
}
