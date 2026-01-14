import { z } from 'zod';
import { config } from '../config/index.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ID format');

export const createDocumentBodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    folderId: z.string().regex(objectIdRegex, 'Invalid folder ID').nullable().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    metadata: z.record(z.unknown()).optional(),
});

export const updateDocumentBodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    folderId: z.string().regex(objectIdRegex, 'Invalid folder ID').nullable().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    metadata: z.record(z.unknown()).optional(),
});

export const idParamsSchema = z.object({
    id: objectIdSchema,
});

export const deleteDocumentQuerySchema = z.object({
    permanent: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
});

export const listDocumentsQuerySchema = z.object({
    folderId: z
        .string()
        .regex(objectIdRegex, 'Invalid folder ID')
        .or(z.literal('null'))
        .optional()
        .transform((val) => (val === 'null' ? null : val)),
    tags: z.union([z.string(), z.array(z.string())]).optional().transform(val =>
        val ? (Array.isArray(val) ? val : val.split(',')) : undefined
    ),
    search: z.string().max(100).optional(),
    includeDeleted: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20),
    sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'size']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const presignedUploadBodySchema = z.object({
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    size: z.number().min(1).max(config.upload.maxFileSizeMB * 1024 * 1024),
    folderId: z.string().regex(objectIdRegex, 'Invalid folder ID').nullable().optional(),
});

export const confirmUploadBodySchema = z.object({
    key: z.string().min(1),
    name: z.string().min(1).max(255).optional(),
    folderId: z.string().regex(objectIdRegex, 'Invalid folder ID').nullable().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    metadata: z.record(z.unknown()).optional(),
});

export const moveDocumentBodySchema = z.object({
    folderId: z.string().regex(objectIdRegex, 'Invalid folder ID').nullable(),
});

export const copyDocumentBodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    folderId: z.string().regex(objectIdRegex, 'Invalid folder ID').nullable().optional(),
});

export const searchDocumentsQuerySchema = z.object({
    query: z.string().max(200).optional(),
    name: z.string().max(100).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional().transform(val =>
        val ? (Array.isArray(val) ? val : val.split(',')) : undefined
    ),
    extension: z.string().max(10).optional(),
    mimeType: z.string().max(100).optional(),
    minSize: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
    maxSize: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    folderId: z.string().regex(objectIdRegex, 'Invalid folder ID').nullable().optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 20),
    sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'size', 'relevance']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Type exports
export type CreateDocumentBody = z.infer<typeof createDocumentBodySchema>;
export type UpdateDocumentBody = z.infer<typeof updateDocumentBodySchema>;
export type IdParams = z.infer<typeof idParamsSchema>;
export type DeleteDocumentQuery = z.infer<typeof deleteDocumentQuerySchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type PresignedUploadBody = z.infer<typeof presignedUploadBodySchema>;
export type ConfirmUploadBody = z.infer<typeof confirmUploadBodySchema>;
export type MoveDocumentBody = z.infer<typeof moveDocumentBodySchema>;
export type CopyDocumentBody = z.infer<typeof copyDocumentBodySchema>;
export type SearchDocumentsQuery = z.infer<typeof searchDocumentsQuerySchema>;
