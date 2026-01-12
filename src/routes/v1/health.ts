import { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { MongoDBAdapter } from '../../adapters/database/index.js';
import { config } from '../../config/index.js';

const router = Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Check API health status
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: 1.0.0
 *                     environment:
 *                       type: string
 *                       example: development
 *                     services:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: string
 *                           example: connected
 */
router.get('/', (_req: Request, res: Response) => {
  const db = MongoDBAdapter.getInstance();

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.nodeEnv,
      services: {
        database: db.getStatus(),
      },
    },
  });
});

/**
 * @swagger
 * /api/v1/health/ready:
 *   get:
 *     summary: Check if API is ready to receive traffic
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API is ready
 *       503:
 *         description: API is not ready
 */
router.get('/ready', (_req: Request, res: Response) => {
  const db = MongoDBAdapter.getInstance();

  if (!db.isConnected()) {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      error: {
        code: 'NOT_READY',
        message: 'Service is not ready',
        services: {
          database: db.getStatus(),
        },
      },
    });
    return;
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      status: 'ready',
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * @swagger
 * /api/v1/health/live:
 *   get:
 *     summary: Check if API is alive (liveness probe)
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API is alive
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
