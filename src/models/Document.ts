import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IDocument {
    name: string;
    originalName: string;
    mimeType: string;
    size: number;
    extension: string;
    storageKey: string;
    folderId?: mongoose.Types.ObjectId | null;
    ownerId: string;
    tags: string[];
    metadata: Record<string, unknown>;
    version: number;
    isDeleted: boolean;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IDocumentDocument extends IDocument, MongoDocument { }

const DocumentSchema = new Schema<IDocumentDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255,
        },
        originalName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255,
        },
        mimeType: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            required: true,
            min: 0,
        },
        extension: {
            type: String,
            required: true,
            lowercase: true,
        },
        storageKey: {
            type: String,
            required: true,
            unique: true,
        },
        folderId: {
            type: Schema.Types.ObjectId,
            ref: 'Folder',
            default: null,
        },
        ownerId: {
            type: String,
            required: true,
            index: true,
        },
        tags: {
            type: [String],
            default: [],
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
        version: {
            type: Number,
            default: 1,
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

DocumentSchema.index({ ownerId: 1, isDeleted: 1 });
DocumentSchema.index({ folderId: 1, isDeleted: 1 });
DocumentSchema.index({ name: 'text', tags: 'text' });
DocumentSchema.index({ createdAt: -1 });

DocumentSchema.virtual('downloadUrl').get(function () {
    return undefined; 
});

export const DocumentModel = mongoose.model<IDocumentDocument>('Document', DocumentSchema);
