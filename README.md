# Document Management System - Backend

A cloud-based Document Management System backend built with Node.js, TypeScript, Express, and MongoDB.

## Features

- **Document Management**: Full CRUD operations with presigned uploads, soft delete, trash, and restore
- **Folder Management**: Hierarchical folder structure with path tracking and folder trees
- **PDF Processing**: Split PDFs by pages, ranges, or chunks with background worker pool
- **Authentication**: JWT-based auth with AWS Cognito (register, login, email verification, password reset)
- **User Management**: User profiles with storage tracking and admin controls
- **Secure Storage**: AWS S3 with presigned URLs for uploads and downloads
- **Metadata Management**: MongoDB for document/folder metadata
- **Adapter Pattern**: Abstracted database and storage layers
- **API Documentation**: Swagger/OpenAPI documentation
- **Docker Support**: Containerized development environment
- **Infrastructure as Code**: Terraform for AWS S3 and Cognito

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **Framework**: Express 4.x
- **Database**: MongoDB 7.x (via Mongoose)
- **Storage**: AWS S3
- **Authentication**: AWS Cognito
- **PDF Processing**: pdf-lib
- **Documentation**: Swagger/OpenAPI 3.0
- **Validation**: Zod
- **Logging**: Winston
- **Infrastructure**: Terraform

## Project Structure

```
src/
├── adapters/           # Database and storage adapters
│   ├── database/       # MongoDB adapter implementation
│   └── storage/        # S3 storage adapter implementation
├── config/             # Configuration files
│   ├── index.ts        # Main configuration
│   ├── logger.ts       # Winston logger setup
│   └── swagger.ts      # Swagger documentation
├── middleware/         # Express middleware
│   ├── auth.ts         # Authentication middleware (Cognito JWT)
│   ├── errorHandler.ts # Global error handling
│   ├── validate.ts     # Zod request validation
│   ├── httpLogger.ts   # HTTP request logging
│   └── notFoundHandler.ts # 404 handling
├── models/             # Mongoose models
│   ├── Document.ts     # Document metadata model
│   ├── Folder.ts       # Folder hierarchy model
│   └── User.ts         # User profile model
├── routes/v1/          # API routes
│   ├── auth.ts         # Authentication endpoints
│   ├── documents.ts    # Document management endpoints
│   ├── folders.ts      # Folder management endpoints
│   ├── users.ts        # User profile endpoints
│   ├── pdf.ts          # PDF processing endpoints
│   └── health.ts       # Health check endpoints
├── services/           # Business logic
│   ├── AuthService.ts      # Cognito authentication
│   ├── DocumentService.ts  # Document operations
│   ├── FolderService.ts    # Folder operations
│   ├── UserService.ts      # User management
│   └── PdfService.ts       # PDF processing
├── workers/            # Background workers
│   ├── pdfWorker.ts        # PDF split worker
│   └── PdfWorkerPool.ts    # Worker pool manager
├── validation/         # Zod schemas
├── types/              # TypeScript type definitions
├── app.ts              # Express application setup
└── server.ts           # Server entry point

terraform/              # Infrastructure as Code (S3 & Cognito only)
├── main.tf             # Main Terraform configuration
├── s3.tf               # S3 bucket configuration
├── cognito.tf          # Cognito user pool setup
├── variables.tf        # Input variables
└── outputs.tf          # Output values
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- AWS CLI (optional, for deployment)
- Terraform 1.5+ (optional, for infrastructure)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Environment Variables

Variables marked with `[TERRAFORM]` are shared between the application and Terraform infrastructure.

| Variable | Description | Terraform |
|----------|-------------|-----------|
| `PROJECT_NAME` | Project name for resource naming | ✅ |
| `NODE_ENV` | Environment (development/staging/production) | ✅ |
| `PORT` | Server port | |
| `API_VERSION` | API version prefix | |
| `MONGODB_URI` | MongoDB connection string | |
| `MONGODB_DB_NAME` | MongoDB database name | |
| `AWS_REGION` | AWS region | ✅ |
| `AWS_ACCESS_KEY_ID` | AWS access key | |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | ✅ |
| `AWS_S3_VERSIONING_ENABLED` | Enable S3 versioning | ✅ |
| `AWS_COGNITO_USER_POOL_NAME` | Cognito user pool name | ✅ |
| `AWS_COGNITO_CLIENT_NAME` | Cognito app client name | ✅ |
| `AWS_COGNITO_USER_POOL_ID` | Cognito user pool ID (after terraform apply) | |
| `AWS_COGNITO_CLIENT_ID` | Cognito client ID (after terraform apply) | |
| `JWT_SECRET` | JWT secret for local dev | |
| `JWT_EXPIRES_IN` | JWT expiration time | |
| `LOG_LEVEL` | Logging level | |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | |
| `MAX_FILE_SIZE_MB` | Max file upload size | |
| `ALLOWED_FILE_TYPES` | Allowed file extensions | |
| `CORS_ORIGIN` | CORS origin URL | ✅ |

3. **Start services with Docker:**
   ```bash
   # Start MongoDB only
   docker-compose up -d mongo

   # Start with dev tools (MongoDB Express, LocalStack)
   docker-compose --profile dev up -d
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Access the API:**
   - API: http://localhost:3000
   - Swagger Docs: http://localhost:3000/api-docs
   - MongoDB Express: http://localhost:8081 (with dev profile)

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## LocalStack (Local AWS Development)

LocalStack provides a local AWS environment for development and testing. In the free tier, only **S3** is available. Cognito requires LocalStack Pro.

### Starting LocalStack

```bash
# Start LocalStack with dev profile
docker-compose --profile dev up -d localstack
```

### What Gets Created Automatically

When LocalStack starts, the init script creates:

- **S3 Bucket**: `dms-documents-local` with versioning and CORS enabled

### Using AWS CLI with LocalStack

```bash
# List S3 buckets
aws --endpoint-url=http://localhost:4566 s3 ls

# List objects in bucket
aws --endpoint-url=http://localhost:4566 s3 ls s3://dms-documents-local

# Upload a file
aws --endpoint-url=http://localhost:4566 s3 cp myfile.pdf s3://dms-documents-local/

# Check LocalStack health
curl http://localhost:4566/_localstack/health
```

### Environment Variables for LocalStack

Add these to your `.env` for local development with LocalStack:

```env
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_DEFAULT_REGION=us-east-2
AWS_S3_BUCKET_NAME=dms-documents-local
```

### Cognito Alternatives

Since Cognito is a LocalStack Pro feature, you have two options for authentication in local development:

1. **Use Real AWS Cognito**: Set up Cognito using Terraform (see [Infrastructure Deployment](#infrastructure-deployment)) and configure your `.env` with real AWS credentials:
   ```env
   AWS_ACCESS_KEY_ID=your-real-key
   AWS_SECRET_ACCESS_KEY=your-real-secret
   AWS_COGNITO_USER_POOL_ID=us-east-2_xxxxx
   AWS_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxx
   ```

2. **Use LocalStack Pro**: If you have a LocalStack Pro license:
   ```bash
   LOCALSTACK_API_KEY=your-key docker-compose --profile dev up -d localstack
   ```

## Running Tests

The project uses Jest for testing with a dedicated test setup.

### Prerequisites

Make sure MongoDB is running before running tests:

```bash
docker-compose up -d mongo
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- src/__tests__/routes/health.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="health"
```

### Test Structure

```
src/__tests__/
├── setup.ts              # Global test setup (DB connection, cleanup)
├── helpers/
│   ├── auth.ts           # Authentication test helpers
│   ├── db.ts             # Database test utilities
│   └── request.ts        # HTTP request helpers
└── routes/
    ├── auth.test.ts      # Authentication endpoint tests
    ├── documents.test.ts # Document management tests
    ├── folders.test.ts   # Folder management tests
    ├── health.test.ts    # Health check tests
    └── users.test.ts     # User management tests
```

### Test Environment

Tests use a separate MongoDB database to avoid conflicts with development data. The test setup handles:

- Database connection before tests
- Cleanup between test runs
- Database disconnection after tests

## API Endpoints

### Health
- `GET /api/v1/health` - API health status
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/confirm-email` - Confirm email with verification code
- `POST /api/v1/auth/resend-code` - Resend verification code
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/logout` - Logout (requires auth)
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with code

### Documents
- `GET /api/v1/documents` - List user documents
- `POST /api/v1/documents/upload` - Direct file upload
- `POST /api/v1/documents/upload/presigned` - Get presigned upload URL
- `POST /api/v1/documents/upload/confirm` - Confirm presigned upload
- `GET /api/v1/documents/trash` - List documents in trash
- `GET /api/v1/documents/:id` - Get document details
- `PATCH /api/v1/documents/:id` - Update document metadata
- `DELETE /api/v1/documents/:id` - Soft delete document
- `DELETE /api/v1/documents/:id/permanent` - Permanently delete
- `GET /api/v1/documents/:id/download` - Get presigned download URL
- `POST /api/v1/documents/:id/move` - Move to different folder
- `POST /api/v1/documents/:id/copy` - Copy document
- `POST /api/v1/documents/:id/restore` - Restore from trash

### Folders
- `GET /api/v1/folders` - List folders
- `POST /api/v1/folders` - Create folder
- `GET /api/v1/folders/tree` - Get folder hierarchy tree
- `GET /api/v1/folders/trash` - List folders in trash
- `GET /api/v1/folders/:id` - Get folder details
- `GET /api/v1/folders/:id/subfolders` - Get direct subfolders
- `GET /api/v1/folders/:id/breadcrumb` - Get folder breadcrumb path
- `GET /api/v1/folders/:id/contents` - Get folder contents (documents + subfolders)
- `PATCH /api/v1/folders/:id` - Update folder
- `POST /api/v1/folders/:id/move` - Move to different parent
- `DELETE /api/v1/folders/:id` - Soft delete folder
- `POST /api/v1/folders/:id/restore` - Restore from trash
- `DELETE /api/v1/folders/:id/permanent` - Permanently delete

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update current user metadata
- `GET /api/v1/users/me/storage` - Get storage usage info
- `GET /api/v1/users` - List users (admin only)
- `GET /api/v1/users/:id` - Get user by ID (admin only)
- `PATCH /api/v1/users/:id` - Update user (admin only)
- `DELETE /api/v1/users/:id` - Delete user (admin only)

### PDF Processing
- `GET /api/v1/pdf/:id/info` - Get PDF metadata (page count, author, etc.)
- `POST /api/v1/pdf/:id/split` - Split PDF (modes: all, ranges, chunks, extract)
- `GET /api/v1/pdf/workers/stats` - Get worker pool statistics
- `GET /api/v1/pdf/jobs` - Get all user jobs
- `GET /api/v1/pdf/jobs/queued` - Get queued jobs
- `GET /api/v1/pdf/jobs/:jobId` - Get job status
- `POST /api/v1/pdf/jobs/:jobId/cancel` - Cancel job
- `DELETE /api/v1/pdf/jobs/:jobId` - Delete/cancel job

## Infrastructure (AWS S3 & Cognito)

### Using Terraform

The `terraform/` directory contains AWS infrastructure setup for:
- **S3**: Document storage bucket with versioning, encryption, and lifecycle rules
- **Cognito**: User authentication pool with email verification

Terraform variables are named to match `.env` so you can load them directly using `TF_VAR_` prefix.

#### Load Environment Variables for Terraform

**Bash/Linux/macOS/Git Bash:**
```bash
# Export .env vars as TF_VAR_ prefixed for Terraform
export $(grep -E '^(PROJECT_NAME|AWS_|NODE_ENV|CORS_)' .env | grep -v '#' | sed 's/^/TF_VAR_/' | xargs)
```

**PowerShell:**
```powershell
# Export .env vars as TF_VAR_ prefixed for Terraform
Get-Content .env | Where-Object { $_ -match '^(PROJECT_NAME|AWS_|NODE_ENV|CORS_)' -and $_ -notmatch '^#' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable("TF_VAR_$name", $value, "Process")
}
```

#### Deploy Infrastructure

1. **Initialize Terraform:**
   ```bash
   cd terraform
   terraform init
   ```

2. **Plan infrastructure:**
   ```bash
   terraform plan
   ```

3. **Apply infrastructure:**
   ```bash
   terraform apply
   ```

4. **Update .env with Terraform outputs:**
   ```bash
   cd terraform
   
   # Bash
   echo "AWS_S3_BUCKET_NAME=$(terraform output -raw s3_bucket_name)" >> ../.env
   echo "AWS_COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)" >> ../.env
   echo "AWS_COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)" >> ../.env
   ```

   ```powershell
   # PowerShell
   "AWS_S3_BUCKET_NAME=$(terraform output -raw s3_bucket_name)" | Add-Content ../.env
   "AWS_COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)" | Add-Content ../.env
   "AWS_COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)" | Add-Content ../.env
   ```

### Docker Deployment

Build and run the production container:

```bash
docker build -t dms-backend .
docker run -p 3000:3000 --env-file .env dms-backend
```

## Adapter Pattern

The application uses the Adapter Pattern for database and storage operations, allowing easy swapping of implementations:

- **Database Adapter**: `IDatabaseAdapter` interface with MongoDB implementation
- **Storage Adapter**: `IStorageAdapter` interface with S3 implementation

This design enables:
- Easy testing with mock implementations
- Switching providers without changing business logic
- Consistent interface across different backends

## PDF Split Modes

The PDF processing service supports multiple split modes:

| Mode | Description | Example |
|------|-------------|---------|
| `all` | Split each page into separate PDF | Creates N documents from N pages |
| `ranges` | Split by page ranges | `[{start: 1, end: 5}, {start: 6, end: 10}]` |
| `chunks` | Split into fixed-size chunks | `chunkSize: 5` creates docs of 5 pages each |
| `extract` | Extract specific pages | `pages: [1, 3, 5, 7]` into single document |

Jobs run in a background worker pool and can be monitored via the `/pdf/jobs` endpoints.

