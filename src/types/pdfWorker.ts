/**
 * Worker thread types for PDF processing
 */

import { SplitMode, PageRange } from './pdf.js';

/**
 * Job status for tracking
 */
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Job info for tracking
 */
export interface JobInfo {
    jobId: string;
    taskId: string;
    type: 'split' | 'getInfo';
    status: JobStatus;
    documentId: string;
    ownerId: string;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    progress?: number;
}

/**
 * Message sent to the PDF worker
 */
export interface PdfWorkerMessage {
    type: 'split' | 'getInfo';
    taskId: string;
    pdfBuffer: ArrayBuffer;
    options?: PdfSplitWorkerOptions;
}

/**
 * Options for split operation in worker
 */
export interface PdfSplitWorkerOptions {
    mode: SplitMode;
    ranges?: PageRange[];
    chunkSize?: number;
    pages?: number[];
}

/**
 * Result of a single split from worker
 */
export interface PdfSplitWorkerResult {
    pages: number[];
    pdfBytes: Uint8Array;
}

/**
 * Success response from worker
 */
export interface PdfWorkerSuccessResponse {
    type: 'success';
    taskId: string;
    result: {
        pageCount: number;
        splits?: PdfSplitWorkerResult[];
        info?: {
            title?: string;
            author?: string;
            subject?: string;
            creator?: string;
            producer?: string;
            creationDate?: string;
            modificationDate?: string;
        };
    };
}

/**
 * Error response from worker
 */
export interface PdfWorkerErrorResponse {
    type: 'error';
    taskId: string;
    error: string;
}

export type PdfWorkerResponse = PdfWorkerSuccessResponse | PdfWorkerErrorResponse;
