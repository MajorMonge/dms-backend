data "aws_ssm_parameter" "ecs_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"
}

# EC2 Instance Role for ECS
resource "aws_iam_role" "ecs_instance_role" {
  name = "${var.PROJECT_NAME}-ecs-instance-role-${var.NODE_ENV}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.PROJECT_NAME}-ecs-instance-role-${var.NODE_ENV}"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_instance_role_policy" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "ecs_instance_ssm" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  name = "${var.PROJECT_NAME}-ecs-instance-profile-${var.NODE_ENV}"
  role = aws_iam_role.ecs_instance_role.name
}

# Security Group for EC2 instances
resource "aws_security_group" "ecs_ec2" {
  name        = "${var.PROJECT_NAME}-ecs-ec2-sg-${var.NODE_ENV}"
  description = "Security group for ECS EC2 instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Traffic from API Gateway VPC Link"
    from_port       = var.ECS_CONTAINER_PORT
    to_port         = var.ECS_CONTAINER_PORT
    protocol        = "tcp"
    security_groups = [aws_security_group.vpc_link.id]
  }

  # Allow ephemeral ports for dynamic port mapping
  ingress {
    description     = "Ephemeral ports for dynamic port mapping"
    from_port       = 32768
    to_port         = 65535
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
    Name = "${var.PROJECT_NAME}-ecs-ec2-sg-${var.NODE_ENV}"
  }
}

# Launch Template for ECS EC2 instances
resource "aws_launch_template" "ecs" {
  name_prefix   = "${var.PROJECT_NAME}-ecs-${var.NODE_ENV}-"
  image_id      = data.aws_ssm_parameter.ecs_ami.value
  instance_type = "t2.micro"

  iam_instance_profile {
    arn = aws_iam_instance_profile.ecs_instance.arn
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ecs_ec2.id]
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo "ECS_CLUSTER=${aws_ecs_cluster.main.name}" >> /etc/ecs/ecs.config
    echo "ECS_ENABLE_CONTAINER_METADATA=true" >> /etc/ecs/ecs.config
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.PROJECT_NAME}-ecs-instance-${var.NODE_ENV}"
    }
  }

  tags = {
    Name = "${var.PROJECT_NAME}-ecs-launch-template-${var.NODE_ENV}"
  }
}

# Auto Scaling Group for ECS
resource "aws_autoscaling_group" "ecs" {
  name                = "${var.PROJECT_NAME}-ecs-asg-${var.NODE_ENV}"
  vpc_zone_identifier = aws_subnet.public[*].id
  min_size            = 1
  max_size            = 1
  desired_capacity    = 1

  launch_template {
    id      = aws_launch_template.ecs.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.PROJECT_NAME}-ecs-instance-${var.NODE_ENV}"
    propagate_at_launch = true
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = "true"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ECS Capacity Provider for EC2
resource "aws_ecs_capacity_provider" "ec2" {
  name = "${var.PROJECT_NAME}-ec2-${var.NODE_ENV}"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.ecs.arn
    managed_termination_protection = "DISABLED"

    managed_scaling {
      maximum_scaling_step_size = 1
      minimum_scaling_step_size = 1
      status                    = "ENABLED"
      target_capacity           = 100
    }
  }

  tags = {
    Name = "${var.PROJECT_NAME}-ec2-capacity-provider-${var.NODE_ENV}"
  }
}
