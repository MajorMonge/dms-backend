# API Gateway HTTP API (Free Tier: 1M requests/month for 12 months)
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.PROJECT_NAME}-api-${var.NODE_ENV}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = [var.CORS_ORIGIN]
    allow_methods     = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization", "X-Requested-With"]
    allow_credentials = true
    max_age           = 86400
  }

  tags = {
    Name = "${var.PROJECT_NAME}-api-${var.NODE_ENV}"
  }
}

# VPC Link for API Gateway to reach ECS tasks
resource "aws_apigatewayv2_vpc_link" "main" {
  name               = "${var.PROJECT_NAME}-vpc-link-${var.NODE_ENV}"
  security_group_ids = [aws_security_group.vpc_link.id]
  subnet_ids         = aws_subnet.public[*].id

  tags = {
    Name = "${var.PROJECT_NAME}-vpc-link-${var.NODE_ENV}"
  }
}

# Service Discovery Namespace (for ECS service discovery)
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.PROJECT_NAME}.local"
  description = "Private DNS namespace for ${var.PROJECT_NAME}"
  vpc         = aws_vpc.main.id

  tags = {
    Name = "${var.PROJECT_NAME}-namespace-${var.NODE_ENV}"
  }
}

# Service Discovery Service
resource "aws_service_discovery_service" "api" {
  name = "api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = {
    Name = "${var.PROJECT_NAME}-api-discovery-${var.NODE_ENV}"
  }
}

# API Gateway Integration with ECS via VPC Link
resource "aws_apigatewayv2_integration" "ecs" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = aws_service_discovery_service.api.arn
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.main.id

  request_parameters = {
    "overwrite:path" = "$request.path"
  }
}

# API Gateway Route - catch all
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.ecs.id}"
}

# API Gateway Stage (auto-deploy)
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }

  tags = {
    Name = "${var.PROJECT_NAME}-api-stage-${var.NODE_ENV}"
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.PROJECT_NAME}-${var.NODE_ENV}"
  retention_in_days = 7

  tags = {
    Name = "${var.PROJECT_NAME}-api-gateway-logs-${var.NODE_ENV}"
  }
}
