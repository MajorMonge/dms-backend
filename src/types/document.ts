import { IDocument } from '../models/Document';

export interface CreateDocumentDTO {
    name: string;
    originalName: string;
    mimeType: string;
    size: number;
    extension: string;
    storageKey: string;
    folderId?: string | null;
    ownerId: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
}

export interface UpdateDocumentDTO {
    name?: string;
    folderId?: string | null;
    tags?: string[];
    metadata?: Record<string, unknown>;
}

export interface DocumentResponse extends Omit<IDocument, 'folderId'> {
    id: string;
    folderId?: string | null;
    downloadUrl?: string;
}

export interface DocumentListQuery {
    folderId?: string | null;
    ownerId?: string;
    tags?: string[];
    search?: string;
    includeDeleted?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'size';
    sortOrder?: 'asc' | 'desc';
}

export interface DocumentSearchQuery {
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

export interface DocumentSearchResponse {
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
}

export interface DocumentListResponse {
    documents: DocumentResponse[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface UploadDocumentRequest {
    file: Express.Multer.File;
    name?: string;
    folderId?: string | null;
    tags?: string[];
    metadata?: Record<string, unknown>;
}

export interface PresignedUploadResponse {
    uploadUrl: string;
    key: string;
    expiresIn: number;
}

export interface PresignedDownloadResponse {
    downloadUrl: string;
    expiresIn: number;
}
