import { IUser } from '../models/User';

/**
 * DTO for creating a user from Cognito
 */
export interface CreateUserFromCognitoDTO {
    cognitoId: string;
    email: string;
}

/**
 * DTO for updating user metadata (self)
 */
export interface UpdateUserDTO {
    metadata?: Record<string, unknown>;
}

/**
 * DTO for admin updates (includes storage limit)
 */
export interface UpdateUserAdminDTO extends UpdateUserDTO {
    storageLimit?: number;
}

/**
 * User response format
 */
export interface UserResponse extends IUser {
    id: string;
}

/**
 * Query params for listing users (admin)
 */
export interface UserListQuery {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'email' | 'createdAt' | 'storageUsed';
    sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated user list response
 */
export interface UserListResponse {
    users: UserResponse[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/**
 * User storage information
 */
export interface UserStorageInfo {
    used: number;
    limit: number;
    available: number;
    usedPercentage: number;
}

/**
 * Cognito token payload (decoded from JWT)
 */
export interface CognitoTokenPayload {
    sub: string;           // Cognito user ID
    email: string;
    'cognito:groups'?: string[];  // Cognito groups (for roles)
    iat: number;
    exp: number;
}
