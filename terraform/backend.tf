# Backend configuration for production
# Uses S3 for remote state storage

terraform {
  backend "s3" {
    bucket  = "dms-terraform-state-prod"
    key     = "production/terraform.tfstate"
    region  = "us-east-2"
    encrypt = true
  }
}
