import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import mongoose from 'mongoose';
import { DocumentModel, IDocumentDocument, IDeletedFolderInfo } from '../models/Document.js';
import { FolderModel } from '../models/Folder.js';
import { S3StorageAdapter } from '../adapters/storage/S3StorageAdapter.js';
import { userService } from './UserService.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import {
    CreateDocumentDTO,
    UpdateDocumentDTO,
    DocumentResponse,
    DocumentListQuery,
    DocumentListResponse,
    PresignedUploadResponse,
    PresignedDownloadResponse,
} from '../types/document.js';

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
                `File type '.${ext}' is not allowed. Allowed types: ${config.upload.allowedFileTypes.join(', ')}`,
                'DOC_INVALID_FILE_TYPE'
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
                `File size exceeds maximum allowed size of ${config.upload.maxFileSizeMB}MB`,
                'DOC_FILE_TOO_LARGE'
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

        const hasStorage = await userService.hasStorageAvailable(ownerId, size);
        if (!hasStorage) {
            throw new ValidationError('Insufficient storage space', 'DOC_STORAGE_FULL');
        }

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
        const exists = await this.storage.exists(key);
        if (!exists) {
            throw new ValidationError('File not found in storage. Upload may have failed.', 'DOC_UPLOAD_FAILED');
        }

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

        if (doc.size > 0) {
            await userService.updateStorageUsed(ownerId, doc.size);
        }

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

        const hasStorage = await userService.hasStorageAvailable(ownerId, file.length);
        if (!hasStorage) {
            throw new ValidationError('Insufficient storage space', 'DOC_STORAGE_FULL');
        }

        const key = this.generateStorageKey(ownerId, fileName);
        const extension = this.getExtension(fileName);

        await this.storage.upload(key, file, {
            contentType: mimeType,
            metadata: {
                ownerId,
                originalName: encodeURIComponent(fileName),
            },
        });

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

        await userService.updateStorageUsed(ownerId, file.length);

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
            // Use regex for flexible searching across name, originalName, tags, and extension
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { originalName: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } },
                { extension: { $regex: search, $options: 'i' } },
            ];
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
     * Search documents with advanced filters
     */
    async search(
        ownerId: string,
        searchQuery: {
            query?: string;
            name?: string;
            tags?: string[];
            extension?: string;
            mimeType?: string;
            minSize?: number;
            maxSize?: number;
            dateFrom?: string;
            dateTo?: string;
            folderId?: string | null;
            page?: number;
            limit?: number;
            sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'size' | 'relevance';
            sortOrder?: 'asc' | 'desc';
        }
    ): Promise<{
        documents: DocumentResponse[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        searchMeta?: {
            query: string;
            resultsFound: number;
            searchTime: number;
        };
    }> {
        const startTime = Date.now();
        const {
            query,
            name,
            tags,
            extension,
            mimeType,
            minSize,
            maxSize,
            dateFrom,
            dateTo,
            folderId,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = searchQuery;

        // Build filter
        const filter: Record<string, unknown> = {
            ownerId,
            isDeleted: false,
        };

        // General query search across multiple fields
        if (query) {
            const searchRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { name: searchRegex },
                { originalName: searchRegex },
                { tags: searchRegex },
                { extension: searchRegex },
            ];
        }

        // Specific field searches
        if (name) {
            filter.name = { $regex: name, $options: 'i' };
        }

        if (tags && tags.length > 0) {
            filter.tags = { $in: tags }; // At least one tag matches
        }

        if (extension) {
            filter.extension = extension.toLowerCase();
        }

        if (mimeType) {
            filter.mimeType = { $regex: mimeType, $options: 'i' };
        }

        // Size range filter
        if (minSize !== undefined || maxSize !== undefined) {
            filter.size = {};
            if (minSize !== undefined) {
                (filter.size as Record<string, unknown>).$gte = minSize;
            }
            if (maxSize !== undefined) {
                (filter.size as Record<string, unknown>).$lte = maxSize;
            }
        }

        // Date range filter
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom) {
                (filter.createdAt as Record<string, unknown>).$gte = new Date(dateFrom);
            }
            if (dateTo) {
                (filter.createdAt as Record<string, unknown>).$lte = new Date(dateTo);
            }
        }

        // Folder filter
        if (folderId !== undefined) {
            filter.folderId = folderId ? new mongoose.Types.ObjectId(folderId) : null;
        }

        // Count total
        const total = await DocumentModel.countDocuments(filter);

        // Build sort
        const sort: Record<string, 1 | -1> = {};
        if (sortBy === 'relevance' && query) {
            // For relevance, prioritize name matches over originalName
            // This is a simple approximation; for true relevance, use text indexes
            sort.name = sortOrder === 'asc' ? 1 : -1;
        } else {
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }

        // Get documents
        const docs = await DocumentModel.find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit);

        const documents = docs.map(doc => this.toResponse(doc));
        const searchTime = Date.now() - startTime;

        return {
            documents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            searchMeta: query ? {
                query,
                resultsFound: total,
                searchTime,
            } : undefined,
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

        const hasStorage = await userService.hasStorageAvailable(ownerId, source.size);
        if (!hasStorage) {
            throw new ValidationError('Insufficient storage space to copy this document.', 'DOC_STORAGE_FULL');
        }

        const newKey = this.generateStorageKey(ownerId, source.originalName);

        await this.storage.copy(source.storageKey, newKey);

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

        await userService.updateStorageUsed(ownerId, source.size);

        logger.info(`Document copied: ${source._id} -> ${doc._id} by user ${ownerId}`);

        return this.toResponse(doc);
    }

    /**
     * Soft delete document, saving folder info for potential restoration
     */
    async softDelete(id: string, ownerId: string): Promise<void> {
        const doc = await DocumentModel.findOne({ _id: id, ownerId, isDeleted: false });

        if (!doc) {
            throw new NotFoundError('Document');
        }

        let deletedFolderInfo: IDeletedFolderInfo | null = null;

        // Save folder info if document is in a folder
        if (doc.folderId) {
            const folder = await FolderModel.findById(doc.folderId);
            if (folder) {
                deletedFolderInfo = {
                    folderId: folder._id.toString(),
                    name: folder.name,
                    path: folder.path,
                    parentId: folder.parentId?.toString() || null,
                };
            }
        }

        await DocumentModel.updateOne(
            { _id: id },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date(),
                    deletedFolderInfo,
                },
            }
        );

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

        const docSize = doc.size;

        await this.storage.delete(doc.storageKey);

        await DocumentModel.deleteOne({ _id: id });

        await userService.updateStorageUsed(ownerId, -docSize);

        logger.info(`Document permanently deleted: ${id} by user ${ownerId}`);
    }

    /**
     * Restore soft-deleted document
     * If the document had a folder that was deleted, recreates the folder structure
     */
    async restore(id: string, ownerId: string, options?: { recreateFolder?: boolean }): Promise<DocumentResponse & { folderRecreated?: boolean }> {
        const doc = await DocumentModel.findOne({ _id: id, ownerId, isDeleted: true });

        if (!doc) {
            throw new NotFoundError('Document');
        }

        let folderId: mongoose.Types.ObjectId | null = null;
        let folderRecreated = false;

        // Check if document had a folder
        if (doc.deletedFolderInfo) {
            // Check if the original folder still exists
            const existingFolder = await FolderModel.findOne({
                _id: doc.deletedFolderInfo.folderId,
                ownerId,
            });

            if (existingFolder) {
                // Original folder exists, use it
                folderId = existingFolder._id;
            } else if (options?.recreateFolder !== false) {
                // Recreate the folder structure
                const recreatedFolder = await this.recreateFolderFromInfo(ownerId, doc.deletedFolderInfo);
                if (recreatedFolder) {
                    folderId = recreatedFolder._id;
                    folderRecreated = true;
                }
            }
            // If recreateFolder is false, document goes to root (folderId stays null)
        } else if (doc.folderId) {
            // Document has a folderId but no deletedFolderInfo (old format)
            // Check if folder still exists
            const existingFolder = await FolderModel.findOne({
                _id: doc.folderId,
                ownerId,
            });

            if (existingFolder) {
                folderId = existingFolder._id;
            }
            // Otherwise, document goes to root
        }

        // Restore the document
        const updatedDoc = await DocumentModel.findByIdAndUpdate(
            id,
            {
                $set: {
                    isDeleted: false,
                    deletedAt: null,
                    deletedFolderInfo: null,
                    folderId,
                },
            },
            { new: true }
        );

        logger.info(`Document restored: ${id} by user ${ownerId}${folderRecreated ? ' (folder recreated)' : ''}`);

        return {
            ...this.toResponse(updatedDoc!),
            folderRecreated,
        };
    }

    /**
     * Recreate folder structure from deleted folder info
     */
    private async recreateFolderFromInfo(
        ownerId: string,
        folderInfo: IDeletedFolderInfo
    ): Promise<mongoose.Document | null> {
        try {
            // Parse the path to get folder hierarchy
            const pathParts = folderInfo.path.split('/').filter(Boolean);
            
            if (pathParts.length === 0) {
                return null;
            }

            let parentId: mongoose.Types.ObjectId | null = null;
            let currentPath = '';
            let lastFolder: mongoose.Document | null = null;

            // Recreate each folder in the path
            for (let i = 0; i < pathParts.length; i++) {
                const folderName = pathParts[i];
                currentPath = currentPath + '/' + folderName;

                // Check if this folder already exists
                let folder = await FolderModel.findOne({
                    ownerId,
                    path: currentPath,
                });

                if (!folder) {
                    // Create the folder
                    folder = await FolderModel.create({
                        name: folderName,
                        parentId,
                        ownerId,
                        path: currentPath,
                        depth: i,
                        metadata: {},
                    });

                    logger.info(`Folder recreated during document restore: ${folder._id} (${currentPath})`);
                }

                parentId = folder._id;
                lastFolder = folder;
            }

            return lastFolder;
        } catch (error) {
            logger.error('Failed to recreate folder structure:', {
                error: error instanceof Error ? error.message : error,
                folderInfo,
            });
            return null;
        }
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

        if (docs.length === 0) {
            return 0;
        }

        const totalSize = docs.reduce((sum, doc) => sum + doc.size, 0);

        const keys = docs.map(doc => doc.storageKey);
        await this.storage.deleteMany(keys);

        const result = await DocumentModel.deleteMany({ ownerId, isDeleted: true });

        if (totalSize > 0) {
            await userService.updateStorageUsed(ownerId, -totalSize);
        }

        logger.info(`Trash emptied: ${result.deletedCount} documents deleted by user ${ownerId}`);

        return result.deletedCount;
    }
}

export const documentService = new DocumentService();
