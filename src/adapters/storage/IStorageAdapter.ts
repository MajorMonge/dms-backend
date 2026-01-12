/**
 * Storage Adapter Interface
 * Provides an abstraction layer for object storage operations
 */

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface DownloadOptions {
  responseContentType?: string;
  responseContentDisposition?: string;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface ListObjectsOptions {
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListObjectsResult {
  objects: StorageObject[];
  prefixes: string[];
  isTruncated: boolean;
  continuationToken?: string;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds
  contentType?: string;
  contentDisposition?: string;
}

export interface IStorageAdapter {
  /**
   * Upload a file to storage
   */
  upload(key: string, body: Buffer | ReadableStream, options?: UploadOptions): Promise<string>;

  /**
   * Download a file from storage
   */
  download(key: string, options?: DownloadOptions): Promise<Buffer>;

  /**
   * Get a readable stream for a file
   */
  getStream(key: string): Promise<ReadableStream>;

  /**
   * Delete a file from storage
   */
  delete(key: string): Promise<boolean>;

  /**
   * Delete multiple files from storage
   */
  deleteMany(keys: string[]): Promise<number>;

  /**
   * Check if a file exists in storage
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getMetadata(key: string): Promise<StorageObject | null>;

  /**
   * List objects in storage
   */
  listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult>;

  /**
   * Copy a file within storage
   */
  copy(sourceKey: string, destinationKey: string): Promise<boolean>;

  /**
   * Move a file within storage
   */
  move(sourceKey: string, destinationKey: string): Promise<boolean>;

  /**
   * Generate a presigned URL for download
   */
  getPresignedDownloadUrl(key: string, options?: PresignedUrlOptions): Promise<string>;

  /**
   * Generate a presigned URL for upload
   */
  getPresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string>;
}
