import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IFolder {
    name: string;
    parentId: mongoose.Types.ObjectId | null;
    ownerId: string;
    path: string;
    depth: number;
    metadata: Record<string, unknown>;
    isDeleted: boolean;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IFolderDocument extends IFolder, MongoDocument {}

const MAX_DEPTH = 50; 

const FolderSchema = new Schema<IFolderDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255,
        },
        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'Folder',
            default: null,
        },
        ownerId: {
            type: String,
            required: true,
            index: true,
        },
        path: {
            type: String,
            required: true,
            index: true,
        },
        depth: {
            type: Number,
            default: 0,
            min: 0,
            max: MAX_DEPTH,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        deletedAt: {
            type: Date,
            default: null,
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

FolderSchema.index({ ownerId: 1, isDeleted: 1 });
FolderSchema.index({ parentId: 1, isDeleted: 1 });
FolderSchema.index({ ownerId: 1, parentId: 1, name: 1 }, { unique: true });
FolderSchema.index({ path: 1, ownerId: 1 });
FolderSchema.index({ name: 'text' });

export const FolderModel = mongoose.model<IFolderDocument>('Folder', FolderSchema);
export const MAX_FOLDER_DEPTH = MAX_DEPTH;
