import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const folderIdSchema = z.string().regex(objectIdRegex, 'Invalid folder ID format');

/**
 * Schema for creating a folder
 */
export const createFolderBodySchema = z.object({
    name: z
        .string()
        .min(1, 'Folder name is required')
        .max(255, 'Folder name must be at most 255 characters')
        .trim()
        .refine((name) => !name.includes('/'), 'Folder name cannot contain forward slashes'),
    parentId: z
        .string()
        .regex(objectIdRegex, 'Invalid parent folder ID')
        .nullable()
        .optional(),
    metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for updating a folder
 */
export const updateFolderBodySchema = z.object({
    name: z
        .string()
        .min(1, 'Folder name is required')
        .max(255, 'Folder name must be at most 255 characters')
        .trim()
        .refine((name) => !name.includes('/'), 'Folder name cannot contain forward slashes')
        .optional(),
    metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for moving a folder
 */
export const moveFolderBodySchema = z.object({
    parentId: z
        .string()
        .regex(objectIdRegex, 'Invalid parent folder ID')
        .nullable(),
});

/**
 * Schema for folder ID in params
 */
export const folderIdParamsSchema = z.object({
    id: folderIdSchema,
});

/**
 * Schema for listing folders query params
 */
export const listFoldersQuerySchema = z.object({
    parentId: z
        .string()
        .regex(objectIdRegex, 'Invalid parent folder ID')
        .or(z.literal('null'))
        .optional()
        .transform((val) => (val === 'null' ? null : val)),
    search: z.string().max(100).optional(),
    includeDeleted: z
        .string()
        .optional()
        .transform((val) => val === 'true'),
    page: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
        .string()
        .optional()
        .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 50)),
    sortBy: z
        .enum(['name', 'createdAt', 'updatedAt'])
        .optional()
        .default('name'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Exported types
export type CreateFolderBody = z.infer<typeof createFolderBodySchema>;
export type UpdateFolderBody = z.infer<typeof updateFolderBodySchema>;
export type MoveFolderBody = z.infer<typeof moveFolderBodySchema>;
export type FolderIdParams = z.infer<typeof folderIdParamsSchema>;
export type ListFoldersQuery = z.infer<typeof listFoldersQuerySchema>;
