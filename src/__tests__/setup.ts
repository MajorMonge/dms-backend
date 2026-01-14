// Mock config BEFORE any imports that use it
jest.mock('../config/index', () => {
    const originalModule = jest.requireActual('../config/index');
    return {
        __esModule: true,
        ...originalModule,
        config: {
            ...originalModule.config,
            cognito: {
                ...originalModule.config.cognito,
                userPoolId: '', // Disable Cognito verification, use local JWT
            },
            jwt: {
                ...originalModule.config.jwt,
                secret: 'test-jwt-secret-for-testing',
            },
        },
    };
});

import { connectDatabase, disconnectDatabase, clearDatabase } from './helpers/db.js';

beforeAll(async () => {
    await connectDatabase();
});

afterEach(async () => {
    await clearDatabase();
});

afterAll(async () => {
    await disconnectDatabase();
});

// Suppress console output during tests
global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};
