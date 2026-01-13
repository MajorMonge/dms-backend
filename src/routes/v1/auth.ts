import { Router, Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService } from '../../services/AuthService';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
    registerBodySchema,
    loginBodySchema,
    confirmEmailBodySchema,
    resendCodeBodySchema,
    forgotPasswordBodySchema,
    resetPasswordBodySchema,
    refreshTokenBodySchema,
} from '../../validation/auth';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AuthTokens:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: JWT access token for API authentication
 *         idToken:
 *           type: string
 *           description: JWT ID token with user claims
 *         refreshToken:
 *           type: string
 *           description: Refresh token for obtaining new access tokens
 *         expiresIn:
 *           type: number
 *           description: Token expiration time in seconds
 *
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: "Must contain uppercase, lowercase, number, and special character"
 *           example: "MyP@ssw0rd!"
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           format: password
 *           example: "MyP@ssw0rd!"
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             tokens:
 *               $ref: '#/components/schemas/AuthTokens'
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 cognitoId:
 *                   type: string
 */

// ==================== Registration ====================

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: |
 *       Creates a new user account using AWS Cognito.
 *       A verification code will be sent to the provided email.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                     userSub:
 *                       type: string
 *                     email:
 *                       type: string
 *                     confirmed:
 *                       type: boolean
 *                     message:
 *                       type: string
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post(
    '/register',
    validate({ body: registerBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.register(req.body);
            res.status(StatusCodes.CREATED).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== Email Confirmation ====================

/**
 * @swagger
 * /api/v1/auth/confirm-email:
 *   post:
 *     summary: Confirm email with verification code
 *     description: Verifies the user's email using the code sent during registration.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 description: 6-digit verification code
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired code
 */
router.post(
    '/confirm-email',
    validate({ body: confirmEmailBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.confirmEmail(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/auth/resend-code:
 *   post:
 *     summary: Resend verification code
 *     description: Resends the email verification code.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification code sent
 *       429:
 *         description: Too many requests
 */
router.post(
    '/resend-code',
    validate({ body: resendCodeBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.resendVerificationCode(req.body.email);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== Login ====================

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     description: |
 *       Authenticates a user and returns JWT tokens.
 *       The access token should be used in the Authorization header for subsequent requests.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials or unverified email
 */
router.post(
    '/login',
    validate({ body: loginBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.login(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== Token Refresh ====================

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: |
 *       Use a refresh token to obtain new access and ID tokens.
 *       This should be called when the access token expires (after 1 hour).
 *       The refresh token itself remains valid for 30 days.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token obtained from login
 *     responses:
 *       200:
 *         description: New tokens issued successfully
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
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post(
    '/refresh',
    validate({ body: refreshTokenBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tokens = await authService.refreshToken(req.body.refreshToken);
            res.json({ success: true, data: { tokens } });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== Logout ====================

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: |
 *       Signs out the user globally, invalidating all tokens.
 *       Requires a valid access token.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Not authenticated
 */
router.post(
    '/logout',
    authenticate,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader?.split(' ')[1] || '';
            
            const result = await authService.logout(token);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== Password Reset ====================

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: |
 *       Initiates the password reset flow.
 *       A reset code will be sent to the email if the account exists.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset code sent (if email exists)
 */
router.post(
    '/forgot-password',
    validate({ body: forgotPasswordBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.forgotPassword(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password with code
 *     description: Completes the password reset using the code sent via email.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired code
 */
router.post(
    '/reset-password',
    validate({ body: resetPasswordBodySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.resetPassword(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
