import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { folderService } from '../../services/FolderService';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
    createFolderBodySchema,
    updateFolderBodySchema,
    moveFolderBodySchema,
    folderIdParamsSchema,
    listFoldersQuerySchema,
} from '../../validation/folder';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Folder:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           example: "Projects"
 *         parentId:
 *           type: string
 *           nullable: true
 *           example: "507f1f77bcf86cd799439012"
 *         ownerId:
 *           type: string
 *           example: "a1b2c3d4-e5f6-7890-abcd"
 *         path:
 *           type: string
 *           description: Full path from root
 *           example: "/Documents/Projects"
 *         depth:
 *           type: number
 *           description: Nesting level (0 = root)
 *           example: 1
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *         isDeleted:
 *           type: boolean
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     FolderWithCounts:
 *       allOf:
 *         - $ref: '#/components/schemas/Folder'
 *         - type: object
 *           properties:
 *             documentCount:
 *               type: number
 *             subfolderCount:
 *               type: number
 *
 *     FolderList:
 *       type: object
 *       properties:
 *         folders:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Folder'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: number
 *             limit:
 *               type: number
 *             total:
 *               type: number
 *             totalPages:
 *               type: number
 *
 *     Breadcrumb:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         path:
 *           type: string
 */

// ==================== Folder CRUD Routes ====================

/**
 * @swagger
 * /api/v1/folders:
 *   post:
 *     summary: Create a new folder
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 description: Parent folder ID (null for root)
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Folder created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Folder'
 *       409:
 *         description: Folder with this name already exists
 */
router.post(
    '/',
    authenticate,
    validate({ body: createFolderBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const folder = await folderService.create(req.user!.id, req.body);
            res.status(StatusCodes.CREATED).json({ success: true, data: folder });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders:
 *   get:
 *     summary: List folders
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *         description: Filter by parent folder ID (use "null" for root folders)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in folder names
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt]
 *           default: name
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *     responses:
 *       200:
 *         description: List of folders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FolderList'
 */
router.get(
    '/',
    authenticate,
    validate({ query: listFoldersQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await folderService.list(req.user!.id, req.query as any);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders/root:
 *   get:
 *     summary: Get root folders (no parent)
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of root folders
 */
router.get(
    '/root',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const folders = await folderService.getRootFolders(req.user!.id);
            res.json({ success: true, data: folders });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders/tree:
 *   get:
 *     summary: Get folder tree structure
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rootId
 *         schema:
 *           type: string
 *         description: Start tree from this folder (optional)
 *     responses:
 *       200:
 *         description: Hierarchical folder tree
 */
router.get(
    '/tree',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rootId = req.query.rootId as string | undefined;
            const tree = await folderService.getFolderTree(req.user!.id, rootId);
            res.json({ success: true, data: tree });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders/{id}:
 *   get:
 *     summary: Get folder by ID
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeCounts
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include document and subfolder counts
 *     responses:
 *       200:
 *         description: Folder details
 *       404:
 *         description: Folder not found
 */
router.get(
    '/:id',
    authenticate,
    validate({ params: folderIdParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const includeCounts = req.query.includeCounts === 'true';
            const folder = includeCounts
                ? await folderService.getByIdWithCounts(req.params.id as string, req.user!.id)
                : await folderService.getById(req.params.id as string, req.user!.id);
            res.json({ success: true, data: folder });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders/{id}/subfolders:
 *   get:
 *     summary: Get subfolders of a folder
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of subfolders
 */
router.get(
    '/:id/subfolders',
    authenticate,
    validate({ params: folderIdParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const folders = await folderService.getSubfolders(req.params.id as string, req.user!.id);
            res.json({ success: true, data: folders });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders/{id}/breadcrumbs:
 *   get:
 *     summary: Get breadcrumb path for a folder
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Breadcrumb path
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Breadcrumb'
 */
router.get(
    '/:id/breadcrumbs',
    authenticate,
    validate({ params: folderIdParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const breadcrumbs = await folderService.getBreadcrumbs(req.params.id as string, req.user!.id);
            res.json({ success: true, data: breadcrumbs });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders/{id}:
 *   patch:
 *     summary: Update folder
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Folder updated
 */
router.patch(
    '/:id',
    authenticate,
    validate({ params: folderIdParamsSchema, body: updateFolderBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const folder = await folderService.update(req.params.id as string, req.user!.id, req.body);
            res.json({ success: true, data: folder });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders/{id}/move:
 *   post:
 *     summary: Move folder to a different parent
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - parentId
 *             properties:
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 description: New parent folder ID (null for root)
 *     responses:
 *       200:
 *         description: Folder moved
 *       400:
 *         description: Invalid move (e.g., moving into own subfolder)
 */
router.post(
    '/:id/move',
    authenticate,
    validate({ params: folderIdParamsSchema, body: moveFolderBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const folder = await folderService.move(req.params.id as string, req.user!.id, req.body);
            res.json({ success: true, data: folder });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/folders/{id}:
 *   delete:
 *     summary: Delete folder permanently
 *     description: |
 *       Permanently deletes the folder and all subfolders.
 *       Documents in these folders will be soft-deleted and can be restored later.
 *       When restoring a document, its original folder structure can be recreated.
 *     tags: [Folders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Folder deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     foldersDeleted:
 *                       type: number
 *                     documentsSoftDeleted:
 *                       type: number
 */
router.delete(
    '/:id',
    authenticate,
    validate({ params: folderIdParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await folderService.delete(req.params.id as string, req.user!.id);
            res.json({
                success: true,
                data: {
                    foldersDeleted: result.foldersDeleted,
                    documentsSoftDeleted: result.documentsSoftDeleted,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
