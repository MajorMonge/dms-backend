import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Page range schema
 */
const pageRangeSchema = z.object({
    start: z.number().int().positive().optional(),
    end: z.number().int().positive().optional(),
    pages: z.array(z.number().int().positive()).optional(),
}).refine(
    (data) => data.start !== undefined || data.end !== undefined || data.pages !== undefined,
    { message: 'Page range must specify start, end, or pages' }
);

/**
 * Schema for splitting a PDF
 */
export const splitPdfBodySchema = z.object({
    mode: z.enum(['all', 'ranges', 'chunks', 'extract'], {
        errorMap: () => ({ message: 'Mode must be one of: all, ranges, chunks, extract' }),
    }),
    ranges: z.array(pageRangeSchema).optional(),
    chunkSize: z.number().int().min(1).max(100).optional(),
    pages: z.array(z.number().int().positive()).min(1).optional(),
    folderId: z
        .string()
        .regex(objectIdRegex, 'Invalid folder ID format')
        .nullable()
        .optional(),
    namePrefix: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
}).refine(
    (data) => {
        // Validate required fields based on mode
        if (data.mode === 'ranges' && (!data.ranges || data.ranges.length === 0)) {
            return false;
        }
        if (data.mode === 'chunks' && !data.chunkSize) {
            return false;
        }
        if (data.mode === 'extract' && (!data.pages || data.pages.length === 0)) {
            return false;
        }
        return true;
    },
    {
        message: 'Missing required field for the selected mode: ranges for "ranges", chunkSize for "chunks", pages for "extract"',
    }
);

/**
 * Schema for document ID in params
 */
export const pdfIdParamsSchema = z.object({
    id: z.string().regex(objectIdRegex, 'Invalid document ID format'),
});

export type SplitPdfBody = z.infer<typeof splitPdfBodySchema>;
