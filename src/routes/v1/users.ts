import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { userService } from '../../services/UserService.js';
import { validate } from '../../middleware/validate.js';
import { authenticate, requireGroups } from '../../middleware/auth.js';
import {
    updateUserBodySchema,
    adminUpdateUserBodySchema,
    userIdParamsSchema,
    listUsersQuerySchema,
} from '../../validation/user.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       description: |
 *         User record for Cognito-authenticated users.
 *         Authentication is handled by AWS Cognito - this model only stores
 *         local app data like storage tracking and preferences.
 *       properties:
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         cognitoId:
 *           type: string
 *           description: Cognito user sub (unique identifier)
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *         email:
 *           type: string
 *           description: Email (managed by Cognito, stored for reference)
 *           example: "user@example.com"
 *         storageUsed:
 *           type: number
 *           description: Storage used in bytes
 *           example: 1073741824
 *         storageLimit:
 *           type: number
 *           description: Storage limit in bytes (default 5GB)
 *           example: 5368709120
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     StorageInfo:
 *       type: object
 *       properties:
 *         used:
 *           type: number
 *           description: Bytes used
 *         limit:
 *           type: number
 *           description: Storage limit in bytes
 *         available:
 *           type: number
 *           description: Available bytes
 *         usedPercentage:
 *           type: number
 *           description: Percentage of storage used
 *
 *     UserList:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
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
 */

// ==================== Profile Routes ====================

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current user profile
 *     description: |
 *       Returns the current user's local data (storage tracking, preferences).
 *       User must be authenticated via Cognito.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get(
    '/me',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userService.getById(req.user!.id);
            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/users/me:
 *   patch:
 *     summary: Update current user metadata
 *     description: |
 *       Update the current user's metadata.
 *       Note: Profile data like name and avatar are managed in Cognito.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.patch(
    '/me',
    authenticate,
    validate({ body: updateUserBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userService.update(req.user!.id, req.body);
            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/users/me/storage:
 *   get:
 *     summary: Get current user storage info
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Storage info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/StorageInfo'
 *       401:
 *         description: Not authenticated
 */
router.get(
    '/me/storage',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const storage = await userService.getStorageInfo(req.user!.id);
            res.json({ success: true, data: storage });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== Admin Routes ====================

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List users (admin only)
 *     tags: [Users (Admin)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email or Cognito ID
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
 *           enum: [email, createdAt, storageUsed]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserList'
 *       403:
 *         description: Admin access required
 */
router.get(
    '/',
    authenticate,
    requireGroups('admin'),
    validate({ query: listUsersQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await userService.list(req.query as any);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID (admin only)
 *     tags: [Users (Admin)]
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
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get(
    '/:id',
    authenticate,
    requireGroups('admin'),
    validate({ params: userIdParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userService.getById(req.params.id as string);
            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   patch:
 *     summary: Update user (admin only)
 *     description: |
 *       Admin can update user metadata and storage limit.
 *       Note: User profile data (name, etc.) is managed in Cognito.
 *     tags: [Users (Admin)]
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
 *               storageLimit:
 *                 type: number
 *                 description: Storage limit in bytes
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 */
router.patch(
    '/:id',
    authenticate,
    requireGroups('admin'),
    validate({ params: userIdParamsSchema, body: adminUpdateUserBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userService.adminUpdate(req.params.id as string, req.body);
            res.json({ success: true, data: user });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Delete user (admin only)
 *     description: |
 *       Deletes the local user record. Note: This does NOT delete the user from Cognito.
 *       To fully delete a user, also remove them from the Cognito User Pool.
 *     tags: [Users (Admin)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted
 *       404:
 *         description: User not found
 */
router.delete(
    '/:id',
    authenticate,
    requireGroups('admin'),
    validate({ params: userIdParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            await userService.delete(req.params.id as string);
            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            next(error);
        }
    }
);

export default router;
