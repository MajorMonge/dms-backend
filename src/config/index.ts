import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  // Project
  projectName: process.env.PROJECT_NAME || 'dms',

  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  productionApiUrl: process.env.PRODUCTION_API_URL || '',

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dms',
    dbName: process.env.MONGODB_DB_NAME || 'dms',
  },

  // AWS General
  aws: {
    region: process.env.AWS_REGION || 'us-east-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpointUrl: process.env.AWS_ENDPOINT_URL,
  },

  // AWS S3
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME || 'dms-documents',
    versioningEnabled: process.env.AWS_S3_VERSIONING_ENABLED === 'true',
  },

  // AWS Cognito
  cognito: {
    userPoolName: process.env.AWS_COGNITO_USER_POOL_NAME || 'user-pool',
    clientName: process.env.AWS_COGNITO_CLIENT_NAME || 'web-client',
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID || '',
    clientId: process.env.AWS_COGNITO_CLIENT_ID || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // File Upload
  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10),
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,jpg,jpeg,png,gif,csv,json,xml').split(','),
  },

  // CORS
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3001').split(',').map((url) => url.trim()),
  },

  // Computed values
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
} as const;

export type Config = typeof config;
