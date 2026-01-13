import { z } from 'zod';

/**
 * Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        'Password must contain at least one special character'
    );

const emailSchema = z.string().email('Invalid email format').max(255);

/**
 * Schema for user registration
 */
export const registerBodySchema = z.object({
    email: emailSchema,
    password: passwordSchema,
});

/**
 * Schema for user login
 */
export const loginBodySchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

/**
 * Schema for email confirmation
 */
export const confirmEmailBodySchema = z.object({
    email: emailSchema,
    code: z.string().length(6, 'Verification code must be 6 digits'),
});

/**
 * Schema for resending verification code
 */
export const resendCodeBodySchema = z.object({
    email: emailSchema,
});

/**
 * Schema for forgot password request
 */
export const forgotPasswordBodySchema = z.object({
    email: emailSchema,
});

/**
 * Schema for password reset
 */
export const resetPasswordBodySchema = z.object({
    email: emailSchema,
    code: z.string().length(6, 'Reset code must be 6 digits'),
    newPassword: passwordSchema,
});

/**
 * Schema for token refresh
 */
export const refreshTokenBodySchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Exported types
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type ConfirmEmailBody = z.infer<typeof confirmEmailBodySchema>;
export type ResendCodeBody = z.infer<typeof resendCodeBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type RefreshTokenBody = z.infer<typeof refreshTokenBodySchema>;
