import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { app } from '../../app';
import { apiRequest, withAuth, expectSuccess, expectError } from '../helpers/request';
import { createAuthenticatedUser } from '../helpers/auth';
import { userService } from '../../services/UserService';

// Mock the user service
jest.mock('../../services/UserService');

const mockedUserService = userService as jest.Mocked<typeof userService>;

// Generate valid MongoDB ObjectIds for testing
const USER_ID_1 = new mongoose.Types.ObjectId().toString();
const USER_ID_2 = new mongoose.Types.ObjectId().toString();

describe('User Routes', () => {
    describe('GET /api/v1/users/me', () => {
        it('should get current user profile', async () => {
            const { token, user } = await createAuthenticatedUser();

            const mockProfile = {
                id: user._id.toString(),
                cognitoId: user.cognitoId,
                email: user.email,
                storageUsed: 0,
                storageLimit: 5 * 1024 * 1024 * 1024,
                metadata: {},
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            };

            mockedUserService.getById.mockResolvedValue(mockProfile);

            const response = await apiRequest(app)
                .get('/api/v1/users/me')
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            // Compare with dates serialized as strings (JSON format)
            expect(data).toEqual({
                ...mockProfile,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
            });
            expect(mockedUserService.getById).toHaveBeenCalledWith(user._id.toString());
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .get('/api/v1/users/me')
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('PATCH /api/v1/users/me', () => {
        it('should update user metadata', async () => {
            const { token, user } = await createAuthenticatedUser();

            const mockUpdatedUser = {
                id: user._id.toString(),
                cognitoId: user.cognitoId,
                email: user.email,
                storageUsed: 0,
                storageLimit: 5 * 1024 * 1024 * 1024,
                metadata: {
                    theme: 'dark',
                    language: 'en',
                },
                createdAt: user.createdAt,
                updatedAt: new Date(),
            };

            mockedUserService.update.mockResolvedValue(mockUpdatedUser);

            const response = await apiRequest(app)
                .patch('/api/v1/users/me')
                .set(withAuth(token))
                .send({
                    metadata: {
                        theme: 'dark',
                        language: 'en',
                    },
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.metadata).toEqual({
                theme: 'dark',
                language: 'en',
            });
            expect(mockedUserService.update).toHaveBeenCalledWith(
                user._id.toString(),
                expect.objectContaining({
                    metadata: {
                        theme: 'dark',
                        language: 'en',
                    },
                })
            );
        });

        it('should accept empty metadata update', async () => {
            const { token, user } = await createAuthenticatedUser();

            mockedUserService.update.mockResolvedValue({
                id: user._id.toString(),
                cognitoId: user.cognitoId,
                email: user.email,
                storageUsed: 0,
                storageLimit: 5 * 1024 * 1024 * 1024,
                metadata: {},
                createdAt: user.createdAt,
                updatedAt: new Date(),
            });

            await apiRequest(app)
                .patch('/api/v1/users/me')
                .set(withAuth(token))
                .send({ metadata: {} })
                .expect(StatusCodes.OK);
        });
    });

    describe('GET /api/v1/users/me/storage', () => {
        it('should get user storage information', async () => {
            const { token, user } = await createAuthenticatedUser();

            const mockStorage = {
                used: 1024000,
                limit: 5 * 1024 * 1024 * 1024,
                available: (5 * 1024 * 1024 * 1024) - 1024000,
                usedPercentage: 0.002,
            };

            mockedUserService.getStorageInfo.mockResolvedValue(mockStorage);

            const response = await apiRequest(app)
                .get('/api/v1/users/me/storage')
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockStorage);
            expect(data.used).toBeDefined();
            expect(data.limit).toBeDefined();
            expect(data.available).toBeDefined();
            expect(data.usedPercentage).toBeDefined();
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .get('/api/v1/users/me/storage')
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('GET /api/v1/users/:id (Admin)', () => {
        it('should return unauthorized for non-admin user', async () => {
            const { token } = await createAuthenticatedUser();

            // Non-admin users should get 401 Insufficient permissions
            await apiRequest(app)
                .get(`/api/v1/users/${USER_ID_2}`)
                .set(withAuth(token))
                .expect(StatusCodes.UNAUTHORIZED);
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .get(`/api/v1/users/${USER_ID_2}`)
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('GET /api/v1/users (Admin)', () => {
        it('should return unauthorized for non-admin user', async () => {
            const { token } = await createAuthenticatedUser();

            // Non-admin users should get 401 Insufficient permissions
            await apiRequest(app)
                .get('/api/v1/users')
                .set(withAuth(token))
                .expect(StatusCodes.UNAUTHORIZED);
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .get('/api/v1/users')
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('PATCH /api/v1/users/:id (Admin)', () => {
        it('should return unauthorized for non-admin user', async () => {
            const { token } = await createAuthenticatedUser();

            // Non-admin users should get 401 Insufficient permissions
            await apiRequest(app)
                .patch(`/api/v1/users/${USER_ID_1}`)
                .set(withAuth(token))
                .send({
                    storageLimit: 10 * 1024 * 1024 * 1024,
                })
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('DELETE /api/v1/users/:id (Admin)', () => {
        it('should return unauthorized for non-admin user', async () => {
            const { token } = await createAuthenticatedUser();

            // Non-admin users should get 401 Insufficient permissions
            await apiRequest(app)
                .delete(`/api/v1/users/${USER_ID_1}`)
                .set(withAuth(token))
                .expect(StatusCodes.UNAUTHORIZED);
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .delete(`/api/v1/users/${USER_ID_1}`)
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });
});
