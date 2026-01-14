/**
 * Worker Pool Manager for PDF Processing
 * 
 * Manages a pool of worker threads for parallel PDF processing.
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import { pathToFileURL } from 'url';
import os from 'os';
import { logger } from '../config/logger';
import type {
    PdfWorkerMessage,
    PdfWorkerResponse,
    PdfSplitWorkerOptions,
    PdfSplitWorkerResult,
    JobInfo,
    JobStatus,
} from '../types/pdfWorker';

// Default pool size based on CPU cores (leave 1 for main thread)
const DEFAULT_POOL_SIZE = Math.max(1, os.cpus().length - 1);
const MAX_POOL_SIZE = 8;

interface WorkerTask {
    taskId: string;
    resolve: (result: PdfWorkerResponse) => void;
    reject: (error: Error) => void;
}

interface PoolWorker {
    worker: Worker;
    busy: boolean;
    currentTaskId?: string;
}

interface QueuedJob {
    message: PdfWorkerMessage;
    task: WorkerTask;
    jobInfo: JobInfo;
}

export class PdfWorkerPool extends EventEmitter {
    private workers: PoolWorker[] = [];
    private taskQueue: QueuedJob[] = [];
    private pendingTasks: Map<string, WorkerTask> = new Map();
    private jobs: Map<string, JobInfo> = new Map();
    private taskToJob: Map<string, string> = new Map();
    private taskIdCounter = 0;
    private jobIdCounter = 0;
    private isShuttingDown = false;
    private workerPath: string;

    constructor(private poolSize: number = DEFAULT_POOL_SIZE) {
        super();
        this.poolSize = Math.min(poolSize, MAX_POOL_SIZE);
        
        const isProduction = process.env.NODE_ENV === 'production';
        const baseDir = isProduction ? 'dist/workers' : 'src/workers';
        const workerFileName = isProduction ? 'pdfWorker.js' : 'pdfWorker.ts';
        this.workerPath = path.resolve(process.cwd(), baseDir, workerFileName);
    }

    /**
     * Initialize the worker pool
     */
    async initialize(): Promise<void> {
        logger.info(`Initializing PDF worker pool with ${this.poolSize} workers`);

        const initPromises: Promise<void>[] = [];

        for (let i = 0; i < this.poolSize; i++) {
            initPromises.push(this.createWorker());
        }

        await Promise.all(initPromises);
        logger.info(`PDF worker pool initialized with ${this.workers.length} workers`);
    }

    /**
     * Create a new worker
     */
    private async createWorker(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const workerFileUrl = pathToFileURL(this.workerPath);
                
                const worker = new Worker(workerFileUrl);

                const poolWorker: PoolWorker = {
                    worker,
                    busy: false,
                };

                // Wait for ready signal
                const onReady = (msg: { type: string }) => {
                    if (msg.type === 'ready') {
                        worker.off('message', onReady);
                        this.setupWorkerHandlers(poolWorker);
                        this.workers.push(poolWorker);
                        resolve();
                    }
                };

                worker.on('message', onReady);

                worker.on('error', (error) => {
                    logger.error('PDF worker error:', error);
                    reject(error);
                });

                // Set timeout for initialization
                setTimeout(() => {
                    reject(new Error('Worker initialization timeout'));
                }, 10000);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Setup message handlers for a worker
     */
    private setupWorkerHandlers(poolWorker: PoolWorker): void {
        poolWorker.worker.on('message', (response: PdfWorkerResponse) => {
            const task = this.pendingTasks.get(response.taskId);
            
            if (task) {
                this.pendingTasks.delete(response.taskId);
                poolWorker.busy = false;
                poolWorker.currentTaskId = undefined;
                
                // Update job status
                const jobId = this.taskToJob.get(response.taskId);
                if (jobId) {
                    const job = this.jobs.get(jobId);
                    if (job) {
                        job.status = response.type === 'error' ? 'failed' : 'completed';
                        job.completedAt = new Date();
                        if (response.type === 'error') {
                            job.error = response.error;
                        }
                    }
                    this.taskToJob.delete(response.taskId);
                }
                
                task.resolve(response);
            }

            // Process next task in queue
            this.processQueue();
        });

        poolWorker.worker.on('error', (error) => {
            logger.error('PDF worker error:', error);
            
            // Update job status if there was a current task
            if (poolWorker.currentTaskId) {
                const jobId = this.taskToJob.get(poolWorker.currentTaskId);
                if (jobId) {
                    const job = this.jobs.get(jobId);
                    if (job) {
                        job.status = 'failed';
                        job.completedAt = new Date();
                        job.error = error.message;
                    }
                }
            }
            
            poolWorker.busy = false;
            poolWorker.currentTaskId = undefined;
            
            this.processQueue();
        });

        poolWorker.worker.on('exit', (code) => {
            if (code !== 0 && !this.isShuttingDown) {
                logger.warn(`PDF worker exited with code ${code}, recreating...`);
                const index = this.workers.indexOf(poolWorker);
                if (index > -1) {
                    this.workers.splice(index, 1);
                }
                this.createWorker().catch(err => {
                    logger.error('Failed to recreate worker:', err);
                });
            }
        });
    }

    /**
     * Process the task queue
     */
    private processQueue(): void {
        if (this.taskQueue.length === 0) return;

        const availableWorker = this.workers.find(w => !w.busy);
        if (!availableWorker) return;

        const queueItem = this.taskQueue.shift();
        if (!queueItem) return;

        // Update job status
        queueItem.jobInfo.status = 'processing';
        queueItem.jobInfo.startedAt = new Date();

        availableWorker.busy = true;
        availableWorker.currentTaskId = queueItem.task.taskId;
        this.pendingTasks.set(queueItem.task.taskId, queueItem.task);
        availableWorker.worker.postMessage(queueItem.message);
    }

    /**
     * Execute a task on the worker pool
     */
    private execute(message: PdfWorkerMessage): Promise<PdfWorkerResponse> {
        return new Promise((resolve, reject) => {
            if (this.isShuttingDown) {
                reject(new Error('Worker pool is shutting down'));
                return;
            }

            const task: WorkerTask = {
                taskId: message.taskId,
                resolve,
                reject,
            };

            // Try to find an available worker
            const availableWorker = this.workers.find(w => !w.busy);

            if (availableWorker) {
                // Update job status to processing
                const jobId = this.taskToJob.get(message.taskId);
                if (jobId) {
                    const job = this.jobs.get(jobId);
                    if (job) {
                        job.status = 'processing';
                        job.startedAt = new Date();
                    }
                }
                
                availableWorker.busy = true;
                availableWorker.currentTaskId = message.taskId;
                this.pendingTasks.set(task.taskId, task);
                availableWorker.worker.postMessage(message);
            } else {
                // Queue the task - job info is already created
                const jobId = this.taskToJob.get(message.taskId);
                const jobInfo = jobId ? this.jobs.get(jobId) : undefined;
                
                if (jobInfo) {
                    this.taskQueue.push({ message, task, jobInfo });
                } else {
                    // Fallback - should not happen but handle gracefully
                    this.taskQueue.push({ 
                        message, 
                        task, 
                        jobInfo: {
                            jobId: `fallback_${message.taskId}`,
                            taskId: message.taskId,
                            type: message.type,
                            status: 'queued',
                            documentId: 'unknown',
                            ownerId: 'unknown',
                            createdAt: new Date(),
                        }
                    });
                }
            }
        });
    }

    /**
     * Generate a unique task ID
     */
    private generateTaskId(): string {
        return `task_${Date.now()}_${++this.taskIdCounter}`;
    }

    /**
     * Generate a unique job ID
     */
    private generateJobId(): string {
        return `job_${Date.now()}_${++this.jobIdCounter}`;
    }

    /**
     * Create a job for tracking
     */
    createJob(
        type: 'split' | 'getInfo',
        taskId: string,
        documentId: string,
        ownerId: string
    ): JobInfo {
        const jobId = this.generateJobId();
        const jobInfo: JobInfo = {
            jobId,
            taskId,
            type,
            status: 'queued',
            documentId,
            ownerId,
            createdAt: new Date(),
        };
        
        this.jobs.set(jobId, jobInfo);
        this.taskToJob.set(taskId, jobId);
        
        return jobInfo;
    }

    /**
     * Get job by ID
     */
    getJob(jobId: string): JobInfo | undefined {
        return this.jobs.get(jobId);
    }

    /**
     * Get all jobs for an owner
     */
    getJobsByOwner(ownerId: string): JobInfo[] {
        return Array.from(this.jobs.values())
            .filter(job => job.ownerId === ownerId);
    }

    /**
     * Get all jobs
     */
    getAllJobs(): JobInfo[] {
        return Array.from(this.jobs.values());
    }

    /**
     * Get queued jobs
     */
    getQueuedJobs(): JobInfo[] {
        return this.taskQueue.map(item => item.jobInfo);
    }

    /**
     * Cancel a queued job (remove from queue)
     */
    cancelQueuedJob(jobId: string): boolean {
        const index = this.taskQueue.findIndex(item => item.jobInfo.jobId === jobId);
        
        if (index === -1) {
            return false;
        }

        const [removed] = this.taskQueue.splice(index, 1);
        
        // Update job status
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = 'cancelled';
            job.completedAt = new Date();
        }

        // Reject the task promise
        removed.task.reject(new Error('Job cancelled'));
        
        // Clean up mappings
        this.taskToJob.delete(removed.task.taskId);
        
        logger.info(`Cancelled queued job: ${jobId}`);
        return true;
    }

    /**
     * Cancel a processing job (terminate worker and recreate)
     * Note: This is a destructive operation that terminates the worker
     */
    async cancelProcessingJob(jobId: string): Promise<boolean> {
        const job = this.jobs.get(jobId);
        if (!job || job.status !== 'processing') {
            return false;
        }

        // Find the worker processing this job
        const taskId = job.taskId;
        const poolWorker = this.workers.find(w => w.currentTaskId === taskId);
        
        if (!poolWorker) {
            return false;
        }

        // Get the pending task to reject it
        const task = this.pendingTasks.get(taskId);
        
        // Update job status
        job.status = 'cancelled';
        job.completedAt = new Date();
        
        // Remove from pending tasks
        this.pendingTasks.delete(taskId);
        this.taskToJob.delete(taskId);
        
        // Terminate the worker
        const workerIndex = this.workers.indexOf(poolWorker);
        if (workerIndex > -1) {
            this.workers.splice(workerIndex, 1);
        }
        
        await poolWorker.worker.terminate();
        
        // Reject the task
        if (task) {
            task.reject(new Error('Job cancelled'));
        }
        
        // Create a new worker to replace the terminated one
        try {
            await this.createWorker();
            this.processQueue();
        } catch (error) {
            logger.error('Failed to create replacement worker:', error);
        }
        
        logger.info(`Cancelled processing job: ${jobId}`);
        return true;
    }

    /**
     * Cancel any job (queued or processing)
     */
    async cancelJob(jobId: string): Promise<{ success: boolean; wasProcessing: boolean }> {
        const job = this.jobs.get(jobId);
        
        if (!job) {
            return { success: false, wasProcessing: false };
        }

        if (job.status === 'queued') {
            const success = this.cancelQueuedJob(jobId);
            return { success, wasProcessing: false };
        }

        if (job.status === 'processing') {
            const success = await this.cancelProcessingJob(jobId);
            return { success, wasProcessing: true };
        }

        // Job is already completed, failed, or cancelled
        return { success: false, wasProcessing: false };
    }

    /**
     * Clear completed/failed/cancelled jobs older than specified time
     */
    clearOldJobs(maxAgeMs: number = 3600000): number {
        const now = Date.now();
        let cleared = 0;
        
        for (const [jobId, job] of this.jobs.entries()) {
            if (
                (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
                job.completedAt &&
                now - job.completedAt.getTime() > maxAgeMs
            ) {
                this.jobs.delete(jobId);
                cleared++;
            }
        }
        
        return cleared;
    }

    /**
     * Split a PDF using worker thread
     */
    async split(
        pdfBuffer: Buffer,
        options: PdfSplitWorkerOptions,
        documentId: string = 'unknown',
        ownerId: string = 'unknown'
    ): Promise<{ jobId: string; pageCount: number; splits: PdfSplitWorkerResult[] }> {
        const taskId = this.generateTaskId();
        
        // Create job for tracking
        const jobInfo = this.createJob('split', taskId, documentId, ownerId);
        
        // Create a copy of the buffer as ArrayBuffer
        const arrayBuffer = pdfBuffer.buffer.slice(
            pdfBuffer.byteOffset,
            pdfBuffer.byteOffset + pdfBuffer.byteLength
        ) as ArrayBuffer;
        
        const message: PdfWorkerMessage = {
            type: 'split',
            taskId,
            pdfBuffer: arrayBuffer,
            options,
        };

        const response = await this.execute(message);

        if (response.type === 'error') {
            throw new Error(response.error);
        }

        return {
            jobId: jobInfo.jobId,
            pageCount: response.result.pageCount,
            splits: response.result.splits || [],
        };
    }

    /**
     * Get PDF info using worker thread
     */
    async getInfo(
        pdfBuffer: Buffer,
        documentId: string = 'unknown',
        ownerId: string = 'unknown'
    ): Promise<{
        pageCount: number;
        title?: string;
        author?: string;
        subject?: string;
        creator?: string;
        producer?: string;
        creationDate?: Date;
        modificationDate?: Date;
    }> {
        const taskId = this.generateTaskId();
        
        // Create job for tracking
        this.createJob('getInfo', taskId, documentId, ownerId);
        
        // Create a copy of the buffer as ArrayBuffer
        const arrayBuffer = pdfBuffer.buffer.slice(
            pdfBuffer.byteOffset,
            pdfBuffer.byteOffset + pdfBuffer.byteLength
        ) as ArrayBuffer;
        
        const message: PdfWorkerMessage = {
            type: 'getInfo',
            taskId,
            pdfBuffer: arrayBuffer,
        };

        const response = await this.execute(message);

        if (response.type === 'error') {
            throw new Error(response.error);
        }

        const info = response.result.info || {};

        return {
            pageCount: response.result.pageCount,
            title: info.title,
            author: info.author,
            subject: info.subject,
            creator: info.creator,
            producer: info.producer,
            creationDate: info.creationDate ? new Date(info.creationDate) : undefined,
            modificationDate: info.modificationDate ? new Date(info.modificationDate) : undefined,
        };
    }

    /**
     * Shutdown the worker pool
     */
    async shutdown(): Promise<void> {
        logger.info('Shutting down PDF worker pool...');
        this.isShuttingDown = true;

        // Reject all queued tasks and update job statuses
        for (const item of this.taskQueue) {
            item.jobInfo.status = 'cancelled';
            item.jobInfo.completedAt = new Date();
            item.task.reject(new Error('Worker pool is shutting down'));
        }
        this.taskQueue = [];

        // Terminate all workers
        const terminatePromises = this.workers.map(poolWorker => {
            return poolWorker.worker.terminate();
        });

        await Promise.all(terminatePromises);
        this.workers = [];
        logger.info('PDF worker pool shutdown complete');
    }

    /**
     * Get pool statistics
     */
    getStats(): { total: number; busy: number; queued: number } {
        return {
            total: this.workers.length,
            busy: this.workers.filter(w => w.busy).length,
            queued: this.taskQueue.length,
        };
    }
}

// Export singleton instance
export const pdfWorkerPool = new PdfWorkerPool();
