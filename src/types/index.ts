// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
}

// Document Types
export interface DocumentMetadata {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  folderId?: string | null;
  userId: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderMetadata {
  id: string;
  name: string;
  parentId?: string | null;
  userId: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

// Processing Types
export type ProcessingJobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ProcessingJobType = 'ocr' | 'pdf-split' | 'thumbnail' | 'compress';

export interface ProcessingJob {
  id: string;
  documentId: string;
  userId: string;
  type: ProcessingJobType;
  status: ProcessingJobStatus;
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// User Types
export interface UserMetadata {
  id: string;
  cognitoId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  storageUsed: number;
  storageLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

// Upload Types
export interface UploadRequest {
  fileName: string;
  contentType: string;
  size: number;
  folderId?: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

// Query Types
export interface ListDocumentsQuery {
  folderId?: string;
  search?: string;
  mimeType?: string;
  tags?: string[];
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'size';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ListFoldersQuery {
  parentId?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
