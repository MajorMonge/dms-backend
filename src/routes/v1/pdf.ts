import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { pdfService } from '../../services/PdfService';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { splitPdfBodySchema, pdfIdParamsSchema } from '../../validation/pdf';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PdfInfo:
 *       type: object
 *       properties:
 *         pageCount:
 *           type: number
 *           example: 10
 *         title:
 *           type: string
 *           nullable: true
 *         author:
 *           type: string
 *           nullable: true
 *         subject:
 *           type: string
 *           nullable: true
 *         creator:
 *           type: string
 *           nullable: true
 *         producer:
 *           type: string
 *           nullable: true
 *         creationDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         modificationDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isEncrypted:
 *           type: boolean
 *
 *     JobInfo:
 *       type: object
 *       properties:
 *         jobId:
 *           type: string
 *           example: "job_1736697600000_1"
 *         taskId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [split, getInfo]
 *         status:
 *           type: string
 *           enum: [queued, processing, completed, failed, cancelled]
 *         documentId:
 *           type: string
 *         ownerId:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         startedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         error:
 *           type: string
 *           nullable: true
 *
 *     SplitPdfRequest:
 *       type: object
 *       required:
 *         - mode
 *       properties:
 *         mode:
 *           type: string
 *           enum: [all, ranges, chunks, extract]
 *           description: |
 *             Split mode:
 *             - `all`: Each page as a separate PDF
 *             - `ranges`: Split by page ranges
 *             - `chunks`: Split into N-page chunks
 *             - `extract`: Extract specific pages into one PDF
 *         ranges:
 *           type: array
 *           description: Required for 'ranges' mode
 *           items:
 *             type: object
 *             properties:
 *               start:
 *                 type: number
 *                 description: Start page (1-indexed)
 *               end:
 *                 type: number
 *                 description: End page (1-indexed)
 *               pages:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Specific pages to include
 *         chunkSize:
 *           type: number
 *           minimum: 1
 *           maximum: 100
 *           description: Pages per chunk (required for 'chunks' mode)
 *         pages:
 *           type: array
 *           items:
 *             type: number
 *           description: Specific pages to extract (required for 'extract' mode)
 *         folderId:
 *           type: string
 *           nullable: true
 *           description: Folder to save output documents
 *         namePrefix:
 *           type: string
 *           maxLength: 100
 *           description: Prefix for output file names
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags for all output documents
 *
 *     SplitResultItem:
 *       type: object
 *       properties:
 *         documentId:
 *           type: string
 *         name:
 *           type: string
 *         pageCount:
 *           type: number
 *         size:
 *           type: number
 *         pages:
 *           type: array
 *           items:
 *             type: number
 *
 *     SplitPdfResponse:
 *       type: object
 *       properties:
 *         originalDocumentId:
 *           type: string
 *         originalPageCount:
 *           type: number
 *         outputDocuments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SplitResultItem'
 *         totalOutputSize:
 *           type: number
 */

/**
 * @swagger
 * /api/v1/pdf/{id}/info:
 *   get:
 *     summary: Get PDF information
 *     description: Retrieve metadata and page count for a PDF document
 *     tags: [PDF Processing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: PDF information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PdfInfo'
 *       400:
 *         description: Document is not a PDF or is encrypted
 *       404:
 *         description: Document not found
 */
router.get(
    '/:id/info',
    authenticate,
    validate({ params: pdfIdParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const info = await pdfService.getInfo(req.params.id as string, req.user!.id);
            res.json({ success: true, data: info });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/pdf/{id}/split:
 *   post:
 *     summary: Split a PDF document
 *     description: |
 *       Split a PDF document into multiple documents using various modes:
 *       
 *       **Mode: all**
 *       Splits each page into a separate PDF document.
 *       
 *       **Mode: ranges**
 *       Split by specified page ranges. Each range becomes a separate document.
 *       ```json
 *       {
 *         "mode": "ranges",
 *         "ranges": [
 *           { "start": 1, "end": 5 },
 *           { "start": 6, "end": 10 },
 *           { "pages": [12, 15, 18] }
 *         ]
 *       }
 *       ```
 *       
 *       **Mode: chunks**
 *       Split into fixed-size chunks.
 *       ```json
 *       {
 *         "mode": "chunks",
 *         "chunkSize": 5
 *       }
 *       ```
 *       
 *       **Mode: extract**
 *       Extract specific pages into a single new document.
 *       ```json
 *       {
 *         "mode": "extract",
 *         "pages": [1, 3, 5, 7]
 *       }
 *       ```
 *     tags: [PDF Processing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID of the PDF to split
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SplitPdfRequest'
 *           examples:
 *             splitAll:
 *               summary: Split all pages
 *               value:
 *                 mode: all
 *             splitChunks:
 *               summary: Split into 5-page chunks
 *               value:
 *                 mode: chunks
 *                 chunkSize: 5
 *             splitRanges:
 *               summary: Split by ranges
 *               value:
 *                 mode: ranges
 *                 ranges:
 *                   - start: 1
 *                     end: 5
 *                   - start: 6
 *                     end: 10
 *             extractPages:
 *               summary: Extract specific pages
 *               value:
 *                 mode: extract
 *                 pages: [1, 3, 5, 7, 9]
 *     responses:
 *       201:
 *         description: PDF split successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SplitPdfResponse'
 *       400:
 *         description: |
 *           Invalid request:
 *           - Document is not a PDF
 *           - PDF is encrypted
 *           - Invalid split parameters
 *           - Insufficient storage space
 *       404:
 *         description: Document not found
 */
router.post(
    '/:id/split',
    authenticate,
    validate({ params: pdfIdParamsSchema, body: splitPdfBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await pdfService.split(
                req.params.id as string,
                req.user!.id,
                req.body
            );
            res.status(StatusCodes.CREATED).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/pdf/workers/stats:
 *   get:
 *     summary: Get worker pool statistics
 *     description: Returns the current state of the PDF processing worker pool
 *     tags: [PDF Processing]
 *     responses:
 *       200:
 *         description: Worker pool statistics
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
 *                     total:
 *                       type: number
 *                       description: Total number of workers
 *                     busy:
 *                       type: number
 *                       description: Number of workers currently processing
 *                     queued:
 *                       type: number
 *                       description: Number of tasks waiting in queue
 */
router.get(
    '/workers/stats',
    async (_req: Request, res: Response) => {
        const stats = pdfService.getWorkerStats();
        res.json({ success: true, data: stats });
    }
);

// ==================== Job Management Routes ====================

/**
 * @swagger
 * /api/v1/pdf/jobs:
 *   get:
 *     summary: Get all jobs for the current user
 *     description: Returns all PDF processing jobs (queued, processing, completed, failed, cancelled)
 *     tags: [PDF Processing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of jobs
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
 *                     $ref: '#/components/schemas/JobInfo'
 */
router.get(
    '/jobs',
    authenticate,
    async (req: Request, res: Response) => {
        const jobs = pdfService.getJobs(req.user!.id);
        res.json({ success: true, data: jobs });
    }
);

/**
 * @swagger
 * /api/v1/pdf/jobs/queued:
 *   get:
 *     summary: Get queued jobs for the current user
 *     description: Returns only jobs that are waiting in the queue
 *     tags: [PDF Processing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of queued jobs
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
 *                     $ref: '#/components/schemas/JobInfo'
 */
router.get(
    '/jobs/queued',
    authenticate,
    async (req: Request, res: Response) => {
        const jobs = pdfService.getQueuedJobs(req.user!.id);
        res.json({ success: true, data: jobs });
    }
);

/**
 * @swagger
 * /api/v1/pdf/jobs/{jobId}:
 *   get:
 *     summary: Get a specific job
 *     tags: [PDF Processing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/JobInfo'
 *       404:
 *         description: Job not found
 */
router.get(
    '/jobs/:jobId',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const job = pdfService.getJob(req.params.jobId as string, req.user!.id);
            res.json({ success: true, data: job });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/pdf/jobs/{jobId}/cancel:
 *   post:
 *     summary: Cancel a job
 *     description: |
 *       Cancel a queued or processing job.
 *       - Queued jobs are removed from the queue immediately
 *       - Processing jobs will terminate the worker (the worker pool will create a replacement)
 *     tags: [PDF Processing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID to cancel
 *     responses:
 *       200:
 *         description: Job cancelled
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
 *                     cancelled:
 *                       type: boolean
 *                     wasProcessing:
 *                       type: boolean
 *                       description: True if the job was actively processing (not just queued)
 *       404:
 *         description: Job not found
 *       400:
 *         description: Job cannot be cancelled (already completed, failed, or cancelled)
 */
router.post(
    '/jobs/:jobId/cancel',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await pdfService.cancelJob(req.params.jobId as string, req.user!.id);
            
            if (!result.success) {
                res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: 'Job cannot be cancelled (may be already completed, failed, or cancelled)',
                });
                return;
            }
            
            res.json({
                success: true,
                data: {
                    cancelled: result.success,
                    wasProcessing: result.wasProcessing,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/pdf/jobs/{jobId}:
 *   delete:
 *     summary: Cancel and remove a job (alias for cancel)
 *     tags: [PDF Processing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job cancelled
 *       404:
 *         description: Job not found
 */
router.delete(
    '/jobs/:jobId',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await pdfService.cancelJob(req.params.jobId as string, req.user!.id);
            
            if (!result.success) {
                res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    error: 'Job cannot be cancelled',
                });
                return;
            }
            
            res.json({
                success: true,
                data: {
                    cancelled: result.success,
                    wasProcessing: result.wasProcessing,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
