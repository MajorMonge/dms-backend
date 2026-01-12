# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.PROJECT_NAME}-cluster-${var.NODE_ENV}"

  setting {
    name  = "containerInsights"
    value = var.NODE_ENV == "production" ? "enabled" : "disabled"
  }

  tags = {
    Name = "${var.PROJECT_NAME}-cluster-${var.NODE_ENV}"
  }
}

# ECS Cluster Capacity Providers - Using EC2 for Free Tier
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = [aws_ecs_capacity_provider.ec2.name]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = aws_ecs_capacity_provider.ec2.name
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.PROJECT_NAME}-${var.NODE_ENV}"
  retention_in_days = var.NODE_ENV == "production" ? 30 : 7

  tags = {
    Name = "${var.PROJECT_NAME}-ecs-logs-${var.NODE_ENV}"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "app" {
  family                   = "${var.PROJECT_NAME}-api-${var.NODE_ENV}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = var.ECS_CPU
  memory                   = var.ECS_MEMORY
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "${var.PROJECT_NAME}-api"
      image     = "${aws_ecr_repository.app.repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = var.ECS_CONTAINER_PORT
          hostPort      = var.ECS_CONTAINER_PORT
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = var.NODE_ENV },
        { name = "PORT", value = tostring(var.ECS_CONTAINER_PORT) },
        { name = "AWS_REGION", value = var.AWS_REGION },
        { name = "AWS_S3_BUCKET_NAME", value = aws_s3_bucket.documents.id },
        { name = "AWS_COGNITO_USER_POOL_ID", value = aws_cognito_user_pool.main.id },
        { name = "AWS_COGNITO_CLIENT_ID", value = aws_cognito_user_pool_client.web.id },
        { name = "CORS_ORIGIN", value = var.CORS_ORIGIN },
      ]

      secrets = var.MONGODB_URI != "" ? [
        {
          name      = "MONGODB_URI"
          valueFrom = aws_ssm_parameter.mongodb_uri[0].arn
        }
      ] : []

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.AWS_REGION
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:${var.ECS_CONTAINER_PORT}/api/v1/health/live || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.PROJECT_NAME}-api-task-${var.NODE_ENV}"
  }
}

# SSM Parameter for MongoDB URI (if provided)
resource "aws_ssm_parameter" "mongodb_uri" {
  count = var.MONGODB_URI != "" ? 1 : 0
  name  = "/${var.PROJECT_NAME}/${var.NODE_ENV}/mongodb-uri"
  type  = "SecureString"
  value = var.MONGODB_URI

  tags = {
    Name = "${var.PROJECT_NAME}-mongodb-uri-${var.NODE_ENV}"
  }
}

# ECS Service
resource "aws_ecs_service" "app" {
  name            = "${var.PROJECT_NAME}-api-${var.NODE_ENV}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.ECS_DESIRED_COUNT

  # Use EC2 capacity provider instead of Fargate
  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2.name
    weight            = 100
    base              = 1
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  # Service Discovery for API Gateway integration
  service_registries {
    registry_arn = aws_service_discovery_service.api.arn
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Ignore changes to desired_count to allow auto-scaling
  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Name = "${var.PROJECT_NAME}-api-service-${var.NODE_ENV}"
  }
}

# Auto Scaling Target
resource "aws_appautoscaling_target" "ecs" {
  count              = var.NODE_ENV == "production" ? 1 : 0
  max_capacity       = var.ECS_MAX_CAPACITY
  min_capacity       = var.ECS_MIN_CAPACITY
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Policy - CPU
resource "aws_appautoscaling_policy" "ecs_cpu" {
  count              = var.NODE_ENV == "production" ? 1 : 0
  name               = "${var.PROJECT_NAME}-cpu-scaling-${var.NODE_ENV}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Auto Scaling Policy - Memory
resource "aws_appautoscaling_policy" "ecs_memory" {
  count              = var.NODE_ENV == "production" ? 1 : 0
  name               = "${var.PROJECT_NAME}-memory-scaling-${var.NODE_ENV}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
