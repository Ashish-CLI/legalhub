import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export interface AnalysisJob {
  jobId: string;
  fileId: string;
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  status: 'pending' | 'processing' | 'safe' | 'unsafe' | 'error';
  cuckooTaskId?: string;
  verdict?: {
    safe: boolean;
    threatLevel?: string;
    timestamp: Date;
    report?: object;
  };
  cloudinaryUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    chatId?: string;
    type?: string;
    [key: string]: any;
  };
}

class FileAnalysisQueue {
  private queue: Map<string, AnalysisJob> = new Map();
  private processingSet: Set<string> = new Set();

  /**
   * Create a new analysis job and add to queue
   */
  enqueue(
    fileId: string,
    filePath: string,
    originalName: string,
    mimeType: string,
    size: number,
    uploaderId: string,
    metadata?: AnalysisJob['metadata']
  ): string {
    const jobId = uuidv4();
    const job: AnalysisJob = {
      jobId,
      fileId,
      filePath,
      originalName,
      mimeType,
      size,
      uploaderId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };
    this.queue.set(jobId, job);
    return jobId;
  }

  /**
   * Add an existing job to the queue (used for restoring from database)
   */
  enqueueExisting(job: AnalysisJob): void {
    this.queue.set(job.jobId, job);
  }

  /**
   * Get the next pending job from the queue
   */
  dequeue(): AnalysisJob | null {
    for (const [jobId, job] of this.queue.entries()) {
      if (job.status === 'pending' && !this.processingSet.has(jobId)) {
        return job;
      }
    }
    return null;
  }

  /**
   * Mark a job as currently processing
   */
  markProcessing(jobId: string): void {
    this.processingSet.add(jobId);
    const job = this.queue.get(jobId);
    if (job) {
      job.status = 'processing';
      job.updatedAt = new Date();
    }
  }

  /**
   * Update job status after analysis
   */
  updateStatus(
    jobId: string,
    status: 'safe' | 'unsafe' | 'error',
    result?: { verdict?: AnalysisJob['verdict']; cloudinaryUrl?: string; errorMessage?: string; cuckooTaskId?: string }
  ): AnalysisJob | null {
    const job = this.queue.get(jobId);
    if (!job) return null;

    job.status = status;
    job.updatedAt = new Date();

    if (result) {
      if (result.verdict) job.verdict = result.verdict;
      if (result.cloudinaryUrl) job.cloudinaryUrl = result.cloudinaryUrl;
      if (result.errorMessage) job.errorMessage = result.errorMessage;
      if (result.cuckooTaskId) job.cuckooTaskId = result.cuckooTaskId;
    }

    this.processingSet.delete(jobId);
    return job;
  }

  /**
   * Get status of a specific job by ID
   */
  getStatus(jobId: string): AnalysisJob | null {
    return this.queue.get(jobId) || null;
  }

  /**
   * Get all pending jobs
   */
  getPending(): AnalysisJob[] {
    return Array.from(this.queue.values()).filter(
      (job) => job.status === 'pending' && !this.processingSet.has(job.jobId)
    );
  }

  /**
   * Get all jobs by status
   */
  getByStatus(status: AnalysisJob['status']): AnalysisJob[] {
    return Array.from(this.queue.values()).filter((job) => job.status === status);
  }

  /**
   * Remove a job from queue (after completion or cleanup)
   */
  remove(jobId: string): AnalysisJob | null {
    const job = this.queue.get(jobId) || null;
    this.queue.delete(jobId);
    this.processingSet.delete(jobId);
    return job;
  }

  /**
   * Get all jobs
   */
  getAll(): AnalysisJob[] {
    return Array.from(this.queue.values());
  }

  /**
   * Clear old/completed jobs (for memory management)
   * Remove jobs older than maxAgeMs
   */
  cleanup(maxAgeMs: number = 86400000): AnalysisJob[] {
    const now = Date.now();
    const removed: AnalysisJob[] = [];

    for (const [jobId, job] of this.queue.entries()) {
      // Only remove completed/failed jobs that are old
      if (
        (job.status === 'safe' || job.status === 'unsafe' || job.status === 'error') &&
        now - job.updatedAt.getTime() > maxAgeMs
      ) {
        removed.push(job);
        this.queue.delete(jobId);
        this.processingSet.delete(jobId);
      }
    }

    return removed;
  }

  /**
   * Clean up local files associated with a job
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
    }
  }

  /**
   * Get size of queue (for monitoring)
   */
  size(): { total: number; pending: number; processing: number } {
    return {
      total: this.queue.size,
      pending: Array.from(this.queue.values()).filter((j) => j.status === 'pending').length,
      processing: this.processingSet.size,
    };
  }
}

// Export singleton instance
export const fileAnalysisQueue = new FileAnalysisQueue();
