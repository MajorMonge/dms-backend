import { IFolder } from '../models/Folder';

/**
 * DTO for creating a folder
 */
export interface CreateFolderDTO {
    name: string;
    parentId?: string | null;
    metadata?: Record<string, unknown>;
}

/**
 * DTO for updating a folder
 */
export interface UpdateFolderDTO {
    name?: string;
    metadata?: Record<string, unknown>;
}

/**
 * DTO for moving a folder
 */
export interface MoveFolderDTO {
    parentId: string | null;
}

/**
 * Folder response format
 */
export interface FolderResponse extends Omit<IFolder, 'parentId'> {
    id: string;
    parentId: string | null;
}

/**
 * Folder with document/subfolder counts
 */
export interface FolderWithCounts extends FolderResponse {
    documentCount: number;
    subfolderCount: number;
}

/**
 * Query params for listing folders
 */
export interface FolderListQuery {
    parentId?: string | null;
    search?: string;
    includeDeleted?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated folder list response
 */
export interface FolderListResponse {
    folders: FolderResponse[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * Folder tree node (for hierarchical view)
 */
export interface FolderTreeNode extends FolderResponse {
    children: FolderTreeNode[];
    documentCount?: number;
}

/**
 * Breadcrumb item for navigation
 */
export interface BreadcrumbItem {
    id: string;
    name: string;
    path: string;
}
