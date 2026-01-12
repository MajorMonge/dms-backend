# Document Management System - Backend

A cloud-based Document Management System backend built with Node.js, TypeScript, Express, and MongoDB.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     UI      │────▶│   Backend   │────▶│   AWS S3    │
│  (Next.js)  │     │  (Express)  │     │  (Storage)  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│AWS Cognito  │    │  MongoDB    │    │  Processing │
│   (Auth)    │    │ (Metadata)  │    │   (Queue)   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Features

- **Document Storage**: Secure document storage with AWS S3
- **Authentication**: JWT-based auth with AWS Cognito integration
- **Metadata Management**: MongoDB for document/folder metadata
- **Adapter Pattern**: Abstracted database and storage layers
- **API Documentation**: Swagger/OpenAPI documentation
- **Docker Support**: Containerized development environment
- **Infrastructure as Code**: Terraform for AWS resources

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **Framework**: Express 4.x
- **Database**: MongoDB 7.x (via Mongoose)
- **Storage**: AWS S3
- **Authentication**: AWS Cognito
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
│   ├── database.ts     # Database connection
│   ├── logger.ts       # Winston logger setup
│   └── swagger.ts      # Swagger documentation
├── middleware/         # Express middleware
│   ├── auth.ts         # Authentication middleware
│   ├── errorHandler.ts # Global error handling
│   ├── validate.ts     # Request validation
│   └── httpLogger.ts   # HTTP request logging
├── models/             # Mongoose models (to be added)
├── routes/             # API routes
├── services/           # Business logic (to be added)
├── types/              # TypeScript type definitions
├── app.ts              # Express application setup
└── server.ts           # Server entry point

terraform/              # Infrastructure as Code
├── main.tf             # Main Terraform configuration
├── s3.tf               # S3 bucket configuration
├── cognito.tf          # Cognito user pool setup
├── iam.tf              # IAM roles and policies
└── environments/       # Environment-specific vars

scripts/                # Utility scripts
├── mongo-init.js       # MongoDB initialization
└── localstack-init.sh  # LocalStack AWS setup
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

## API Endpoints

### Health
- `GET /api/v1/health` - API health status
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

### Documents (Coming Soon)
- `GET /api/v1/documents` - List documents
- `POST /api/v1/documents` - Upload document
- `GET /api/v1/documents/:id` - Get document
- `PUT /api/v1/documents/:id` - Update document
- `DELETE /api/v1/documents/:id` - Delete document
- `GET /api/v1/documents/:id/download` - Download document

### Folders (Coming Soon)
- `GET /api/v1/folders` - List folders
- `POST /api/v1/folders` - Create folder
- `GET /api/v1/folders/:id` - Get folder
- `PUT /api/v1/folders/:id` - Update folder
- `DELETE /api/v1/folders/:id` - Delete folder

### Processing (Coming Soon)
- `POST /api/v1/processing/pdf-split` - Split PDF
- `GET /api/v1/processing/jobs/:id` - Get job status

## Infrastructure Deployment

### Using Terraform

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

**Windows CMD:**
```cmd
@REM Export .env vars as TF_VAR_ prefixed for Terraform
for /f "tokens=1,2 delims==" %%a in ('findstr /r "^PROJECT_NAME= ^AWS_ ^NODE_ENV= ^CORS_" .env') do set TF_VAR_%%a=%%b
```

#### Deploy Infrastructure

1. **Initialize Terraform:**
   ```bash
   cd terraform
   terraform init
   ```

2. **Plan infrastructure:**
   ```bash
   # Using environment variables (recommended)
   terraform plan

   # Or using tfvars file
   terraform plan -var-file=environments/dev.tfvars
   ```

3. **Apply infrastructure:**
   ```bash
   terraform apply
   ```

4. **Update .env with Terraform outputs:**
   ```bash
   # Get Cognito outputs and update .env
   cd terraform
   
   # Bash
   echo "AWS_COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)" >> ../.env
   echo "AWS_COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)" >> ../.env
   ```

### Docker Deployment

Build and run the production container:

```bash
docker build -t dms-backend .
docker run -p 3000:3000 --env-file .env dms-backend
```

## Adapter Pattern

The application uses the Adapter Pattern for database and storage operations, allowing easy swapping of implementations:

### Database Adapter
```typescript
interface IDatabaseAdapter<T> {
  findById(id: string): Promise<T | null>;
  findOne(query: Partial<T>): Promise<T | null>;
  findMany(query: Partial<T>, options?: QueryOptions): Promise<T[]>;
  create(data: CreateDTO): Promise<T>;
  updateById(id: string, data: UpdateDTO): Promise<T | null>;
  deleteById(id: string): Promise<boolean>;
  // ... more methods
}
```

### Storage Adapter
```typescript
interface IStorageAdapter {
  upload(key: string, body: Buffer, options?: UploadOptions): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<boolean>;
  getPresignedDownloadUrl(key: string): Promise<string>;
  getPresignedUploadUrl(key: string): Promise<string>;
  // ... more methods
}
```

## License

ISC
