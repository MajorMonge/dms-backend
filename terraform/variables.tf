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
  default     = "us-east-2"
}

# S3 Variables
variable "AWS_S3_BUCKET_NAME" {
  description = "Name of the S3 bucket for document storage"
  type        = string
  default     = "documents"
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

# ECS Variables
variable "ECS_CONTAINER_PORT" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "ECS_CPU" {
  description = "CPU units for the ECS task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256
}

variable "ECS_MEMORY" {
  description = "Memory for the ECS task in MB (512, 1024, 2048, etc.)"
  type        = number
  default     = 512
}

variable "ECS_DESIRED_COUNT" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "ECS_MIN_CAPACITY" {
  description = "Minimum number of ECS tasks for auto-scaling"
  type        = number
  default     = 1
}

variable "ECS_MAX_CAPACITY" {
  description = "Maximum number of ECS tasks for auto-scaling"
  type        = number
  default     = 4
}

# Database Variables
variable "MONGODB_URI" {
  description = "MongoDB connection URI"
  type        = string
  sensitive   = true
  default     = ""
}

# VPC Variables
variable "VPC_CIDR" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "AVAILABILITY_ZONES" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = ["us-east-2a"]
}
