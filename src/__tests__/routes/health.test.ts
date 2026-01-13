import { StatusCodes } from 'http-status-codes';
import { app } from '../../app';
import { apiRequest, expectSuccess } from '../helpers/request';

describe('Health Routes', () => {
    describe('GET /api/v1/health', () => {
        it('should return healthy status', async () => {
            const response = await apiRequest(app)
                .get('/api/v1/health')
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.status).toBe('healthy');
            expect(data.timestamp).toBeDefined();
            expect(data.version).toBeDefined();
            expect(data.environment).toBeDefined();
            expect(data.services).toBeDefined();
        });
    });

    describe('GET /api/v1/health/ready', () => {
        it('should return readiness status', async () => {
            const response = await apiRequest(app)
                .get('/api/v1/health/ready')
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.status).toBe('ready');
            expect(data.timestamp).toBeDefined();
        });
    });

    describe('GET /api/v1/health/live', () => {
        it('should return liveness status', async () => {
            const response = await apiRequest(app)
                .get('/api/v1/health/live')
                .expect(StatusCodes.OK);

            const data = expectSuccess(response);
            expect(data.status).toBe('alive');
            expect(data.timestamp).toBeDefined();
        });
    });
});
