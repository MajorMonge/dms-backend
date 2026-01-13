import jwt from 'jsonwebtoken';
import { UserModel } from '../../models/User';
import { AuthenticatedUser } from '../../middleware/auth';

const TEST_JWT_SECRET = 'test-jwt-secret-for-testing';

export interface MockUser {
    _id: string;
    cognitoId: string;
    email: string;
    storageUsed: number;
    storageLimit: number;
}

export const createMockUser = async (overrides?: Partial<MockUser>) => {
    const defaultUser = {
        cognitoId: `cognito-${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        storageUsed: 0,
        storageLimit: 5 * 1024 * 1024 * 1024,
        ...overrides,
    };

    const user = await UserModel.create(defaultUser);
    return user;
};

export const generateAuthToken = (userId: string, email: string): string => {
    return jwt.sign(
        {
            sub: userId,
            id: userId,
            email,
            groups: [],
        },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
    );
};

export const createAuthenticatedUser = async (): Promise<{
    user: any;
    token: string;
    authUser: AuthenticatedUser;
}> => {
    const user = await createMockUser();
    const token = generateAuthToken(user._id.toString(), user.email);

    return {
        user,
        token,
        authUser: {
            id: user._id.toString(),
            cognitoId: user.cognitoId,
            email: user.email,
            groups: [],
        },
    };
};
