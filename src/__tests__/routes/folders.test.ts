import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { app } from '../../app';
import { apiRequest, withAuth, expectSuccess, expectError } from '../helpers/request';
import { createAuthenticatedUser } from '../helpers/auth';
import { folderService } from '../../services/FolderService';

jest.mock('../../services/FolderService');

const mockedFolderService = folderService as jest.Mocked<typeof folderService>;

// Generate valid MongoDB ObjectIds for testing
const FOLDER_ID_1 = new mongoose.Types.ObjectId().toString();
const FOLDER_ID_2 = new mongoose.Types.ObjectId().toString();

const createMockFolder = (overrides: Record<string, any> = {}) => ({
    id: FOLDER_ID_1,
    name: 'Documents',
    ownerId: 'user-123',
    parentId: null,
    path: '/Documents',
    depth: 0,
    metadata: {},
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

describe('Folder Routes', () => {
    describe('POST /api/v1/folders', () => {
        it('should create folder successfully', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockFolder = createMockFolder({ ownerId: user._id.toString() });

            mockedFolderService.create.mockResolvedValue(mockFolder);

            const response = await apiRequest(app)
                .post('/api/v1/folders')
                .set(withAuth(token))
                .send({
                    name: 'Documents',
                })
                .expect(StatusCodes.CREATED);

            const data = expectSuccess(response);
            expect(data.name).toBe('Documents');
            expect(mockedFolderService.create).toHaveBeenCalledWith(
                user._id.toString(),
                expect.objectContaining({ name: 'Documents' })
            );
        });

        it('should create nested folder', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockFolder = createMockFolder({
                id: FOLDER_ID_2,
                name: 'Reports',
                ownerId: user._id.toString(),
                parentId: FOLDER_ID_1,
                path: '/Documents/Reports',
                depth: 1,
            });

            mockedFolderService.create.mockResolvedValue(mockFolder);

            const response = await apiRequest(app)
                .post('/api/v1/folders')
                .set(withAuth(token))
                .send({
                    name: 'Reports',
                    parentId: FOLDER_ID_1,
                })
                .expect(StatusCodes.CREATED);

            const data = expectSuccess(response);
            expect(data.parentId).toBe(FOLDER_ID_1);
        });

        it('should return validation error for missing name', async () => {
            const { token } = await createAuthenticatedUser();

            const response = await apiRequest(app)
                .post('/api/v1/folders')
                .set(withAuth(token))
                .send({})
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .post('/api/v1/folders')
                .send({ name: 'Test' })
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('GET /api/v1/folders', () => {
        it('should list all folders for authenticated user', async () => {
            const { token, user } = await createAuthenticatedUser();

            const mockResponse = {
                folders: [createMockFolder({ ownerId: user._id.toString() })],
                pagination: {
                    page: 1,
                    limit: 50,
                    total: 1,
                    totalPages: 1,
                },
            };

            mockedFolderService.list.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .get('/api/v1/folders')
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.folders).toHaveLength(1);
            expect(data.pagination).toBeDefined();
        });

        it('should filter folders by parentId', async () => {
            const { token } = await createAuthenticatedUser();

            mockedFolderService.list.mockResolvedValue({
                folders: [],
                pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
            });

            await apiRequest(app)
                .get(`/api/v1/folders?parentId=${FOLDER_ID_1}`)
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            expect(mockedFolderService.list).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ parentId: FOLDER_ID_1 })
            );
        });
    });

    describe('GET /api/v1/folders/:id', () => {
        it('should get folder by id', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockFolder = createMockFolder({ ownerId: user._id.toString() });

            mockedFolderService.getById.mockResolvedValue(mockFolder);

            const response = await apiRequest(app)
                .get(`/api/v1/folders/${FOLDER_ID_1}`)
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.id).toBe(FOLDER_ID_1);
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .get(`/api/v1/folders/${FOLDER_ID_1}`)
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('PATCH /api/v1/folders/:id', () => {
        it('should update folder name', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockFolder = createMockFolder({
                ownerId: user._id.toString(),
                name: 'Updated Documents',
                path: '/Updated Documents',
            });

            mockedFolderService.update.mockResolvedValue(mockFolder);

            const response = await apiRequest(app)
                .patch(`/api/v1/folders/${FOLDER_ID_1}`)
                .set(withAuth(token))
                .send({ name: 'Updated Documents' })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.name).toBe('Updated Documents');
        });

        it('should return validation error for empty name', async () => {
            const { token } = await createAuthenticatedUser();

            const response = await apiRequest(app)
                .patch(`/api/v1/folders/${FOLDER_ID_1}`)
                .set(withAuth(token))
                .send({ name: '' })
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });
    });

    describe('DELETE /api/v1/folders/:id', () => {
        it('should soft delete folder', async () => {
            const { token } = await createAuthenticatedUser();

            mockedFolderService.softDelete.mockResolvedValue(undefined);

            await apiRequest(app)
                .delete(`/api/v1/folders/${FOLDER_ID_1}`)
                .set(withAuth(token))
                .expect(StatusCodes.NO_CONTENT);

            expect(mockedFolderService.softDelete).toHaveBeenCalled();
        });

        it('should permanently delete folder', async () => {
            const { token } = await createAuthenticatedUser();

            mockedFolderService.permanentDelete.mockResolvedValue({
                foldersDeleted: 1,
                documentsDeleted: 0,
            });

            const response = await apiRequest(app)
                .delete(`/api/v1/folders/${FOLDER_ID_1}/permanent`)
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.foldersDeleted).toBe(1);
            expect(mockedFolderService.permanentDelete).toHaveBeenCalled();
        });
    });

    describe('POST /api/v1/folders/:id/move', () => {
        it('should move folder to new parent', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockFolder = createMockFolder({
                id: FOLDER_ID_2,
                name: 'Reports',
                ownerId: user._id.toString(),
                parentId: FOLDER_ID_1,
                path: '/Documents/Reports',
                depth: 1,
            });

            mockedFolderService.move.mockResolvedValue(mockFolder);

            const response = await apiRequest(app)
                .post(`/api/v1/folders/${FOLDER_ID_2}/move`)
                .set(withAuth(token))
                .send({ parentId: FOLDER_ID_1 })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.parentId).toBe(FOLDER_ID_1);
        });

        it('should move folder to root when parentId is null', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockFolder = createMockFolder({
                id: FOLDER_ID_2,
                name: 'Reports',
                ownerId: user._id.toString(),
                parentId: null,
                path: '/Reports',
                depth: 0,
            });

            mockedFolderService.move.mockResolvedValue(mockFolder);

            const response = await apiRequest(app)
                .post(`/api/v1/folders/${FOLDER_ID_2}/move`)
                .set(withAuth(token))
                .send({ parentId: null })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.parentId).toBeNull();
        });
    });
});
