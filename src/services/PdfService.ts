import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { DocumentModel, IDocumentDocument } from '../models/Document';
import { S3StorageAdapter } from '../adapters/storage/S3StorageAdapter';
import { pdfWorkerPool } from '../workers/PdfWorkerPool';
import { userService } from './UserService';
import { logger } from '../config/logger';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import {
    SplitPdfDTO,
    SplitPdfResponse,
    SplitResultItem,
    PdfInfo,
} from '../types/pdf';

const PDF_MIME_TYPE = 'application/pdf';

export class PdfService {
    private readonly storage: S3StorageAdapter;
    private initialized = false;

    constructor(storage?: S3StorageAdapter) {
        this.storage = storage || new S3StorageAdapter();
    }

    /**
     * Initialize the worker pool (call on app startup)
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        await pdfWorkerPool.initialize();
        this.initialized = true;
        logger.info('PdfService initialized with worker pool');
    }

    /**
     * Shutdown the worker pool (call on app shutdown)
     */
    async shutdown(): Promise<void> {
        await pdfWorkerPool.shutdown();
        this.initialized = false;
    }

    /**
     * Generate a unique storage key for a split PDF
     */
    private generateStorageKey(ownerId: string, baseName: string): string {
        const uuid = uuidv4();
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
        return `documents/${ownerId}/${date}/${uuid}-${baseName}.pdf`;
    }

    /**
     * Get PDF info/metadata using worker thread
     */
    async getInfo(documentId: string, ownerId: string): Promise<PdfInfo> {
        const doc = await this.getDocument(documentId, ownerId);
        
        // Verify it's a PDF
        if (doc.mimeType !== PDF_MIME_TYPE && doc.extension !== 'pdf') {
            throw new ValidationError('Document is not a PDF');
        }

        const buffer = await this.storage.download(doc.storageKey);
        
        try {
            const result = await pdfWorkerPool.getInfo(buffer, documentId, ownerId);
            
            return {
                pageCount: result.pageCount,
                title: result.title,
                author: result.author,
                subject: result.subject,
                creator: result.creator,
                producer: result.producer,
                creationDate: result.creationDate,
                modificationDate: result.modificationDate,
                isEncrypted: false,
            };
        } catch (error) {
            if (error instanceof Error && error.message.includes('encrypted')) {
                throw new ValidationError('Cannot process encrypted PDF');
            }
            throw error;
        }
    }

    /**
     * Split a PDF document using worker thread
     */
    async split(documentId: string, ownerId: string, dto: SplitPdfDTO): Promise<SplitPdfResponse> {
        const doc = await this.getDocument(documentId, ownerId);
        
        // Verify it's a PDF
        if (doc.mimeType !== PDF_MIME_TYPE && doc.extension !== 'pdf') {
            throw new ValidationError('Document is not a PDF');
        }

        // Download the PDF
        const buffer = await this.storage.download(doc.storageKey);

        logger.info(`Splitting PDF ${documentId} using worker thread, mode: ${dto.mode}`);

        // Process PDF in worker thread
        const { jobId, pageCount, splits } = await pdfWorkerPool.split(
            buffer, 
            {
                mode: dto.mode,
                ranges: dto.ranges,
                chunkSize: dto.chunkSize,
                pages: dto.pages,
            },
            documentId,
            ownerId
        );

        logger.info(`Worker completed job ${jobId}: ${splits.length} splits from ${pageCount} pages`);

        // Validate total storage needed
        const totalSize = splits.reduce((sum, s) => sum + s.pdfBytes.length, 0);
        const hasStorage = await userService.hasStorageAvailable(ownerId, totalSize);
        if (!hasStorage) {
            throw new ValidationError('Insufficient storage space for split operation');
        }

        // Upload splits to storage and create document records
        const outputDocuments: SplitResultItem[] = [];
        let totalOutputSize = 0;
        const baseName = this.getBaseName(doc.name);

        for (let i = 0; i < splits.length; i++) {
            const split = splits[i];
            const pdfBytes = Buffer.from(split.pdfBytes);
            
            // Generate name
            const outputName = this.generateOutputName(
                baseName, 
                dto.namePrefix, 
                i + 1, 
                splits.length, 
                split.pages
            );
            const key = this.generateStorageKey(ownerId, outputName);

            // Upload to storage
            await this.storage.upload(key, pdfBytes, {
                contentType: PDF_MIME_TYPE,
                metadata: {
                    ownerId,
                    sourceDocumentId: documentId,
                    originalName: doc.originalName,
                    pages: split.pages.join(','),
                },
            });

            // Create document record
            const newDoc = await DocumentModel.create({
                name: `${outputName}.pdf`,
                originalName: `${outputName}.pdf`,
                mimeType: PDF_MIME_TYPE,
                size: pdfBytes.length,
                extension: 'pdf',
                storageKey: key,
                folderId: dto.folderId ? new mongoose.Types.ObjectId(dto.folderId) : doc.folderId,
                ownerId,
                tags: dto.tags || doc.tags,
                metadata: {
                    ...doc.metadata,
                    sourceDocumentId: documentId,
                    sourcePages: split.pages,
                    splitMode: dto.mode,
                },
            });

            outputDocuments.push({
                documentId: newDoc._id.toString(),
                name: newDoc.name,
                pageCount: split.pages.length,
                size: pdfBytes.length,
                pages: split.pages,
            });

            totalOutputSize += pdfBytes.length;
        }

        // Update user storage
        await userService.updateStorageUsed(ownerId, totalOutputSize);

        logger.info(`PDF split complete: ${documentId} -> ${outputDocuments.length} documents, ${totalOutputSize} bytes`);

        return {
            originalDocumentId: documentId,
            originalPageCount: pageCount,
            outputDocuments,
            totalOutputSize,
        };
    }

    /**
     * Get worker pool statistics
     */
    getWorkerStats(): { total: number; busy: number; queued: number } {
        return pdfWorkerPool.getStats();
    }

    /**
     * Get all jobs for a user
     */
    getJobs(ownerId: string) {
        return pdfWorkerPool.getJobsByOwner(ownerId);
    }

    /**
     * Get a specific job
     */
    getJob(jobId: string, ownerId: string) {
        const job = pdfWorkerPool.getJob(jobId);
        if (!job || job.ownerId !== ownerId) {
            throw new NotFoundError('Job');
        }
        return job;
    }

    /**
     * Get queued jobs for a user
     */
    getQueuedJobs(ownerId: string) {
        return pdfWorkerPool.getQueuedJobs()
            .filter(job => job.ownerId === ownerId);
    }

    /**
     * Cancel a job (remove from queue or stop processing)
     */
    async cancelJob(jobId: string, ownerId: string): Promise<{ success: boolean; wasProcessing: boolean }> {
        const job = pdfWorkerPool.getJob(jobId);
        if (!job || job.ownerId !== ownerId) {
            throw new NotFoundError('Job');
        }
        
        return pdfWorkerPool.cancelJob(jobId);
    }

    /**
     * Clear old completed jobs
     */
    clearOldJobs(maxAgeMs?: number): number {
        return pdfWorkerPool.clearOldJobs(maxAgeMs);
    }

    /**
     * Generate output file name
     */
    private generateOutputName(
        baseName: string,
        prefix: string | undefined,
        index: number,
        total: number,
        pages: number[]
    ): string {
        const effectivePrefix = prefix || baseName;
        
        if (total === 1) {
            // Single output (extract mode)
            if (pages.length === 1) {
                return `${effectivePrefix}_page_${pages[0]}`;
            }
            return `${effectivePrefix}_pages_${pages[0]}-${pages[pages.length - 1]}`;
        }

        // Multiple outputs
        const padLength = String(total).length;
        const paddedIndex = String(index).padStart(padLength, '0');
        
        if (pages.length === 1) {
            return `${effectivePrefix}_${paddedIndex}_page_${pages[0]}`;
        }
        
        return `${effectivePrefix}_${paddedIndex}_pages_${pages[0]}-${pages[pages.length - 1]}`;
    }

    /**
     * Get base name without extension
     */
    private getBaseName(fileName: string): string {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    }

    /**
     * Get and validate document
     */
    private async getDocument(documentId: string, ownerId: string): Promise<IDocumentDocument> {
        const doc = await DocumentModel.findOne({
            _id: documentId,
            ownerId,
            isDeleted: false,
        });

        if (!doc) {
            throw new NotFoundError('Document');
        }

        return doc;
    }
}

// Export singleton instance
export const pdfService = new PdfService();
