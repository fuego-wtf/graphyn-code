import { useState, useCallback } from 'react';
import { useApp } from 'ink';

export interface ErrorState {
  error: Error | null;
  isError: boolean;
}

export const useErrorHandler = () => {
  const { exit } = useApp();
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false
  });

  const handleError = useCallback((error: Error | unknown, exitOnError = false) => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    console.error('Error:', errorObj.message);
    
    setErrorState({
      error: errorObj,
      isError: true
    });

    if (exitOnError) {
      setTimeout(() => exit(new Error(errorObj.message)), 100);
    }
  }, [exit]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false
    });
  }, []);

  const wrapAsync = useCallback(<T,>(asyncFn: () => Promise<T>) => {
    return async () => {
      try {
        return await asyncFn();
      } catch (error) {
        handleError(error);
        throw error;
      }
    };
  }, [handleError]);

  return {
    error: errorState.error,
    isError: errorState.isError,
    handleError,
    clearError,
    wrapAsync
  };
};