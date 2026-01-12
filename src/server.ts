import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { MongoDBAdapter } from './adapters/database/index.js';
import { pdfService } from './services/PdfService.js';

const startServer = async (): Promise<void> => {
  // Initialize database adapter
  const db = MongoDBAdapter.getInstance({
    uri: config.mongodb.uri,
    dbName: config.mongodb.dbName,
  });

  try {
    // Connect to database
    await db.connect();

    // Initialize PDF worker pool
    await pdfService.initialize();

    // Create Express application
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📚 API Documentation: http://localhost:${config.port}/api-docs`);
      logger.info(`🔧 Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Shutdown PDF worker pool
          await pdfService.shutdown();
          
          await db.disconnect();
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: Error) => {
      logger.error('Unhandled Promise Rejection:', reason);
      throw reason;
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
