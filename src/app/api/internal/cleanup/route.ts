import { NextRequest, NextResponse } from 'next/server';
import { runFullCleanup } from '@/lib/cleanupJobs';

/**
 * POST /api/internal/cleanup
 * 
 * Trigger a cleanup operation.
 * Deletes old files from /uploads, old database records, and stale queue items.
 * 
 * Should be called via cron jobs or scheduled tasks.
 * Security: Same as /api/internal/process-queue
 */
export async function POST(request: NextRequest) {
  try {
    // Security check: verify this is an internal request
    const origin = request.headers.get('origin');
    const authHeader = request.headers.get('x-internal-auth');
    const internalKey = process.env.INTERNAL_API_KEY;

    const isInternal =
      origin?.includes('localhost') ||
      origin?.includes('127.0.0.1') ||
      authHeader === internalKey;

    if (!isInternal && internalKey) {
      console.warn('[Cleanup] Unauthorized request to cleanup endpoint');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cleanup] Cleanup endpoint called');
    const result = await runFullCleanup();

    return NextResponse.json(
      {
        success: true,
        message: 'Cleanup completed',
        result,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cleanup] Error during cleanup:', error);
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
 * GET /api/internal/cleanup
 * 
 * Check cleanup status (no-op, just returns 200)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      status: 'ok',
      message: 'Cleanup endpoint is operational',
    },
    { status: 200 }
  );
}
