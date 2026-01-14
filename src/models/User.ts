import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IUser {
    cognitoId: string;
    email: string;
    storageUsed: number;
    storageLimit: number;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserDocument extends IUser, MongoDocument {}

const DEFAULT_STORAGE_LIMIT =
    parseInt(process.env.DEFAULT_STORAGE_LIMIT_MB || '100', 10) * 1024 * 1024; // default 100MB

const UserSchema = new Schema<IUserDocument>(
    {
        cognitoId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 255,
        },
        storageUsed: {
            type: Number,
            default: 0,
            min: 0,
        },
        storageLimit: {
            type: Number,
            default: DEFAULT_STORAGE_LIMIT,
            min: 0,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (_doc, ret) => {
                ret.id = ret._id.toString();
                delete (ret as any)._id;
                delete (ret as any).__v;
                return ret;
            },
        },
    }
);

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);
