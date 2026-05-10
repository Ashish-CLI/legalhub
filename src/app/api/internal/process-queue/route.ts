import { NextRequest, NextResponse } from 'next/server';
import { processQueue } from '@/lib/analysisWorker';
import { fileAnalysisQueue } from '@/lib/fileAnalysis';

/**
 * POST /api/internal/process-queue
 * 
 * Internal endpoint to trigger queue processing.
 * Should be called via cron jobs or scheduled tasks.
 * 
 * Security: Check origin header or implement API key authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Security check: verify this is an internal request
    const origin = request.headers.get('origin');
    const authHeader = request.headers.get('x-internal-auth');
    const internalKey = process.env.INTERNAL_API_KEY;

    // Allow localhost and same-origin requests, or if auth key matches
    const isInternal = 
      origin?.includes('localhost') || 
      origin?.includes('127.0.0.1') ||
      authHeader === internalKey;

    if (!isInternal && internalKey) {
      console.warn('[ProcessQueue] Unauthorized request to process-queue endpoint');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Process one job from the queue
    console.log('[ProcessQueue] Starting queue processing...');
    await processQueue();

    // Return queue status
    const queueStatus = fileAnalysisQueue.size();
    
    return NextResponse.json(
      {
        success: true,
        message: 'Queue processed',
        queueStatus,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ProcessQueue] Error processing queue:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/internal/process-queue
 * 
 * Get current queue status without processing
 */
export async function GET(request: NextRequest) {
  try {
    const queueStatus = fileAnalysisQueue.size();
    const allJobs = fileAnalysisQueue.getAll();

    return NextResponse.json(
      {
        success: true,
        queueStatus,
        jobs: allJobs.map((job) => ({
          jobId: job.jobId,
          fileId: job.fileId,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        })),
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ProcessQueue] Error fetching queue status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
