import mongoose from 'mongoose';
import { FolderModel, IFolderDocument, MAX_FOLDER_DEPTH } from '../models/Folder';
import { DocumentModel } from '../models/Document';
import { logger } from '../config/logger';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/errorHandler';
import {
    CreateFolderDTO,
    UpdateFolderDTO,
    MoveFolderDTO,
    FolderResponse,
    FolderWithCounts,
    FolderListQuery,
    FolderListResponse,
    FolderTreeNode,
    BreadcrumbItem,
} from '../types/folder';

export class FolderService {
    /**
     * Transform folder document to response format
     */
    private toResponse(folder: IFolderDocument): FolderResponse {
        return {
            id: folder._id.toString(),
            name: folder.name,
            parentId: folder.parentId?.toString() || null,
            ownerId: folder.ownerId,
            path: folder.path,
            depth: folder.depth,
            metadata: folder.metadata,
            isDeleted: folder.isDeleted,
            deletedAt: folder.deletedAt,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
        };
    }

    /**
     * Generate path for a folder based on parent
     */
    private async generatePath(
        ownerId: string,
        parentId: string | null,
        name: string
    ): Promise<{ path: string; depth: number }> {
        if (!parentId) {
            return { path: `/${name}`, depth: 0 };
        }

        const parent = await FolderModel.findOne({
            _id: parentId,
            ownerId,
            isDeleted: false,
        });

        if (!parent) {
            throw new NotFoundError('Parent folder');
        }

        const depth = parent.depth + 1;
        if (depth > MAX_FOLDER_DEPTH) {
            throw new ValidationError(
                `Maximum folder nesting depth of ${MAX_FOLDER_DEPTH} exceeded`,
                'FOLDER_MAX_DEPTH_EXCEEDED'
            );
        }

        return {
            path: `${parent.path}/${name}`,
            depth,
        };
    }

    /**
     * Check if folder name is unique within parent
     */
    private async checkUniqueName(
        ownerId: string,
        parentId: string | null,
        name: string,
        excludeId?: string
    ): Promise<void> {
        const filter: Record<string, unknown> = {
            ownerId,
            parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
            name: { $regex: new RegExp(`^${name}$`, 'i') }, // Case-insensitive
            isDeleted: false,
        };

        if (excludeId) {
            filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
        }

        const existing = await FolderModel.findOne(filter);
        if (existing) {
            throw new ConflictError(
                `A folder named "${name}" already exists in this location`,
                'FOLDER_NAME_EXISTS'
            );
        }
    }

    /**
     * Create a new folder
     */
    async create(ownerId: string, data: CreateFolderDTO): Promise<FolderResponse> {
        const parentId = data.parentId || null;

        // Check unique name
        await this.checkUniqueName(ownerId, parentId, data.name);

        // Generate path and depth
        const { path, depth } = await this.generatePath(ownerId, parentId, data.name);

        const folder = await FolderModel.create({
            name: data.name,
            parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
            ownerId,
            path,
            depth,
            metadata: data.metadata || {},
        });

        logger.info(`Folder created: ${folder._id} by user ${ownerId}`);

        return this.toResponse(folder);
    }

    /**
     * Get folder by ID
     */
    async getById(id: string, ownerId: string): Promise<FolderResponse> {
        const folder = await FolderModel.findOne({
            _id: id,
            ownerId,
            isDeleted: false,
        });

        if (!folder) {
            throw new NotFoundError('Folder');
        }

        return this.toResponse(folder);
    }

    /**
     * Get folder by ID with document and subfolder counts
     */
    async getByIdWithCounts(id: string, ownerId: string): Promise<FolderWithCounts> {
        const folder = await this.getById(id, ownerId);

        const [documentCount, subfolderCount] = await Promise.all([
            DocumentModel.countDocuments({
                folderId: new mongoose.Types.ObjectId(id),
                ownerId,
                isDeleted: false,
            }),
            FolderModel.countDocuments({
                parentId: new mongoose.Types.ObjectId(id),
                ownerId,
                isDeleted: false,
            }),
        ]);

        return {
            ...folder,
            documentCount,
            subfolderCount,
        };
    }

    /**
     * List folders with filtering and pagination
     */
    async list(ownerId: string, query: FolderListQuery): Promise<FolderListResponse> {
        const {
            parentId,
            search,
            includeDeleted = false,
            page = 1,
            limit = 50,
            sortBy = 'name',
            sortOrder = 'asc',
        } = query;

        const filter: Record<string, unknown> = { ownerId };

        if (!includeDeleted) {
            filter.isDeleted = false;
        }

        // Filter by parent (null = root folders)
        if (parentId !== undefined) {
            filter.parentId = parentId ? new mongoose.Types.ObjectId(parentId) : null;
        }

        if (search) {
            filter.$text = { $search: search };
        }

        const total = await FolderModel.countDocuments(filter);

        const folders = await FolderModel.find(filter)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return {
            folders: folders.map((f) => this.toResponse(f)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get root folders (no parent)
     */
    async getRootFolders(ownerId: string): Promise<FolderResponse[]> {
        const folders = await FolderModel.find({
            ownerId,
            parentId: null,
            isDeleted: false,
        }).sort({ name: 1 });

        return folders.map((f) => this.toResponse(f));
    }

    /**
     * Get subfolders of a folder
     */
    async getSubfolders(folderId: string, ownerId: string): Promise<FolderResponse[]> {
        const folders = await FolderModel.find({
            ownerId,
            parentId: new mongoose.Types.ObjectId(folderId),
            isDeleted: false,
        }).sort({ name: 1 });

        return folders.map((f) => this.toResponse(f));
    }

    /**
     * Get breadcrumb path for a folder
     */
    async getBreadcrumbs(folderId: string, ownerId: string): Promise<BreadcrumbItem[]> {
        const folder = await FolderModel.findOne({
            _id: folderId,
            ownerId,
            isDeleted: false,
        });

        if (!folder) {
            throw new NotFoundError('Folder');
        }

        const breadcrumbs: BreadcrumbItem[] = [];
        let current: IFolderDocument | null = folder;

        while (current) {
            breadcrumbs.unshift({
                id: current._id.toString(),
                name: current.name,
                path: current.path,
            });

            if (current.parentId) {
                current = await FolderModel.findOne({
                    _id: current.parentId,
                    ownerId,
                    isDeleted: false,
                });
            } else {
                current = null;
            }
        }

        return breadcrumbs;
    }

    /**
     * Get folder tree (hierarchical structure)
     */
    async getFolderTree(ownerId: string, rootId?: string | null): Promise<FolderTreeNode[]> {
        // Get all non-deleted folders for this user
        const allFolders = await FolderModel.find({
            ownerId,
            isDeleted: false,
        }).sort({ name: 1 });

        // Build a map of folders by ID
        const folderMap = new Map<string, FolderTreeNode>();
        allFolders.forEach((f) => {
            folderMap.set(f._id.toString(), {
                ...this.toResponse(f),
                children: [],
            });
        });

        // Build tree structure
        const rootNodes: FolderTreeNode[] = [];
        folderMap.forEach((node) => {
            if (node.parentId && folderMap.has(node.parentId)) {
                folderMap.get(node.parentId)!.children.push(node);
            } else if (!node.parentId) {
                rootNodes.push(node);
            }
        });

        // If rootId is specified, return only that subtree
        if (rootId) {
            const rootNode = folderMap.get(rootId);
            return rootNode ? [rootNode] : [];
        }

        return rootNodes;
    }

    /**
     * Update folder
     */
    async update(id: string, ownerId: string, data: UpdateFolderDTO): Promise<FolderResponse> {
        const folder = await FolderModel.findOne({
            _id: id,
            ownerId,
            isDeleted: false,
        });

        if (!folder) {
            throw new NotFoundError('Folder');
        }

        const updateData: Record<string, unknown> = {};

        if (data.name !== undefined && data.name !== folder.name) {
            // Check unique name
            await this.checkUniqueName(
                ownerId,
                folder.parentId?.toString() || null,
                data.name,
                id
            );
            updateData.name = data.name;

            // Update path for this folder and all descendants
            await this.updatePathsForRename(folder, data.name);
        }

        if (data.metadata !== undefined) {
            updateData.metadata = data.metadata;
        }

        const updated = await FolderModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        logger.info(`Folder updated: ${id} by user ${ownerId}`);

        return this.toResponse(updated!);
    }

    /**
     * Update paths when a folder is renamed
     */
    private async updatePathsForRename(folder: IFolderDocument, newName: string): Promise<void> {
        const oldPath = folder.path;
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = parentPath ? `${parentPath}/${newName}` : `/${newName}`;

        // Update this folder's path
        await FolderModel.updateOne({ _id: folder._id }, { $set: { path: newPath, name: newName } });

        // Update all descendants' paths
        const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await FolderModel.updateMany(
            {
                ownerId: folder.ownerId,
                path: { $regex: `^${escapedOldPath}/` },
            },
            [
                {
                    $set: {
                        path: {
                            $concat: [newPath, { $substr: ['$path', oldPath.length, -1] }],
                        },
                    },
                },
            ]
        );
    }

    /**
     * Move folder to a different parent
     */
    async move(id: string, ownerId: string, data: MoveFolderDTO): Promise<FolderResponse> {
        const folder = await FolderModel.findOne({
            _id: id,
            ownerId,
            isDeleted: false,
        });

        if (!folder) {
            throw new NotFoundError('Folder');
        }

        const newParentId = data.parentId;

        // Prevent moving to same location
        if (
            (folder.parentId?.toString() || null) === newParentId
        ) {
            return this.toResponse(folder);
        }

        // Prevent moving folder into itself or its descendants
        if (newParentId) {
            const targetParent = await FolderModel.findOne({
                _id: newParentId,
                ownerId,
                isDeleted: false,
            });

            if (!targetParent) {
                throw new NotFoundError('Target folder');
            }

            // Check if target is a descendant of the folder being moved
            if (targetParent.path.startsWith(folder.path + '/')) {
                throw new ValidationError(
                    'Cannot move a folder into its own subfolder',
                    'FOLDER_MOVE_INTO_SELF'
                );
            }
        }

        // Check unique name in new location
        await this.checkUniqueName(ownerId, newParentId, folder.name, id);

        // Generate new path and depth
        const { path: newPath, depth: newDepth } = await this.generatePath(
            ownerId,
            newParentId,
            folder.name
        );

        // Check if moving would exceed max depth for any descendants
        const maxDescendantDepth = await this.getMaxDescendantDepth(folder);
        const depthIncrease = newDepth - folder.depth;
        if (maxDescendantDepth + depthIncrease > MAX_FOLDER_DEPTH) {
            throw new ValidationError(
                `Moving this folder would exceed the maximum nesting depth of ${MAX_FOLDER_DEPTH}`,
                'FOLDER_MAX_DEPTH_EXCEEDED'
            );
        }

        const oldPath = folder.path;
        const oldDepth = folder.depth;

        // Update this folder
        await FolderModel.updateOne(
            { _id: id },
            {
                $set: {
                    parentId: newParentId ? new mongoose.Types.ObjectId(newParentId) : null,
                    path: newPath,
                    depth: newDepth,
                },
            }
        );

        // Update all descendants' paths and depths
        const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await FolderModel.updateMany(
            {
                ownerId,
                path: { $regex: `^${escapedOldPath}/` },
            },
            [
                {
                    $set: {
                        path: {
                            $concat: [newPath, { $substr: ['$path', oldPath.length, -1] }],
                        },
                        depth: { $add: ['$depth', depthIncrease] },
                    },
                },
            ]
        );

        const updated = await FolderModel.findById(id);
        logger.info(`Folder moved: ${id} by user ${ownerId}`);

        return this.toResponse(updated!);
    }

    /**
     * Get maximum depth among descendants
     */
    private async getMaxDescendantDepth(folder: IFolderDocument): Promise<number> {
        const escapedPath = folder.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const deepest = await FolderModel.findOne({
            ownerId: folder.ownerId,
            path: { $regex: `^${escapedPath}/` },
        }).sort({ depth: -1 });

        return deepest ? deepest.depth : folder.depth;
    }

    /**
     * Soft delete folder and all contents
     */
    async softDelete(id: string, ownerId: string): Promise<void> {
        const folder = await FolderModel.findOne({
            _id: id,
            ownerId,
            isDeleted: false,
        });

        if (!folder) {
            throw new NotFoundError('Folder');
        }

        const now = new Date();
        const escapedPath = folder.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Soft delete the folder
        await FolderModel.updateOne(
            { _id: id },
            { $set: { isDeleted: true, deletedAt: now } }
        );

        // Soft delete all subfolders
        await FolderModel.updateMany(
            {
                ownerId,
                path: { $regex: `^${escapedPath}/` },
                isDeleted: false,
            },
            { $set: { isDeleted: true, deletedAt: now } }
        );

        // Soft delete all documents in this folder and subfolders
        const folderIds = await FolderModel.find({
            ownerId,
            $or: [
                { _id: id },
                { path: { $regex: `^${escapedPath}/` } },
            ],
        }).distinct('_id');

        await DocumentModel.updateMany(
            {
                ownerId,
                folderId: { $in: folderIds },
                isDeleted: false,
            },
            { $set: { isDeleted: true, deletedAt: now } }
        );

        logger.info(`Folder soft deleted: ${id} by user ${ownerId}`);
    }

    /**
     * Restore soft-deleted folder
     */
    async restore(id: string, ownerId: string): Promise<FolderResponse> {
        const folder = await FolderModel.findOne({
            _id: id,
            ownerId,
            isDeleted: true,
        });

        if (!folder) {
            throw new NotFoundError('Folder');
        }

        // Check if parent exists and is not deleted (if has parent)
        if (folder.parentId) {
            const parent = await FolderModel.findOne({
                _id: folder.parentId,
                ownerId,
                isDeleted: false,
            });

            if (!parent) {
                throw new ValidationError(
                    'Cannot restore folder: parent folder is deleted. Restore the parent folder first.',
                    'FOLDER_PARENT_DELETED'
                );
            }
        }

        // Restore only this folder (not descendants - they must be restored individually)
        const updated = await FolderModel.findByIdAndUpdate(
            id,
            { $set: { isDeleted: false, deletedAt: null } },
            { new: true }
        );

        logger.info(`Folder restored: ${id} by user ${ownerId}`);

        return this.toResponse(updated!);
    }

    /**
     * Permanently delete folder and all contents
     */
    async permanentDelete(id: string, ownerId: string): Promise<{ foldersDeleted: number; documentsDeleted: number }> {
        const folder = await FolderModel.findOne({ _id: id, ownerId });

        if (!folder) {
            throw new NotFoundError('Folder');
        }

        const escapedPath = folder.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Get all folder IDs to delete
        const folderIds = await FolderModel.find({
            ownerId,
            $or: [
                { _id: id },
                { path: { $regex: `^${escapedPath}/` } },
            ],
        }).distinct('_id');

        // Note: Documents in these folders should be handled by DocumentService
        // to properly release storage. For now, we just unset their folderId.
        const docResult = await DocumentModel.updateMany(
            {
                ownerId,
                folderId: { $in: folderIds },
            },
            { $set: { folderId: null } }
        );

        // Delete folders
        const folderResult = await FolderModel.deleteMany({
            _id: { $in: folderIds },
        });

        logger.info(
            `Folder permanently deleted: ${id} by user ${ownerId} (${folderResult.deletedCount} folders, ${docResult.modifiedCount} documents orphaned)`
        );

        return {
            foldersDeleted: folderResult.deletedCount,
            documentsDeleted: docResult.modifiedCount,
        };
    }

    /**
     * Get folders in trash
     */
    async getTrash(ownerId: string, page = 1, limit = 50): Promise<FolderListResponse> {
        const filter = { ownerId, isDeleted: true };

        const total = await FolderModel.countDocuments(filter);

        const folders = await FolderModel.find(filter)
            .sort({ deletedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return {
            folders: folders.map((f) => this.toResponse(f)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

// Export singleton instance
export const folderService = new FolderService();
