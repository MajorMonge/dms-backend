import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import mongoose from 'mongoose';
import { DocumentModel, IDocumentDocument } from '../models/Document';
import { S3StorageAdapter } from '../adapters/storage/S3StorageAdapter';
import { config } from '../config/index';
import { logger } from '../config/logger';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import {
    CreateDocumentDTO,
    UpdateDocumentDTO,
    DocumentResponse,
    DocumentListQuery,
    DocumentListResponse,
    PresignedUploadResponse,
    PresignedDownloadResponse,
} from '../types/document';

const MAX_EXPIRE_TIME = 3600; // 1 hour

export class DocumentService {
    private readonly storage: S3StorageAdapter;

    constructor(storage?: S3StorageAdapter) {
        this.storage = storage || new S3StorageAdapter();
    }

    /**
     * Generate a unique storage key for a file
     */
    private generateStorageKey(ownerId: string, fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const uuid = uuidv4();
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
        return `documents/${ownerId}/${date}/${uuid}${ext}`;
    }

    /**
     * Extract file extension from filename
     */
    private getExtension(fileName: string): string {
        return path.extname(fileName).toLowerCase().replace('.', '');
    }

    /**
     * Validate file type against allowed types
     */
    private validateFileType(fileName: string, mimeType: string): void {
        const ext = this.getExtension(fileName);
        if (!config.upload.allowedFileTypes.includes(ext)) {
            throw new ValidationError(
                `File type '.${ext}' is not allowed. Allowed types: ${config.upload.allowedFileTypes.join(', ')}`
            );
        }
    }

    /**
     * Validate file size
     */
    private validateFileSize(size: number): void {
        const maxSize = config.upload.maxFileSizeMB * 1024 * 1024;
        if (size > maxSize) {
            throw new ValidationError(
                `File size exceeds maximum allowed size of ${config.upload.maxFileSizeMB}MB`
            );
        }
    }

    /**
     * Transform document to response format
     */
    private toResponse(doc: IDocumentDocument, downloadUrl?: string): DocumentResponse {
        return {
            id: doc._id.toString(),
            name: doc.name,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            size: doc.size,
            extension: doc.extension,
            storageKey: doc.storageKey,
            folderId: doc.folderId?.toString() || null,
            ownerId: doc.ownerId,
            tags: doc.tags,
            metadata: doc.metadata,
            version: doc.version,
            isDeleted: doc.isDeleted,
            deletedAt: doc.deletedAt,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            downloadUrl,
        };
    }

    /**
     * Get presigned URL for direct upload to S3
     */
    async getPresignedUploadUrl(
        ownerId: string,
        fileName: string,
        mimeType: string,
        size: number
    ): Promise<PresignedUploadResponse> {
        this.validateFileType(fileName, mimeType);
        this.validateFileSize(size);

        const key = this.generateStorageKey(ownerId, fileName);
        const uploadUrl = await this.storage.getPresignedUploadUrl(key, {
            contentType: mimeType,
            expiresIn: MAX_EXPIRE_TIME,
        });

        logger.debug(`Generated presigned upload URL for key: ${key}`);

        return {
            uploadUrl,
            key,
            expiresIn: MAX_EXPIRE_TIME,
        };
    }

    /**
     * Confirm upload and create document record
     */
    async confirmUpload(
        ownerId: string,
        key: string,
        options: {
            name?: string;
            folderId?: string | null;
            tags?: string[];
            metadata?: Record<string, unknown>;
        }
    ): Promise<DocumentResponse> {
        // Verify file exists in S3
        const exists = await this.storage.exists(key);
        if (!exists) {
            throw new ValidationError('File not found in storage. Upload may have failed.');
        }

        // Get file metadata from S3
        const s3Metadata = await this.storage.getMetadata(key);
        const fileName = path.basename(key);
        const extension = this.getExtension(fileName);

        const doc = await DocumentModel.create({
            name: options.name || fileName,
            originalName: fileName,
            mimeType: s3Metadata?.contentType || 'application/octet-stream',
            size: s3Metadata?.size || 0,
            extension,
            storageKey: key,
            folderId: options.folderId ? new mongoose.Types.ObjectId(options.folderId) : null,
            ownerId,
            tags: options.tags || [],
            metadata: options.metadata || {},
        });

        logger.info(`Document created: ${doc._id} by user ${ownerId}`);

        return this.toResponse(doc);
    }

    /**
     * Upload file directly (for server-side uploads)
     */
    async uploadDirect(
        ownerId: string,
        file: Buffer,
        fileName: string,
        mimeType: string,
        options?: {
            name?: string;
            folderId?: string | null;
            tags?: string[];
            metadata?: Record<string, unknown>;
        }
    ): Promise<DocumentResponse> {
        this.validateFileType(fileName, mimeType);
        this.validateFileSize(file.length);

        const key = this.generateStorageKey(ownerId, fileName);
        const extension = this.getExtension(fileName);

        // Upload to S3
        await this.storage.upload(key, file, {
            contentType: mimeType,
            metadata: {
                ownerId,
                originalName: fileName,
            },
        });

        // Create document record
        const doc = await DocumentModel.create({
            name: options?.name || fileName,
            originalName: fileName,
            mimeType,
            size: file.length,
            extension,
            storageKey: key,
            folderId: options?.folderId ? new mongoose.Types.ObjectId(options.folderId) : null,
            ownerId,
            tags: options?.tags || [],
            metadata: options?.metadata || {},
        });

        logger.info(`Document uploaded directly: ${doc._id} by user ${ownerId}`);

        return this.toResponse(doc);
    }

    /**
     * Get document by ID
     */
    async getById(id: string, ownerId: string): Promise<DocumentResponse> {
        const doc = await DocumentModel.findOne({
            _id: id,
            ownerId,
            isDeleted: false,
        });

        if (!doc) {
            throw new NotFoundError('Document');
        }

        // Generate download URL
        const downloadUrl = await this.storage.getPresignedDownloadUrl(doc.storageKey, {
            expiresIn: MAX_EXPIRE_TIME,
        });

        return this.toResponse(doc, downloadUrl);
    }

    /**
     * Get presigned download URL
     */
    async getDownloadUrl(id: string, ownerId: string): Promise<PresignedDownloadResponse> {
        const doc = await DocumentModel.findOne({
            _id: id,
            ownerId,
            isDeleted: false,
        });

        if (!doc) {
            throw new NotFoundError('Document');
        }

        const downloadUrl = await this.storage.getPresignedDownloadUrl(doc.storageKey, {
            expiresIn: MAX_EXPIRE_TIME,
        });

        return {
            downloadUrl,
            expiresIn: MAX_EXPIRE_TIME,
        };
    }

    /**
     * Download file content
     */
    async download(id: string, ownerId: string): Promise<{ buffer: Buffer; document: DocumentResponse }> {
        const doc = await DocumentModel.findOne({
            _id: id,
            ownerId,
            isDeleted: false,
        });

        if (!doc) {
            throw new NotFoundError('Document');
        }

        const buffer = await this.storage.download(doc.storageKey);

        return {
            buffer,
            document: this.toResponse(doc),
        };
    }

    /**
     * List documents with filtering and pagination
     */
    async list(ownerId: string, query: DocumentListQuery): Promise<DocumentListResponse> {
        const {
            folderId,
            tags,
            search,
            includeDeleted = false,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = query;

        // Build filter
        const filter: Record<string, unknown> = {
            ownerId,
        };

        if (!includeDeleted) {
            filter.isDeleted = false;
        }

        if (folderId !== undefined) {
            filter.folderId = folderId ? new mongoose.Types.ObjectId(folderId) : null;
        }

        if (tags && tags.length > 0) {
            filter.tags = { $all: tags };
        }

        if (search) {
            filter.$text = { $search: search };
        }

        // Count total
        const total = await DocumentModel.countDocuments(filter);

        // Get documents
        const docs = await DocumentModel.find(filter)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const documents = docs.map(doc => this.toResponse(doc));

        return {
            documents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Update document metadata
     */
    async update(id: string, ownerId: string, data: UpdateDocumentDTO): Promise<DocumentResponse> {
        const updateData: Record<string, unknown> = {};

        if (data.name !== undefined) {
            updateData.name = data.name;
        }

        if (data.folderId !== undefined) {
            updateData.folderId = data.folderId ? new mongoose.Types.ObjectId(data.folderId) : null;
        }

        if (data.tags !== undefined) {
            updateData.tags = data.tags;
        }

        if (data.metadata !== undefined) {
            updateData.metadata = data.metadata;
        }

        const doc = await DocumentModel.findOneAndUpdate(
            { _id: id, ownerId, isDeleted: false },
            { $set: updateData },
            { new: true }
        );

        if (!doc) {
            throw new NotFoundError('Document');
        }

        logger.info(`Document updated: ${id} by user ${ownerId}`);

        return this.toResponse(doc);
    }

    /**
     * Move document to a different folder
     */
    async move(id: string, ownerId: string, folderId: string | null): Promise<DocumentResponse> {
        return this.update(id, ownerId, { folderId });
    }

    /**
     * Copy document
     */
    async copy(
        id: string,
        ownerId: string,
        options?: { name?: string; folderId?: string | null }
    ): Promise<DocumentResponse> {
        const source = await DocumentModel.findOne({
            _id: id,
            ownerId,
            isDeleted: false,
        });

        if (!source) {
            throw new NotFoundError('Document');
        }

        // Generate new storage key
        const newKey = this.generateStorageKey(ownerId, source.originalName);

        // Copy file in S3
        await this.storage.copy(source.storageKey, newKey);

        // Create new document record
        const doc = await DocumentModel.create({
            name: options?.name || `Copy of ${source.name}`,
            originalName: source.originalName,
            mimeType: source.mimeType,
            size: source.size,
            extension: source.extension,
            storageKey: newKey,
            folderId: options?.folderId !== undefined
                ? (options.folderId ? new mongoose.Types.ObjectId(options.folderId) : null)
                : source.folderId,
            ownerId,
            tags: [...source.tags],
            metadata: { ...source.metadata },
        });

        logger.info(`Document copied: ${source._id} -> ${doc._id} by user ${ownerId}`);

        return this.toResponse(doc);
    }

    /**
     * Soft delete document
     */
    async softDelete(id: string, ownerId: string): Promise<void> {
        const doc = await DocumentModel.findOneAndUpdate(
            { _id: id, ownerId, isDeleted: false },
            { $set: { isDeleted: true, deletedAt: new Date() } }
        );

        if (!doc) {
            throw new NotFoundError('Document');
        }

        logger.info(`Document soft deleted: ${id} by user ${ownerId}`);
    }

    /**
     * Permanently delete document
     */
    async permanentDelete(id: string, ownerId: string): Promise<void> {
        const doc = await DocumentModel.findOne({ _id: id, ownerId });

        if (!doc) {
            throw new NotFoundError('Document');
        }

        // Delete from S3
        await this.storage.delete(doc.storageKey);

        // Delete from database
        await DocumentModel.deleteOne({ _id: id });

        logger.info(`Document permanently deleted: ${id} by user ${ownerId}`);
    }

    /**
     * Restore soft-deleted document
     */
    async restore(id: string, ownerId: string): Promise<DocumentResponse> {
        const doc = await DocumentModel.findOneAndUpdate(
            { _id: id, ownerId, isDeleted: true },
            { $set: { isDeleted: false, deletedAt: null } },
            { new: true }
        );

        if (!doc) {
            throw new NotFoundError('Document');
        }

        logger.info(`Document restored: ${id} by user ${ownerId}`);

        return this.toResponse(doc);
    }

    /**
     * Get documents in trash (soft-deleted)
     */
    async getTrash(ownerId: string, page = 1, limit = 20): Promise<DocumentListResponse> {
        const filter = { ownerId, isDeleted: true };

        const total = await DocumentModel.countDocuments(filter);

        const docs = await DocumentModel.find(filter)
            .sort({ deletedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return {
            documents: docs.map(doc => this.toResponse(doc)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Empty trash (permanently delete all soft-deleted documents)
     */
    async emptyTrash(ownerId: string): Promise<number> {
        const docs = await DocumentModel.find({ ownerId, isDeleted: true });

        // Delete all files from S3
        if (docs.length > 0) {
            const keys = docs.map(doc => doc.storageKey);
            await this.storage.deleteMany(keys);
        }

        // Delete from database
        const result = await DocumentModel.deleteMany({ ownerId, isDeleted: true });

        logger.info(`Trash emptied: ${result.deletedCount} documents deleted by user ${ownerId}`);

        return result.deletedCount;
    }
}

// Export singleton instance
export const documentService = new DocumentService();
