import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import {
  IStorageAdapter,
  UploadOptions,
  DownloadOptions,
  StorageObject,
  ListObjectsOptions,
  ListObjectsResult,
  PresignedUrlOptions,
} from './IStorageAdapter.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

const EXPIRES_IN_DEFAULT = 3600; // 1 hour

/**
 * AWS S3 implementation of the Storage Adapter
 */
export class S3StorageAdapter implements IStorageAdapter {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || config.s3.bucketName;

    this.client = new S3Client({
      region: config.aws.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey
        ? {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
          }
        : undefined,
    });
  }

  async upload(key: string, body: Buffer | ReadableStream, options?: UploadOptions): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body instanceof Buffer ? body : Readable.fromWeb(body as any),
      ContentType: options?.contentType,
      Metadata: options?.metadata,
      ACL: options?.acl,
    });

    await this.client.send(command);
    logger.debug(`File uploaded to S3: ${key}`);
    return key;
  }

  async download(key: string, _options?: DownloadOptions): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`Empty response body for key: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as Readable;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async getStream(key: string): Promise<ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`Empty response body for key: ${key}`);
    }

    return response.Body.transformToWebStream();
  }

  async delete(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      logger.debug(`File deleted from S3: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete file from S3: ${key}`, error);
      return false;
    }
  }

  async deleteMany(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    const command = new DeleteObjectsCommand({
      Bucket: this.bucketName,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });

    const response = await this.client.send(command);
    const deletedCount = response.Deleted?.length || 0;
    logger.debug(`Deleted ${deletedCount} files from S3`);
    return deletedCount;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getMetadata(key: string): Promise<StorageObject | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        etag: response.ETag,
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async listObjects(options?: ListObjectsOptions): Promise<ListObjectsResult> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: options?.prefix,
      Delimiter: options?.delimiter,
      MaxKeys: options?.maxKeys || 1000,
      ContinuationToken: options?.continuationToken,
    });

    const response = await this.client.send(command);

    return {
      objects: (response.Contents || []).map((obj) => ({
        key: obj.Key || '',
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        etag: obj.ETag,
      })),
      prefixes: (response.CommonPrefixes || []).map((p) => p.Prefix || ''),
      isTruncated: response.IsTruncated || false,
      continuationToken: response.NextContinuationToken,
    };
  }

  async copy(sourceKey: string, destinationKey: string): Promise<boolean> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.client.send(command);
      logger.debug(`File copied in S3: ${sourceKey} -> ${destinationKey}`);
      return true;
    } catch (error) {
      logger.error(`Failed to copy file in S3: ${sourceKey} -> ${destinationKey}`, error);
      return false;
    }
  }

  async move(sourceKey: string, destinationKey: string): Promise<boolean> {
    const copied = await this.copy(sourceKey, destinationKey);
    if (!copied) return false;

    const deleted = await this.delete(sourceKey);
    if (!deleted) {
      await this.delete(destinationKey);
      return false;
    }

    logger.debug(`File moved in S3: ${sourceKey} -> ${destinationKey}`);
    return true;
  }

  async getPresignedDownloadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentType: options?.contentType,
      ResponseContentDisposition: options?.contentDisposition,
    });

    return await getSignedUrl(this.client, command, {
      expiresIn: options?.expiresIn || EXPIRES_IN_DEFAULT,
    });
  }

  async getPresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: options?.contentType,
    });

    return await getSignedUrl(this.client, command, {
      expiresIn: options?.expiresIn || EXPIRES_IN_DEFAULT,
    });
  }
}
