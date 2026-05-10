import fs from 'fs/promises';
import path from 'path';
import { fileAnalysisQueue } from './fileAnalysis';
import FileAnalysis from '@/models/FileAnalysis';
import { connectDB } from '@/app/lib/db';

/**
 * Clean up old files from /uploads directory
 * Deletes files older than maxAgeMs (default: 1 hour)
 */
export async function cleanupOldUploadFiles(maxAgeMs: number = 3600000): Promise<{ deleted: number; errors: number }> {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  let deleted = 0;
  let errors = 0;

  try {
    // Ensure uploads directory exists
    await fs.access(uploadDir);
  } catch {
    console.log(`[Cleanup] Upload directory does not exist: ${uploadDir}`);
    return { deleted: 0, errors: 0 };
  }

  try {
    const files = await fs.readdir(uploadDir);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(uploadDir, file);

      try {
        const stats = await fs.stat(filePath);
        const ageMs = now - stats.mtimeMs;

        if (ageMs > maxAgeMs) {
          await fs.unlink(filePath);
          console.log(`[Cleanup] Deleted old file: ${file} (age: ${Math.round(ageMs / 1000)}s)`);
          deleted++;
        }
      } catch (error) {
        console.error(`[Cleanup] Error processing file ${file}:`, error);
        errors++;
      }
    }

    console.log(`[Cleanup] Cleanup complete: ${deleted} files deleted, ${errors} errors`);
    return { deleted, errors };
  } catch (error) {
    console.error(`[Cleanup] Error reading upload directory:`, error);
    return { deleted: 0, errors: 1 };
  }
}

/**
 * Clean up old records from FileAnalysis collection
 * Deletes records older than maxAgeMs (default: 30 days)
 */
export async function cleanupOldAnalysisRecords(
  maxAgeMs: number = 2592000000 // 30 days
): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    await connectDB();

    const cutoffDate = new Date(Date.now() - maxAgeMs);

    const result = await FileAnalysis.deleteMany({
      createdAt: { $lt: cutoffDate },
      // Only delete completed jobs
      status: { $in: ['safe', 'unsafe', 'error'] },
    });

    deleted = result.deletedCount || 0;

    console.log(
      `[Cleanup] Deleted ${deleted} old FileAnalysis records (before ${cutoffDate.toISOString()})`
    );
    return { deleted, errors };
  } catch (error) {
    console.error(`[Cleanup] Error cleaning up old records:`, error);
    errors = 1;
    return { deleted: 0, errors };
  }
}

/**
 * Clean up stale jobs from in-memory queue
 * Removes completed jobs older than maxAgeMs (default: 1 hour)
 */
export function cleanupQueueMemory(maxAgeMs: number = 3600000): { removed: number } {
  const removed = fileAnalysisQueue.cleanup(maxAgeMs);
  console.log(`[Cleanup] Removed ${removed.length} completed jobs from in-memory queue`);
  return { removed: removed.length };
}

/**
 * Comprehensive cleanup: files + records + queue memory
 */
export async function runFullCleanup(): Promise<{
  filesDeleted: number;
  recordsDeleted: number;
  queueCleaned: number;
  errors: number;
}> {
  console.log('[Cleanup] Starting full cleanup...');

  const fileCleanup = await cleanupOldUploadFiles();
  const recordCleanup = await cleanupOldAnalysisRecords();
  const queueCleanup = cleanupQueueMemory();

  const result = {
    filesDeleted: fileCleanup.deleted,
    recordsDeleted: recordCleanup.deleted,
    queueCleaned: queueCleanup.removed,
    errors: fileCleanup.errors + recordCleanup.errors,
  };

  console.log('[Cleanup] Full cleanup complete:', result);
  return result;
}

/**
 * Start a scheduled cleanup job
 * Runs every intervalMs (default: every 6 hours)
 */
export function scheduleCleanup(intervalMs: number = 21600000): NodeJS.Timer {
  console.log(`[Cleanup] Scheduling cleanup every ${intervalMs}ms (${Math.round(intervalMs / 3600000)} hours)`);

  const timer = setInterval(async () => {
    try {
      await runFullCleanup();
    } catch (error) {
      console.error('[Cleanup] Error in scheduled cleanup:', error);
    }
  }, intervalMs);

  return timer;
}
