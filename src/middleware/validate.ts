import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from './errorHandler.js';

type ValidationTarget = 'body' | 'query' | 'params';

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export const validate = (schemas: ValidateOptions) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const targets: ValidationTarget[] = ['body', 'query', 'params'];

      for (const target of targets) {
        const schema = schemas[target];
        if (schema) {
          const result = await schema.safeParseAsync(req[target]);
          if (!result.success) {
            throw new ValidationError(
              `Validation failed for ${target}`,
              result.error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              }))
            );
          }
          
          req[target] = result.data;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateBody = (schema: ZodSchema) => validate({ body: schema });
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });
export const validateParams = (schema: ZodSchema) => validate({ params: schema });
