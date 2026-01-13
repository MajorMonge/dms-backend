import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import { documentService } from '../../services/DocumentService';
import { validate, cacheControl, setLastModified, cacheConfigs } from '../../middleware/index';
import { authenticate } from '../../middleware/auth';
import { config } from '../../config/index';
import {
    idParamsSchema,
    updateDocumentBodySchema,
    deleteDocumentQuerySchema,
    listDocumentsQuerySchema,
    presignedUploadBodySchema,
    confirmUploadBodySchema,
    moveDocumentBodySchema,
    copyDocumentBodySchema,
    searchDocumentsQuerySchema,
} from '../../validation/document';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
    },
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           example: "quarterly-report.pdf"
 *         originalName:
 *           type: string
 *           example: "quarterly-report.pdf"
 *         mimeType:
 *           type: string
 *           example: "application/pdf"
 *         size:
 *           type: number
 *           example: 1024000
 *         extension:
 *           type: string
 *           example: "pdf"
 *         folderId:
 *           type: string
 *           nullable: true
 *           example: "507f1f77bcf86cd799439012"
 *         ownerId:
 *           type: string
 *           example: "user-123"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: ["report", "finance"]
 *         version:
 *           type: number
 *           example: 1
 *         isDeleted:
 *           type: boolean
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         downloadUrl:
 *           type: string
 *           description: Presigned download URL (when requested)
 *     
 *     DocumentList:
 *       type: object
 *       properties:
 *         documents:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Document'
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
 *     PresignedUpload:
 *       type: object
 *       properties:
 *         uploadUrl:
 *           type: string
 *           description: Presigned URL for direct S3 upload
 *         key:
 *           type: string
 *           description: Storage key to use when confirming upload
 *         expiresIn:
 *           type: number
 *           description: URL expiration time in seconds
 */

/**
 * @swagger
 * /api/v1/documents:
 *   get:
 *     summary: List documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: folderId
 *         schema:
 *           type: string
 *         description: Filter by folder ID (use 'null' for root)
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, tags, and extension
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt, size]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DocumentList'
 */
router.get(
    '/',
    authenticate,
    cacheControl(cacheConfigs.document_list),
    setLastModified,
    validate({ query: listDocumentsQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await documentService.list(req.user!.id, req.query as any);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/search:
 *   get:
 *     summary: Search documents with advanced filters
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search across name, originalName, tags, and extension (e.g., 'budget pdf' finds files with budget in name and pdf extension)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by document name
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
 *       - in: query
 *         name: extension
 *         schema:
 *           type: string
 *         description: Filter by file extension (e.g., pdf, docx)
 *       - in: query
 *         name: mimeType
 *         schema:
 *           type: string
 *         description: Filter by MIME type
 *       - in: query
 *         name: minSize
 *         schema:
 *           type: integer
 *         description: Minimum file size in bytes
 *       - in: query
 *         name: maxSize
 *         schema:
 *           type: integer
 *         description: Maximum file size in bytes
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter documents created from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter documents created until this date
 *       - in: query
 *         name: folderId
 *         schema:
 *           type: string
 *         description: Filter by folder ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt, size, relevance]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Search results with metadata
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
 *                     documents:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Document'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: number
 *                         limit:
 *                           type: number
 *                         total:
 *                           type: number
 *                         totalPages:
 *                           type: number
 *                     searchMeta:
 *                       type: object
 *                       properties:
 *                         query:
 *                           type: string
 *                         resultsFound:
 *                           type: number
 *                         searchTime:
 *                           type: number
 *                           description: Search execution time in milliseconds
 */
router.get(
    '/search',
    authenticate,
    cacheControl(cacheConfigs.document_search),
    setLastModified,
    validate({ query: searchDocumentsQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await documentService.search(req.user!.id, req.query as any);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/upload/presigned:
 *   post:
 *     summary: Get presigned URL for direct upload
 *     description: Returns a presigned URL for direct upload to S3. After uploading, call /documents/upload/confirm.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - mimeType
 *               - size
 *             properties:
 *               fileName:
 *                 type: string
 *                 example: "report.pdf"
 *               mimeType:
 *                 type: string
 *                 example: "application/pdf"
 *               size:
 *                 type: number
 *                 example: 1024000
 *               folderId:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Presigned upload URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PresignedUpload'
 */
router.post(
    '/upload/presigned',
    authenticate,
    validate({ body: presignedUploadBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { fileName, mimeType, size } = req.body;
            const result = await documentService.getPresignedUploadUrl(
                req.user!.id,
                fileName,
                mimeType,
                size
            );
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/upload/confirm:
 *   post:
 *     summary: Confirm upload and create document record
 *     description: After uploading to the presigned URL, call this to create the document record.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *             properties:
 *               key:
 *                 type: string
 *                 description: Storage key from presigned upload response
 *               name:
 *                 type: string
 *                 description: Custom document name
 *               folderId:
 *                 type: string
 *                 nullable: true
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Document created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Document'
 */
router.post(
    '/upload/confirm',
    authenticate,
    validate({ body: confirmUploadBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { key, name, folderId, tags, metadata } = req.body;
            const document = await documentService.confirmUpload(req.user!.id, key, {
                name,
                folderId,
                tags,
                metadata,
            });
            res.status(StatusCodes.CREATED).json({ success: true, data: document });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/upload:
 *   post:
 *     summary: Upload document directly (multipart)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *               folderId:
 *                 type: string
 *               tags:
 *                 type: string
 *                 description: Comma-separated tags
 *     responses:
 *       201:
 *         description: Document uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Document'
 */
router.post(
    '/upload',
    authenticate,
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: { code: 'NO_FILE', message: 'No file provided' },
                });
            }

            const tags = req.body.tags ? req.body.tags.split(',').map((t: string) => t.trim()) : [];

            const document = await documentService.uploadDirect(
                req.user!.id,
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype,
                {
                    name: req.body.name,
                    folderId: req.body.folderId || null,
                    tags,
                    metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined,
                }
            );

            res.status(StatusCodes.CREATED).json({ success: true, data: document });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/trash:
 *   get:
 *     summary: Get documents in trash
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Trash contents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DocumentList'
 */
router.get(
    '/trash',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const result = await documentService.getTrash(req.user!.id, page, limit);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/trash:
 *   delete:
 *     summary: Empty trash (permanently delete all)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trash emptied
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
 *                     deletedCount:
 *                       type: number
 */
router.delete(
    '/trash',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const deletedCount = await documentService.emptyTrash(req.user!.id);
            res.json({ success: true, data: { deletedCount } });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   get:
 *     summary: Get document by ID
 *     tags: [Documents]
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
 *         description: Document details with download URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Document'
 *       404:
 *         description: Document not found
 */
router.get(
    '/:id',
    authenticate,
    cacheControl(cacheConfigs.document_detail),
    setLastModified,
    validate({ params: idParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const document = await documentService.getById(req.params.id as string, req.user!.id);
            res.json({ success: true, data: document });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   patch:
 *     summary: Update document metadata
 *     tags: [Documents]
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
 *               folderId:
 *                 type: string
 *                 nullable: true
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Document updated
 */
router.patch(
    '/:id',
    authenticate,
    validate({ params: idParamsSchema, body: updateDocumentBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const document = await documentService.update(req.params.id as string, req.user!.id, req.body);
            res.json({ success: true, data: document });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   delete:
 *     summary: Delete document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: permanent
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Permanently delete instead of moving to trash
 *     responses:
 *       204:
 *         description: Document deleted
 */
router.delete(
    '/:id',
    authenticate,
    validate({ params: idParamsSchema, query: deleteDocumentQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // After validation, query.permanent is transformed to boolean
            const permanent = (req.query as { permanent?: boolean }).permanent === true;

            if (permanent) {
                await documentService.permanentDelete(req.params.id as string, req.user!.id);
            } else {
                await documentService.softDelete(req.params.id as string, req.user!.id);
            }

            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}/download:
 *   get:
 *     summary: Get presigned download URL
 *     tags: [Documents]
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
 *         description: Download URL
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
 *                     downloadUrl:
 *                       type: string
 *                     expiresIn:
 *                       type: number
 */
router.get(
    '/:id/download',
    authenticate,
    cacheControl(cacheConfigs.presigned_url),
    validate({ params: idParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await documentService.getDownloadUrl(req.params.id as string, req.user!.id);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}/move:
 *   post:
 *     summary: Move document to different folder
 *     tags: [Documents]
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
 *               - folderId
 *             properties:
 *               folderId:
 *                 type: string
 *                 nullable: true
 *                 description: Target folder ID (null for root)
 *     responses:
 *       200:
 *         description: Document moved
 */
router.post(
    '/:id/move',
    authenticate,
    validate({ params: idParamsSchema, body: moveDocumentBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const document = await documentService.move(req.params.id as string, req.user!.id, req.body.folderId);
            res.json({ success: true, data: document });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}/copy:
 *   post:
 *     summary: Copy document
 *     tags: [Documents]
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
 *                 description: Name for the copy
 *               folderId:
 *                 type: string
 *                 nullable: true
 *                 description: Target folder ID
 *     responses:
 *       201:
 *         description: Document copied
 */
router.post(
    '/:id/copy',
    authenticate,
    validate({ params: idParamsSchema, body: copyDocumentBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const document = await documentService.copy(req.params.id as string, req.user!.id, req.body);
            res.status(StatusCodes.CREATED).json({ success: true, data: document });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/documents/{id}/restore:
 *   post:
 *     summary: Restore document from trash
 *     tags: [Documents]
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
 *         description: Document restored
 */
router.post(
    '/:id/restore',
    authenticate,
    validate({ params: idParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const document = await documentService.restore(req.params.id as string, req.user!.id);
            res.json({ success: true, data: document });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
