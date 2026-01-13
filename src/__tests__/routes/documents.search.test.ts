import request from 'supertest';
import { app } from '../../app';
import { clearDatabase } from '../helpers/db';
import { createAuthenticatedUser } from '../helpers/auth';
import { DocumentModel } from '../../models/Document';
import mongoose from 'mongoose';

describe('Document Search API', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
        await clearDatabase();
        const auth = await createAuthenticatedUser();
        authToken = auth.token;
        userId = auth.user._id.toString();

        // Create sample documents for testing
        await DocumentModel.create([
            {
                name: 'Project Proposal.pdf',
                originalName: 'Project Proposal.pdf',
                mimeType: 'application/pdf',
                size: 1024000,
                extension: 'pdf',
                storageKey: 'documents/test/2026/01/13/doc1.pdf',
                ownerId: userId,
                tags: ['proposal', 'project'],
                metadata: {},
            },
            {
                name: 'Financial Report Q1.xlsx',
                originalName: 'Financial Report Q1.xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                size: 2048000,
                extension: 'xlsx',
                storageKey: 'documents/test/2026/01/13/doc2.xlsx',
                ownerId: userId,
                tags: ['finance', 'report'],
                metadata: {},
            },
            {
                name: 'Meeting Notes.docx',
                originalName: 'Meeting Notes.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: 512000,
                extension: 'docx',
                storageKey: 'documents/test/2026/01/13/doc3.docx',
                ownerId: userId,
                tags: ['meeting', 'notes'],
                metadata: {},
            },
            {
                name: 'Budget Analysis.pdf',
                originalName: 'Budget Analysis.pdf',
                mimeType: 'application/pdf',
                size: 1536000,
                extension: 'pdf',
                storageKey: 'documents/test/2026/01/13/doc4.pdf',
                ownerId: userId,
                tags: ['finance', 'budget'],
                metadata: {},
            },
        ]);
    });

    describe('GET /api/v1/documents/search', () => {
        it('should search documents by query text', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ query: 'report' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(1);
            expect(response.body.data.documents[0].name).toContain('Report');
            expect(response.body.data.searchMeta).toBeDefined();
            expect(response.body.data.searchMeta.query).toBe('report');
            expect(response.body.data.searchMeta.resultsFound).toBe(1);
        });

        it('should search across name, tags, and extension with single query param', async () => {
            // Search for 'pdf' should match extension
            let response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ query: 'pdf' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(2); // 2 PDFs
            expect(response.body.data.documents.every((doc: any) => doc.extension === 'pdf')).toBe(true);

            // Search for 'xlsx' should match extension
            response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ query: 'xlsx' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(1);
            expect(response.body.data.documents[0].extension).toBe('xlsx');

            // Search for 'finance' should match tags
            response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ query: 'finance' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents.length).toBeGreaterThan(0);
            expect(response.body.data.documents.some((doc: any) => doc.tags.includes('finance'))).toBe(true);
        });

        it('should search documents by name', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ name: 'proposal' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(1);
            expect(response.body.data.documents[0].name).toBe('Project Proposal.pdf');
        });

        it('should filter by tags', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ tags: 'finance,report' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents.length).toBeGreaterThan(0);
            // Should find documents with finance OR report tag
        });

        it('should filter by extension', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ extension: 'pdf' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(2);
            response.body.data.documents.forEach((doc: any) => {
                expect(doc.extension).toBe('pdf');
            });
        });

        it('should filter by mime type', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ mimeType: 'application/pdf' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(2);
        });

        it('should filter by size range', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ minSize: '1000000', maxSize: '2000000' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(2); // 2 PDFs in range: 1024000 and 1536000
            response.body.data.documents.forEach((doc: any) => {
                expect(doc.size).toBeGreaterThanOrEqual(1000000);
                expect(doc.size).toBeLessThanOrEqual(2000000);
            });
        });

        it('should filter by date range', async () => {
            const dateFrom = new Date('2026-01-01').toISOString();
            const dateTo = new Date('2026-12-31').toISOString();

            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ dateFrom, dateTo })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(4);
        });

        it('should combine multiple filters', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    extension: 'pdf',
                    tags: 'finance',
                    minSize: '1000000',
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(1);
            expect(response.body.data.documents[0].name).toBe('Budget Analysis.pdf');
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ page: '1', limit: '2' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(2);
            expect(response.body.data.pagination.page).toBe(1);
            expect(response.body.data.pagination.limit).toBe(2);
            expect(response.body.data.pagination.total).toBe(4);
            expect(response.body.data.pagination.totalPages).toBe(2);
        });

        it('should support sorting', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ sortBy: 'size', sortOrder: 'asc' })
                .expect(200);

            expect(response.body.success).toBe(true);
            const sizes = response.body.data.documents.map((d: any) => d.size);
            expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
        });

        it('should return empty results for non-matching search', async () => {
            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ query: 'nonexistent' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.documents).toHaveLength(0);
            expect(response.body.data.searchMeta.resultsFound).toBe(0);
        });

        it('should require authentication', async () => {
            await request(app)
                .get('/api/v1/documents/search')
                .query({ query: 'test' })
                .expect(401);
        });

        it('should only return documents owned by the user', async () => {
            // Create another user's document
            const otherUserId = new mongoose.Types.ObjectId().toString();
            await DocumentModel.create({
                name: 'Other User Document.pdf',
                originalName: 'Other User Document.pdf',
                mimeType: 'application/pdf',
                size: 1024000,
                extension: 'pdf',
                storageKey: 'documents/other/2026/01/13/doc5.pdf',
                ownerId: otherUserId,
                tags: ['private'],
                metadata: {},
            });

            const response = await request(app)
                .get('/api/v1/documents/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ query: 'document' })
                .expect(200);

            expect(response.body.success).toBe(true);
            // Should not see other user's document
            response.body.data.documents.forEach((doc: any) => {
                expect(doc.ownerId).toBe(userId);
            });
        });
    });
});
