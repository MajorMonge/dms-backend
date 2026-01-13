#!/bin/bash
# LocalStack initialization script
# This script runs when LocalStack is ready

set -e

echo "🚀 Initializing LocalStack AWS services..."

# Configuration
AWS_REGION="${AWS_DEFAULT_REGION:-us-east-2}"
BUCKET_NAME="${AWS_S3_BUCKET_NAME:-dms-documents-local}"
USER_POOL_NAME="${AWS_COGNITO_USER_POOL_NAME:-dms-user-pool-local}"
CLIENT_NAME="${AWS_COGNITO_CLIENT_NAME:-dms-web-client-local}"

# Use LocalStack endpoint
export AWS_ENDPOINT_URL="http://localhost:4566"
export AWS_ACCESS_KEY_ID="test"
export AWS_SECRET_ACCESS_KEY="test"

echo "📦 Creating S3 bucket: $BUCKET_NAME"
awslocal s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION" 2>/dev/null || echo "Bucket already exists"

# Enable versioning on the bucket
awslocal s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled \
    --region "$AWS_REGION"

# Set CORS configuration
awslocal s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration '{
        "CORSRules": [
            {
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
                "AllowedOrigins": ["http://localhost:3000", "http://localhost:3001"],
                "ExposeHeaders": ["ETag", "Content-Type", "Content-Length"],
                "MaxAgeSeconds": 3000
            }
        ]
    }' \
    --region "$AWS_REGION"

echo "✅ S3 bucket created and configured"

echo "🔐 Creating Cognito User Pool: $USER_POOL_NAME"
USER_POOL_ID=$(awslocal cognito-idp create-user-pool \
    --pool-name "$USER_POOL_NAME" \
    --auto-verified-attributes email \
    --username-attributes email \
    --policies '{
        "PasswordPolicy": {
            "MinimumLength": 8,
            "RequireUppercase": true,
            "RequireLowercase": true,
            "RequireNumbers": true,
            "RequireSymbols": false
        }
    }' \
    --schema '[
        {
            "Name": "email",
            "AttributeDataType": "String",
            "Required": true,
            "Mutable": true
        },
        {
            "Name": "name",
            "AttributeDataType": "String",
            "Required": false,
            "Mutable": true
        }
    ]' \
    --region "$AWS_REGION" \
    --query 'UserPool.Id' \
    --output text)

echo "✅ User Pool created: $USER_POOL_ID"

echo "📱 Creating Cognito App Client: $CLIENT_NAME"
CLIENT_ID=$(awslocal cognito-idp create-user-pool-client \
    --user-pool-id "$USER_POOL_ID" \
    --client-name "$CLIENT_NAME" \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
    --generate-secret false \
    --region "$AWS_REGION" \
    --query 'UserPoolClient.ClientId' \
    --output text)

echo "✅ App Client created: $CLIENT_ID"

# Create user groups
echo "👥 Creating user groups..."
awslocal cognito-idp create-group \
    --user-pool-id "$USER_POOL_ID" \
    --group-name "admins" \
    --description "Administrator users" \
    --region "$AWS_REGION" 2>/dev/null || echo "Group 'admins' already exists"

awslocal cognito-idp create-group \
    --user-pool-id "$USER_POOL_ID" \
    --group-name "users" \
    --description "Regular users" \
    --region "$AWS_REGION" 2>/dev/null || echo "Group 'users' already exists"

echo "✅ User groups created"

# Create a test user (optional)
echo "👤 Creating test user..."
awslocal cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "test@example.com" \
    --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \
    --temporary-password "TempPass123!" \
    --message-action SUPPRESS \
    --region "$AWS_REGION" 2>/dev/null || echo "Test user already exists"

# Set permanent password for test user
awslocal cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "test@example.com" \
    --password "TestPass123!" \
    --permanent \
    --region "$AWS_REGION" 2>/dev/null || true

echo "✅ Test user created (test@example.com / TestPass123!)"

echo ""
echo "========================================"
echo "🎉 LocalStack initialization complete!"
echo "========================================"
echo ""
echo "AWS Endpoint: http://localhost:4566"
echo "S3 Bucket: $BUCKET_NAME"
echo "Cognito User Pool ID: $USER_POOL_ID"
echo "Cognito Client ID: $CLIENT_ID"
echo ""
echo "Add these to your .env for local development:"
echo "AWS_ENDPOINT_URL=http://localhost:4566"
echo "AWS_ACCESS_KEY_ID=test"
echo "AWS_SECRET_ACCESS_KEY=test"
echo "AWS_S3_BUCKET_NAME=$BUCKET_NAME"
echo "AWS_COGNITO_USER_POOL_ID=$USER_POOL_ID"
echo "AWS_COGNITO_CLIENT_ID=$CLIENT_ID"
echo ""
echo "Test user: test@example.com / TestPass123!"
echo ""
