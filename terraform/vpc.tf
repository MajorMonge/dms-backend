# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.VPC_CIDR
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.PROJECT_NAME}-vpc-${var.NODE_ENV}"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.PROJECT_NAME}-igw-${var.NODE_ENV}"
  }
}

# Public Subnets (ECS tasks will run here with public IPs - no NAT needed)
resource "aws_subnet" "public" {
  count                   = length(var.AVAILABILITY_ZONES)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.VPC_CIDR, 8, count.index)
  availability_zone       = var.AVAILABILITY_ZONES[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.PROJECT_NAME}-public-subnet-${count.index + 1}-${var.NODE_ENV}"
    Type = "Public"
  }
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.PROJECT_NAME}-public-rt-${var.NODE_ENV}"
  }
}

# Public Subnet Route Table Associations
resource "aws_route_table_association" "public" {
  count          = length(var.AVAILABILITY_ZONES)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
