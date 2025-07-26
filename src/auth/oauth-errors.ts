import chalk from 'chalk';

export enum OAuthErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_CLIENT = 'INVALID_CLIENT',
  INVALID_GRANT = 'INVALID_GRANT',
  UNAUTHORIZED_CLIENT = 'UNAUTHORIZED_CLIENT',
  ACCESS_DENIED = 'ACCESS_DENIED',
  UNSUPPORTED_RESPONSE_TYPE = 'UNSUPPORTED_RESPONSE_TYPE',
  INVALID_SCOPE = 'INVALID_SCOPE',
  SERVER_ERROR = 'SERVER_ERROR',
  TEMPORARILY_UNAVAILABLE = 'TEMPORARILY_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  USER_CANCELLED = 'USER_CANCELLED'
}

export class OAuthError extends Error {
  constructor(
    public readonly code: OAuthErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly userAction?: string
  ) {
    super(message);
    this.name = 'OAuthError';
    Error.captureStackTrace(this, OAuthError);
  }
  
  static fromResponse(response: Response, body?: any): OAuthError {
    const error = body?.error || 'unknown_error';
    const description = body?.error_description || 'An error occurred during authentication';
    
    const errorMap: Record<string, { code: OAuthErrorCode; retryable: boolean; action?: string }> = {
      'invalid_request': {
        code: OAuthErrorCode.INVALID_REQUEST,
        retryable: false,
        action: 'Please try authenticating again'
      },
      'invalid_grant': {
        code: OAuthErrorCode.INVALID_GRANT,
        retryable: false,
        action: 'Your session has expired. Please authenticate again'
      },
      'access_denied': {
        code: OAuthErrorCode.ACCESS_DENIED,
        retryable: false,
        action: 'You must grant access to continue'
      },
      'server_error': {
        code: OAuthErrorCode.SERVER_ERROR,
        retryable: true,
        action: 'Please try again in a few moments'
      },
      'temporarily_unavailable': {
        code: OAuthErrorCode.TEMPORARILY_UNAVAILABLE,
        retryable: true,
        action: 'Service is temporarily unavailable. Please try again later'
      }
    };
    
    const mapping = errorMap[error] || {
      code: OAuthErrorCode.SERVER_ERROR,
      retryable: response.status >= 500
    };
    
    return new OAuthError(
      mapping.code,
      description,
      response.status,
      mapping.retryable,
      mapping.action
    );
  }
  
  toUserMessage(): string {
    const baseMessage = `Authentication failed: ${this.message}`;
    if (this.userAction) {
      return `${baseMessage}\n${this.userAction}`;
    }
    return baseMessage;
  }
}

export class OAuthErrorHandler {
  static handle(error: any): never {
    const colors = {
      error: chalk.red,
      info: chalk.gray,
      warning: chalk.yellow
    };
    
    if (error instanceof OAuthError) {
      console.error(colors.error(error.toUserMessage()));
      
      if (error.retryable) {
        console.log(colors.info('This error may be temporary. Retrying...'));
      }
      
      // Log detailed error for debugging
      if (process.env.GRAPHYN_VERBOSE === 'true') {
        console.error('Debug info:', {
          code: error.code,
          statusCode: error.statusCode,
          stack: error.stack
        });
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error(colors.error('✗ Cannot connect to authentication server'));
      console.error(colors.info('Please check your network connection and try again'));
    } else if (error.code === 'ETIMEDOUT') {
      console.error(colors.error('✗ Connection timed out'));
      console.error(colors.info('Please check your network connection and try again'));
    } else {
      // Unknown error
      console.error(colors.error('✗ Unexpected error during authentication'));
      if (process.env.GRAPHYN_VERBOSE === 'true') {
        console.error(error);
      } else {
        console.error(colors.info('Run with --verbose for more details'));
      }
    }
    
    process.exit(1);
  }
}