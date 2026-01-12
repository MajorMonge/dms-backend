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
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error caught by global handler:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

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
