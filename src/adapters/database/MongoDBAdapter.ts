import mongoose, { Model, Document, FilterQuery, UpdateQuery } from 'mongoose';
import { IDatabaseAdapter, DatabaseConnectionOptions, QueryOptions, PaginatedResult } from './IDatabaseAdapter.js';
import { logger } from '../../config/logger.js';

/**
 * MongoDB implementation of the Database Adapter
 * Handles both connection management and CRUD operations via Mongoose
 */
export class MongoDBAdapter<T extends Document, CreateDTO = Partial<T>, UpdateDTO = Partial<T>>
  implements IDatabaseAdapter<T, CreateDTO, UpdateDTO>
{
  private static instance: MongoDBAdapter<any> | null = null;
  private options: DatabaseConnectionOptions | null = null;

  constructor(protected readonly model?: Model<T>) {}

  /**
   * Get singleton instance for connection management
   */
  static getInstance<T extends Document>(options?: DatabaseConnectionOptions): MongoDBAdapter<T> {
    if (!MongoDBAdapter.instance) {
      MongoDBAdapter.instance = new MongoDBAdapter<T>();
    }
    if (options) {
      MongoDBAdapter.instance.options = options;
    }
    return MongoDBAdapter.instance as MongoDBAdapter<T>;
  }

  /**
   * Create a new adapter instance for a specific model
   */
  static forModel<T extends Document, CreateDTO = Partial<T>, UpdateDTO = Partial<T>>(
    model: Model<T>
  ): MongoDBAdapter<T, CreateDTO, UpdateDTO> {
    return new MongoDBAdapter<T, CreateDTO, UpdateDTO>(model);
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    MongoDBAdapter.instance = null;
  }

  // ============================================
  // Connection Management
  // ============================================

  async connect(): Promise<void> {
    if (!this.options) {
      throw new Error('Database connection options not configured. Call getInstance with options first.');
    }

    try {
      mongoose.set('strictQuery', true);

      await mongoose.connect(this.options.uri, {
        dbName: this.options.dbName,
      });

      logger.info(`MongoDB connected: ${mongoose.connection.host}`);
      this.setupEventListeners();
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
      throw error;
    }
  }

  getStatus(): string {
    const states: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[mongoose.connection.readyState] || 'unknown';
  }

  isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  private setupEventListeners(): void {
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  }

  // ============================================
  // Query Operations
  // ============================================

  private ensureModel(): Model<T> {
    if (!this.model) {
      throw new Error('Model not configured. Use MongoDBAdapter.forModel() to create an adapter for a specific model.');
    }
    return this.model;
  }

  async findById(id: string): Promise<T | null> {
    const model = this.ensureModel();
    try {
      return await model.findById(id).exec();
    } catch {
      return null;
    }
  }

  async findOne(query: Partial<T>): Promise<T | null> {
    const model = this.ensureModel();
    return await model.findOne(query as FilterQuery<T>).exec();
  }

  async findMany(query: Partial<T>, options?: QueryOptions): Promise<T[]> {
    const model = this.ensureModel();
    let queryBuilder = model.find(query as FilterQuery<T>);

    if (options?.sort) {
      queryBuilder = queryBuilder.sort(options.sort);
    }

    if (options?.select) {
      queryBuilder = queryBuilder.select(options.select.join(' '));
    }

    if (options?.populate) {
      const populateFields = Array.isArray(options.populate)
        ? options.populate
        : [options.populate];
      for (const field of populateFields) {
        queryBuilder = queryBuilder.populate(field);
      }
    }

    if (options?.page && options?.limit) {
      const skip = (options.page - 1) * options.limit;
      queryBuilder = queryBuilder.skip(skip).limit(options.limit);
    } else if (options?.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    return await queryBuilder.exec();
  }

  async findPaginated(query: Partial<T>, options?: QueryOptions): Promise<PaginatedResult<T>> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.findMany(query, { ...options, page, limit }),
      this.count(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateDTO): Promise<T> {
    const model = this.ensureModel();
    const document = new model(data);
    return await document.save();
  }

  async createMany(data: CreateDTO[]): Promise<T[]> {
    const model = this.ensureModel();
    return await model.insertMany(data) as unknown as T[];
  }

  async updateById(id: string, data: UpdateDTO): Promise<T | null> {
    const model = this.ensureModel();
    try {
      return await model
        .findByIdAndUpdate(id, data as UpdateQuery<T>, { new: true, runValidators: true })
        .exec();
    } catch {
      return null;
    }
  }

  async updateMany(query: Partial<T>, data: UpdateDTO): Promise<number> {
    const model = this.ensureModel();
    const result = await model
      .updateMany(query as FilterQuery<T>, data as UpdateQuery<T>, { runValidators: true })
      .exec();
    return result.modifiedCount;
  }

  async deleteById(id: string): Promise<boolean> {
    const model = this.ensureModel();
    try {
      const result = await model.findByIdAndDelete(id).exec();
      return result !== null;
    } catch {
      return false;
    }
  }

  async deleteMany(query: Partial<T>): Promise<number> {
    const model = this.ensureModel();
    const result = await model.deleteMany(query as FilterQuery<T>).exec();
    return result.deletedCount;
  }

  async count(query: Partial<T>): Promise<number> {
    const model = this.ensureModel();
    return await model.countDocuments(query as FilterQuery<T>).exec();
  }

  async exists(query: Partial<T>): Promise<boolean> {
    const model = this.ensureModel();
    const result = await model.exists(query as FilterQuery<T>);
    return result !== null;
  }
}
