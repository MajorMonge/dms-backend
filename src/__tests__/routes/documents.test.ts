import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { app } from '../../app';
import { apiRequest, withAuth, expectSuccess, expectError } from '../helpers/request';
import { createAuthenticatedUser } from '../helpers/auth';
import { documentService } from '../../services/DocumentService';

jest.mock('../../services/DocumentService');

const mockedDocumentService = documentService as jest.Mocked<typeof documentService>;

// Generate valid MongoDB ObjectIds for testing
const DOC_ID_1 = new mongoose.Types.ObjectId().toString();
const DOC_ID_2 = new mongoose.Types.ObjectId().toString();
const FOLDER_ID_1 = new mongoose.Types.ObjectId().toString();

const createMockDocument = (overrides: Record<string, any> = {}) => ({
    id: DOC_ID_1,
    name: 'test.pdf',
    originalName: 'test.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    extension: 'pdf',
    storageKey: 'documents/user-123/2026/01/12/uuid.pdf',
    ownerId: 'user-123',
    folderId: null,
    tags: [],
    metadata: {},
    version: 1,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

describe('Document Routes', () => {
    describe('GET /api/v1/documents', () => {
        it('should list documents for authenticated user', async () => {
            const { token, user } = await createAuthenticatedUser();

            const mockResponse = {
                documents: [createMockDocument({ ownerId: user._id.toString() })],
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 1,
                    totalPages: 1,
                },
            };

            mockedDocumentService.list.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .get('/api/v1/documents')
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.documents).toHaveLength(1);
            expect(data.pagination).toBeDefined();
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .get('/api/v1/documents')
                .expect(StatusCodes.UNAUTHORIZED);
        });

        it('should filter documents by folderId', async () => {
            const { token } = await createAuthenticatedUser();
            mockedDocumentService.list.mockResolvedValue({
                documents: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
            });

            await apiRequest(app)
                .get(`/api/v1/documents?folderId=${FOLDER_ID_1}`)
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            expect(mockedDocumentService.list).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ folderId: FOLDER_ID_1 })
            );
        });

        it('should search documents by name', async () => {
            const { token } = await createAuthenticatedUser();
            mockedDocumentService.list.mockResolvedValue({
                documents: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
            });

            await apiRequest(app)
                .get('/api/v1/documents?search=test')
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            expect(mockedDocumentService.list).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ search: 'test' })
            );
        });
    });

    describe('GET /api/v1/documents/:id', () => {
        it('should get document by id', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockDocument = createMockDocument({ ownerId: user._id.toString() });

            mockedDocumentService.getById.mockResolvedValue(mockDocument);

            const response = await apiRequest(app)
                .get(`/api/v1/documents/${DOC_ID_1}`)
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.id).toBe(DOC_ID_1);
        });

        it('should return unauthorized without token', async () => {
            await apiRequest(app)
                .get(`/api/v1/documents/${DOC_ID_1}`)
                .expect(StatusCodes.UNAUTHORIZED);
        });
    });

    describe('POST /api/v1/documents/upload/presigned', () => {
        it('should generate presigned upload URL', async () => {
            const { token, user } = await createAuthenticatedUser();

            const mockResponse = {
                uploadUrl: 'https://s3.amazonaws.com/presigned-url',
                key: 'documents/user-123/file.pdf',
                expiresIn: 900,
            };

            mockedDocumentService.getPresignedUploadUrl.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .post('/api/v1/documents/upload/presigned')
                .set(withAuth(token))
                .send({
                    fileName: 'test.pdf',
                    mimeType: 'application/pdf',
                    size: 1024000,
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
            expect(mockedDocumentService.getPresignedUploadUrl).toHaveBeenCalledWith(
                user._id.toString(),
                'test.pdf',
                'application/pdf',
                1024000
            );
        });

        it('should return validation error for missing fields', async () => {
            const { token } = await createAuthenticatedUser();

            const response = await apiRequest(app)
                .post('/api/v1/documents/upload/presigned')
                .set(withAuth(token))
                .send({})
                .expect(StatusCodes.BAD_REQUEST);

            expectError(response, 'VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/documents/upload/confirm', () => {
        it('should confirm upload and create document', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockDocument = createMockDocument({ ownerId: user._id.toString() });

            mockedDocumentService.confirmUpload.mockResolvedValue(mockDocument);

            const response = await apiRequest(app)
                .post('/api/v1/documents/upload/confirm')
                .set(withAuth(token))
                .send({
                    key: 'documents/user-123/file.pdf',
                    name: 'test.pdf',
                    tags: ['important'],
                })
                .expect(StatusCodes.CREATED);

            const data = expectSuccess(response);
            expect(data.id).toBe(DOC_ID_1);
        });
    });

    describe('PATCH /api/v1/documents/:id', () => {
        it('should update document metadata', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockDocument = createMockDocument({
                ownerId: user._id.toString(),
                name: 'updated.pdf',
                tags: ['updated'],
            });

            mockedDocumentService.update.mockResolvedValue(mockDocument);

            const response = await apiRequest(app)
                .patch(`/api/v1/documents/${DOC_ID_1}`)
                .set(withAuth(token))
                .send({
                    name: 'updated.pdf',
                    tags: ['updated'],
                })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.name).toBe('updated.pdf');
        });
    });

    describe('DELETE /api/v1/documents/:id', () => {
        it('should soft delete document', async () => {
            const { token } = await createAuthenticatedUser();

            mockedDocumentService.softDelete.mockResolvedValue(undefined);

            await apiRequest(app)
                .delete(`/api/v1/documents/${DOC_ID_1}`)
                .set(withAuth(token))
                .expect(StatusCodes.NO_CONTENT);

            expect(mockedDocumentService.softDelete).toHaveBeenCalled();
        });

        it('should permanently delete document when permanent=true', async () => {
            const { token } = await createAuthenticatedUser();

            mockedDocumentService.permanentDelete.mockResolvedValue(undefined);

            await apiRequest(app)
                .delete(`/api/v1/documents/${DOC_ID_1}?permanent=true`)
                .set(withAuth(token))
                .expect(StatusCodes.NO_CONTENT);

            expect(mockedDocumentService.permanentDelete).toHaveBeenCalled();
        });
    });

    describe('GET /api/v1/documents/:id/download', () => {
        it('should generate download URL', async () => {
            const { token } = await createAuthenticatedUser();

            const mockResponse = {
                downloadUrl: 'https://s3.amazonaws.com/download-url',
                expiresIn: 900,
            };

            mockedDocumentService.getDownloadUrl.mockResolvedValue(mockResponse);

            const response = await apiRequest(app)
                .get(`/api/v1/documents/${DOC_ID_1}/download`)
                .set(withAuth(token))
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data).toEqual(mockResponse);
        });
    });

    describe('POST /api/v1/documents/:id/move', () => {
        it('should move document to folder', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockDocument = createMockDocument({
                ownerId: user._id.toString(),
                folderId: FOLDER_ID_1,
            });

            mockedDocumentService.move.mockResolvedValue(mockDocument);

            const response = await apiRequest(app)
                .post(`/api/v1/documents/${DOC_ID_1}/move`)
                .set(withAuth(token))
                .send({ folderId: FOLDER_ID_1 })
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.folderId).toBe(FOLDER_ID_1);
        });
    });

    describe('POST /api/v1/documents/:id/copy', () => {
        it('should copy document', async () => {
            const { token, user } = await createAuthenticatedUser();
            const mockDocument = createMockDocument({
                id: DOC_ID_2,
                ownerId: user._id.toString(),
                name: 'test (copy).pdf',
            });

            mockedDocumentService.copy.mockResolvedValue(mockDocument);

            const response = await apiRequest(app)
                .post(`/api/v1/documents/${DOC_ID_1}/copy`)
                .set(withAuth(token))
                .send({ name: 'test (copy).pdf' })
                .expect(StatusCodes.CREATED);

            const data = expectSuccess(response);
            expect(data.id).toBe(DOC_ID_2);
        });
    });
});
