terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state storage
  # backend "s3" {
  #   bucket         = "dms-terraform-state"
  #   key            = "infrastructure/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "dms-terraform-locks"
  # }
}

provider "aws" {
  region = var.AWS_REGION

  default_tags {
    tags = {
      Project     = "DMS"
      Environment = var.NODE_ENV
      ManagedBy   = "Terraform"
    }
  }
}
