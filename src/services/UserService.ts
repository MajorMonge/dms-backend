import { UserModel, IUserDocument } from '../models/User';
import { logger } from '../config/logger';
import {
    NotFoundError,
    ValidationError,
} from '../middleware/errorHandler';
import {
    CreateUserFromCognitoDTO,
    UpdateUserDTO,
    UpdateUserAdminDTO,
    UserResponse,
    UserListQuery,
    UserListResponse,
    UserStorageInfo,
} from '../types/user';

export class UserService {
    /**
     * Transform user document to response format
     */
    private toResponse(user: IUserDocument): UserResponse {
        return {
            id: user._id.toString(),
            cognitoId: user.cognitoId,
            email: user.email,
            storageUsed: user.storageUsed,
            storageLimit: user.storageLimit,
            metadata: user.metadata,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    /**
     * Find or create user from Cognito data
     * Called after Cognito authentication to ensure local user record exists
     */
    async findOrCreateFromCognito(cognitoData: CreateUserFromCognitoDTO): Promise<UserResponse> {
        // Try to find by Cognito ID first
        let user = await UserModel.findOne({ cognitoId: cognitoData.cognitoId });

        if (!user) {
            // Check if email exists (migration case)
            const existingUser = await UserModel.findOne({ email: cognitoData.email.toLowerCase() });
            
            if (existingUser) {
                // Link existing user to Cognito
                existingUser.cognitoId = cognitoData.cognitoId;
                await existingUser.save();
                user = existingUser;
                logger.info(`Linked existing user to Cognito: ${user._id}`);
            } else {
                // Create new user
                user = await UserModel.create({
                    cognitoId: cognitoData.cognitoId,
                    email: cognitoData.email.toLowerCase(),
                });
                logger.info(`Created user from Cognito: ${user._id}`);
            }
        }

        return this.toResponse(user);
    }

    /**
     * Get user by ID
     */
    async getById(id: string): Promise<UserResponse> {
        const user = await UserModel.findById(id);

        if (!user) {
            throw new NotFoundError('User');
        }

        return this.toResponse(user);
    }

    /**
     * Get user by Cognito ID
     */
    async getByCognitoId(cognitoId: string): Promise<UserResponse | null> {
        const user = await UserModel.findOne({ cognitoId });
        return user ? this.toResponse(user) : null;
    }

    /**
     * Get user by email
     */
    async getByEmail(email: string): Promise<UserResponse | null> {
        const user = await UserModel.findOne({ email: email.toLowerCase() });
        return user ? this.toResponse(user) : null;
    }

    /**
     * Update user metadata
     */
    async update(userId: string, data: UpdateUserDTO): Promise<UserResponse> {
        const updateData: Record<string, unknown> = {};

        if (data.metadata !== undefined) {
            updateData.metadata = data.metadata;
        }

        const user = await UserModel.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        );

        if (!user) {
            throw new NotFoundError('User');
        }

        logger.info(`User updated: ${userId}`);

        return this.toResponse(user);
    }

    /**
     * List users (admin)
     */
    async list(query: UserListQuery): Promise<UserListResponse> {
        const {
            search,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = query;

        const filter: Record<string, unknown> = {};

        if (search) {
            filter.$or = [
                { email: { $regex: search, $options: 'i' } },
                { cognitoId: { $regex: search, $options: 'i' } },
            ];
        }

        const total = await UserModel.countDocuments(filter);

        const users = await UserModel.find(filter)
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return {
            users: users.map((u) => this.toResponse(u)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Update user (admin)
     */
    async adminUpdate(userId: string, data: UpdateUserAdminDTO): Promise<UserResponse> {
        const updateData: Record<string, unknown> = {};

        if (data.metadata !== undefined) {
            updateData.metadata = data.metadata;
        }

        if (data.storageLimit !== undefined) {
            updateData.storageLimit = data.storageLimit;
        }

        const user = await UserModel.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        );

        if (!user) {
            throw new NotFoundError('User');
        }

        logger.info(`User updated by admin: ${userId}`);

        return this.toResponse(user);
    }

    /**
     * Delete user (admin)
     */
    async delete(userId: string): Promise<void> {
        const user = await UserModel.findByIdAndDelete(userId);

        if (!user) {
            throw new NotFoundError('User');
        }

        logger.info(`User deleted: ${userId}`);
    }

    /**
     * Get storage info for user
     */
    async getStorageInfo(userId: string): Promise<UserStorageInfo> {
        const user = await UserModel.findById(userId);

        if (!user) {
            throw new NotFoundError('User');
        }

        const available = Math.max(0, user.storageLimit - user.storageUsed);
        const usedPercentage =
            user.storageLimit > 0
                ? Math.round((user.storageUsed / user.storageLimit) * 100)
                : 0;

        return {
            used: user.storageUsed,
            limit: user.storageLimit,
            available,
            usedPercentage,
        };
    }

    /**
     * Update storage used for user
     */
    async updateStorageUsed(userId: string, bytesChange: number): Promise<void> {
        const user = await UserModel.findById(userId);

        if (!user) {
            throw new NotFoundError('User');
        }

        const newStorageUsed = Math.max(0, user.storageUsed + bytesChange);

        if (bytesChange > 0 && newStorageUsed > user.storageLimit) {
            throw new ValidationError('Storage limit exceeded');
        }

        await UserModel.findByIdAndUpdate(userId, {
            $set: { storageUsed: newStorageUsed },
        });

        logger.debug(`Storage updated for user ${userId}: ${bytesChange} bytes`);
    }

    /**
     * Check if user has enough storage
     */
    async hasStorageAvailable(userId: string, bytesNeeded: number): Promise<boolean> {
        const user = await UserModel.findById(userId);

        if (!user) {
            throw new NotFoundError('User');
        }

        return user.storageUsed + bytesNeeded <= user.storageLimit;
    }
}

// Export singleton instance
export const userService = new UserService();
