import { useState, useCallback } from 'react';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export const useRetry = (options: RetryOptions = {}) => {
  const { maxRetries = 3, retryDelay = 1000, onRetry } = options;
  const [attempt, setAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(async <T,>(
    fn: () => Promise<T>
  ): Promise<T> => {
    setAttempt(0);
    
    const executeWithRetry = async (currentAttempt: number): Promise<T> => {
      try {
        const result = await fn();
        setAttempt(0);
        setIsRetrying(false);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        
        if (currentAttempt < maxRetries) {
          setAttempt(currentAttempt + 1);
          setIsRetrying(true);
          
          if (onRetry) {
            onRetry(currentAttempt + 1, err);
          }
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return executeWithRetry(currentAttempt + 1);
        }
        
        setIsRetrying(false);
        throw err;
      }
    };
    
    return executeWithRetry(0);
  }, [maxRetries, retryDelay, onRetry]);

  return {
    retry,
    attempt,
    isRetrying,
    maxRetries
  };
};