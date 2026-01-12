# VPC Link Security Group (for API Gateway)
resource "aws_security_group" "vpc_link" {
  name        = "${var.PROJECT_NAME}-vpc-link-sg-${var.NODE_ENV}"
  description = "Security group for API Gateway VPC Link"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.PROJECT_NAME}-vpc-link-sg-${var.NODE_ENV}"
  }
}

# ECS Tasks Security Group
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.PROJECT_NAME}-ecs-tasks-sg-${var.NODE_ENV}"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Traffic from API Gateway VPC Link"
    from_port       = var.ECS_CONTAINER_PORT
    to_port         = var.ECS_CONTAINER_PORT
    protocol        = "tcp"
    security_groups = [aws_security_group.vpc_link.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.PROJECT_NAME}-ecs-tasks-sg-${var.NODE_ENV}"
  }
}
