import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import { ZodError } from 'zod';

// Custom error class
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error types
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, StatusCodes.NOT_FOUND, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, codeOrDetails?: string | unknown, details?: unknown) {
    const code = typeof codeOrDetails === 'string' ? codeOrDetails : 'VALIDATION_ERROR';
    const errorDetails = typeof codeOrDetails === 'string' ? details : codeOrDetails;
    super(message, StatusCodes.BAD_REQUEST, code, true, errorDetails);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED') {
    super(message, StatusCodes.UNAUTHORIZED, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, StatusCodes.FORBIDDEN, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(message, StatusCodes.CONFLICT, code);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

// Global error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Enhanced error logging with request context
  const errorContext = {
    error: {
      name: err.name,
      message: err.message,
      code: (err as any).code,
      statusCode: (err as AppError).statusCode,
      isOperational: (err as AppError).isOperational,
      details: (err as AppError).details,
      stack: err.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
      headers: {
        'content-type': req.get('content-type'),
        'user-agent': req.get('user-agent'),
        'x-forwarded-for': req.get('x-forwarded-for'),
      },
      user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
      ip: req.ip,
    },
    timestamp: new Date().toISOString(),
  };

  // Create a descriptive error summary for quick identification
  const errorSummary = `${err.name || 'Error'} on ${req.method} ${req.path}: ${err.message}`;
  
  logger.error(errorSummary, errorContext);

  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    };
    res.status(StatusCodes.BAD_REQUEST).json(response);
    return;
  }

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        ...(config.isDevelopment && { stack: err.stack }),
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DUPLICATE_ERROR',
        message: 'A resource with this identifier already exists',
      },
    };
    res.status(StatusCodes.CONFLICT).json(response);
    return;
  }

  if (err.name === 'ValidationError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    };
    res.status(StatusCodes.BAD_REQUEST).json(response);
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      },
    };
    res.status(StatusCodes.UNAUTHORIZED).json(response);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
      },
    };
    res.status(StatusCodes.UNAUTHORIZED).json(response);
    return;
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isProduction
        ? 'An unexpected error occurred'
        : err.message,
      ...(config.isDevelopment && { stack: err.stack }),
    },
  };
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
};
