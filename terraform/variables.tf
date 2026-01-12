# General Variables
# These match .env naming so you can: export $(grep -E '^(PROJECT_|AWS_|NODE_ENV|CORS_)' .env | sed 's/^/TF_VAR_/' | xargs)

variable "PROJECT_NAME" {
  description = "Project name for resource naming"
  type        = string
  default     = "dms"
}

variable "NODE_ENV" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"
}

variable "AWS_REGION" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# S3 Variables
variable "AWS_S3_BUCKET_NAME" {
  description = "Name of the S3 bucket for document storage"
  type        = string
  default     = "dms-documents"
}

variable "AWS_S3_VERSIONING_ENABLED" {
  description = "Enable versioning for S3 bucket"
  type        = bool
  default     = true
}

# Cognito Variables
variable "AWS_COGNITO_USER_POOL_NAME" {
  description = "Name of the Cognito User Pool"
  type        = string
  default     = "user-pool"
}

variable "AWS_COGNITO_CLIENT_NAME" {
  description = "Name of the Cognito App Client"
  type        = string
  default     = "web-client"
}

variable "CORS_ORIGIN" {
  description = "CORS origin URL, used for Cognito callback/logout URLs"
  type        = string
  default     = "http://localhost:3001"
}
