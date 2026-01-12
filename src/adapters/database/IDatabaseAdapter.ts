/**
 * Database Adapter Interface
 * Provides an abstraction layer for database operations and connection management
 */

export interface DatabaseConnectionOptions {
  uri: string;
  dbName?: string;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  select?: string[];
  populate?: string | string[];
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IDatabaseAdapter<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
  // ============================================
  // Connection Management
  // ============================================

  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Get current connection status
   */
  getStatus(): string;

  /**
   * Check if database is connected
   */
  isConnected(): boolean;

  // ============================================
  // Query Operations
  // ============================================

  /**
   * Find a single document by ID
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find a single document by query
   */
  findOne(query: Partial<T>): Promise<T | null>;

  /**
   * Find multiple documents by query
   */
  findMany(query: Partial<T>, options?: QueryOptions): Promise<T[]>;

  /**
   * Find documents with pagination
   */
  findPaginated(query: Partial<T>, options?: QueryOptions): Promise<PaginatedResult<T>>;

  // ============================================
  // Write Operations
  // ============================================

  /**
   * Create a new document
   */
  create(data: CreateDTO): Promise<T>;

  /**
   * Create multiple documents
   */
  createMany(data: CreateDTO[]): Promise<T[]>;

  /**
   * Update a document by ID
   */
  updateById(id: string, data: UpdateDTO): Promise<T | null>;

  /**
   * Update multiple documents by query
   */
  updateMany(query: Partial<T>, data: UpdateDTO): Promise<number>;

  // ============================================
  // Delete Operations
  // ============================================

  /**
   * Delete a document by ID
   */
  deleteById(id: string): Promise<boolean>;

  /**
   * Delete multiple documents by query
   */
  deleteMany(query: Partial<T>): Promise<number>;

  // ============================================
  // Utility Operations
  // ============================================

  /**
   * Count documents matching query
   */
  count(query: Partial<T>): Promise<number>;

  /**
   * Check if document exists
   */
  exists(query: Partial<T>): Promise<boolean>;
}
