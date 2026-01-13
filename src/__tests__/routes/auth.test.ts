import { StatusCodes } from 'http-status-codes';
import { app } from '../../app';
import { apiRequest, withAuth, expectSuccess, expectError } from '../helpers/request';
import { createAuthenticatedUser } from '../helpers/auth';
import { authService } from '../../services/AuthService';
import { UnauthorizedError } from '../../middleware/errorHandler';

// Mock the auth service
jest.mock('../../services/AuthService');

const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('Auth Routes', () => {
    describe('POST /api/v1/auth/register', () => {
        it('should register a new user successfully', async () => {
            const mockResponse = {
                userSub: 'cognito-sub-123',
                email: 'newuser@example.com',
                confirmed: false,
                message: 'Registration successful. Please check your email for verification code.',
            };

            mockedAuthService.register.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'newuser@example.com',
                    password: 'TestP@ss123!',
                })
                .expect(StatusCodes.CREATED);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
            expect(mockedAuthService.register).toHaveBeenCalledWith({
                email: 'newuser@example.com',
                password: 'TestP@ss123!',
            });
        });

        it('should return validation error for invalid email', async () => {
            const response = await apiRequest(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'invalid-email',
                    password: 'TestP@ss123!',
                })
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });

        it('should return validation error for weak password', async () => {
            const response = await apiRequest(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'weak',
                })
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });

        it('should return validation error for missing fields', async () => {
            const response = await apiRequest(app)
                .post('/api/v1/auth/register')
                .send({})
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login successfully with valid credentials', async () => {
            const mockResponse = {
                tokens: {
                    accessToken: 'mock-access-token',
                    idToken: 'mock-id-token',
                    refreshToken: 'mock-refresh-token',
                    expiresIn: 3600,
                },
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    cognitoId: 'cognito-123',
                },
            };

            mockedAuthService.login.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'TestP@ss123!',
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
            expect(mockedAuthService.login).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'TestP@ss123!',
            });
        });

        it('should return validation error for missing credentials', async () => {
            const response = await apiRequest(app)
                .post('/api/v1/auth/login')
                .send({})
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/auth/confirm-email', () => {
        it('should confirm email successfully', async () => {
            const mockResponse = { message: 'Email verified successfully' };
            mockedAuthService.confirmEmail.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/auth/confirm-email')
                .send({
                    email: 'test@example.com',
                    code: '123456',
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
        });

        it('should return validation error for invalid code format', async () => {
            const response = await apiRequest(app)
                .post('/api/v1/auth/confirm-email')
                .send({
                    email: 'test@example.com',
                    code: '123', // Too short
                })
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/auth/resend-code', () => {
        it('should resend verification code successfully', async () => {
            const mockResponse = { message: 'Verification code sent to your email' };
            mockedAuthService.resendVerificationCode.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/auth/resend-code')
                .send({
                    email: 'test@example.com',
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
        });
    });

    describe('POST /api/v1/auth/forgot-password', () => {
        it('should initiate password reset successfully', async () => {
            const mockResponse = { message: 'Password reset code sent to your email' };
            mockedAuthService.forgotPassword.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'test@example.com',
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
        });
    });

    describe('POST /api/v1/auth/reset-password', () => {
        it('should reset password successfully', async () => {
            const mockResponse = { message: 'Password reset successfully' };
            mockedAuthService.resetPassword.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    email: 'test@example.com',
                    code: '123456',
                    newPassword: 'NewP@ss123!',
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
        });

        it('should return validation error for weak new password', async () => {
            const response = await apiRequest(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    email: 'test@example.com',
                    code: '123456',
                    newPassword: 'weak',
                })
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        it('should logout authenticated user successfully', async () => {
            const { token } = await createAuthenticatedUser();
            const mockResponse = { message: 'Logged out successfully' };
            mockedAuthService.logout.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/auth/logout')
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .post('/api/v1/auth/logout')
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('POST /api/v1/auth/refresh', () => {
        it('should refresh tokens successfully with valid refresh token', async () => {
            const mockResponse = {
                accessToken: 'new-access-token',
                idToken: 'new-id-token',
                refreshToken: 'same-refresh-token',
                expiresIn: 3600,
            };

            mockedAuthService.refreshToken.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/auth/refresh')
                .send({
                    refreshToken: 'valid-refresh-token',
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.tokens).toEqual(mockResponse);
            expect(mockedAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
        });

        it('should return validation error for missing refresh token', async () => {
            const response = await apiRequest(app)
                .post('/api/v1/auth/refresh')
                .send({})
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });

        it('should return validation error for empty refresh token', async () => {
            const response = await apiRequest(app)
                .post('/api/v1/auth/refresh')
                .send({
                    refreshToken: '',
                })
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });

        it('should return unauthorized for invalid refresh token', async () => {
            mockedAuthService.refreshToken.mockRejectedValue(
                new UnauthorizedError('Invalid refresh token', 'AUTH_INVALID_REFRESH_TOKEN')
            );

            const response = await apiRequest(app)
                .post('/api/v1/auth/refresh')
                .send({
                    refreshToken: 'invalid-refresh-token',
                })
                .expect(StatusCodes.UNAUTHORIZED);

            expectError(response);
        });
    });
});
