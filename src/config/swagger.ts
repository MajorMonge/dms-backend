import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index.js';

const servers = config.isProduction && config.productionApiUrl
  ? [
      {
        url: config.productionApiUrl,
        description: 'Production server',
      },
    ]
  : [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ];

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Document Management System API',
    version: '1.0.0',
    description: `
      A cloud-based Document Management System API that provides:
      - Secure document storage and retrieval
      - Document processing (PDF splitting, OCR)
      - User authentication via AWS Cognito
      - File management operations
    `,
    contact: {
      name: 'API Support',
    },
    license: {
      name: 'ISC',
    },
  },
  servers,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token from AWS Cognito',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Validation failed',
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                },
              },
            },
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'object',
          },
          message: {
            type: 'string',
          },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'array',
            items: {
              type: 'object',
            },
          },
          pagination: {
            type: 'object',
            properties: {
              page: {
                type: 'integer',
                example: 1,
              },
              limit: {
                type: 'integer',
                example: 20,
              },
              total: {
                type: 'integer',
                example: 100,
              },
              totalPages: {
                type: 'integer',
                example: 5,
              },
            },
          },
        },
      },
      Document: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '550e8400-e29b-41d4-a716-446655440000',
          },
          name: {
            type: 'string',
            example: 'report.pdf',
          },
          originalName: {
            type: 'string',
            example: 'Annual Report 2025.pdf',
          },
          mimeType: {
            type: 'string',
            example: 'application/pdf',
          },
          size: {
            type: 'integer',
            example: 1048576,
          },
          path: {
            type: 'string',
            example: 'documents/user123/report.pdf',
          },
          folderId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
          },
          userId: {
            type: 'string',
            example: 'user123',
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Folder: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
            example: 'My Documents',
          },
          parentId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
          },
          userId: {
            type: 'string',
          },
          path: {
            type: 'string',
            example: '/My Documents',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication information is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      NotFoundError: {
        description: 'The specified resource was not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
      ValidationError: {
        description: 'Invalid input data',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'API health check endpoints',
    },
    {
      name: 'Documents',
      description: 'Document management operations',
    },
    {
      name: 'Folders',
      description: 'Folder management operations',
    },
    {
      name: 'Processing',
      description: 'Document processing operations',
    },
  ],
};

const options: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: [
    './src/routes/**/*.ts',
    './src/models/**/*.ts',
    './dist/routes/**/*.js',
    './dist/models/**/*.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
